import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
export type AiCfg = { provider: string; apiKey: string; model: string; baseUrl?: string };
export class AiError extends Error { constructor(m: string, public status = 502) { super(m); } }
export const PROVIDERS: Record<string, { label: string; model: string; base?: string }> = {
  gemini: { label: 'Google Gemini', model: 'gemini-2.5-flash', base: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  openrouter: { label: 'OpenRouter', model: 'anthropic/claude-sonnet-4.5', base: 'https://openrouter.ai/api/v1' },
  openai: { label: 'OpenAI', model: 'gpt-4o-mini', base: 'https://api.openai.com/v1' },
  anthropic: { label: 'Anthropic', model: 'claude-sonnet-5-5' },
  custom: { label: 'Endpoint customizado (compatível OpenAI)', model: '' },
};
const key = () => createHash('sha256').update(`${process.env.SESSION_SECRET}:ai`).digest();
// A chave de API fica só num cookie httpOnly criptografado (AES-256-GCM); nunca volta ao navegador.
export function saveCfg(c: AiCfg) {
  const iv = randomBytes(12), ci = createCipheriv('aes-256-gcm', key(), iv), enc = Buffer.concat([ci.update(JSON.stringify(c), 'utf8'), ci.final()]);
  cookies().set('ai', Buffer.concat([iv, ci.getAuthTag(), enc]).toString('base64url'), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 30 * 86400 });
}
export const clearCfg = () => cookies().delete('ai');
export function loadCfg(): (AiCfg & { source: 'user' | 'env' }) | null {
  try {
    const b = Buffer.from(cookies().get('ai')?.value || '', 'base64url'); if (b.length < 29) throw 0;
    const d = createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28));
    return { ...JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString()), source: 'user' };
  } catch {}
  const e = process.env;  // fallback: variáveis do servidor
  if (e.AI_API_KEY) return { provider: e.AI_PROVIDER || 'openai', apiKey: e.AI_API_KEY, model: e.AI_MODEL || PROVIDERS[e.AI_PROVIDER || 'openai']?.model, baseUrl: e.AI_BASE_URL, source: 'env' };
  if (e.ANTHROPIC_API_KEY) return { provider: 'anthropic', apiKey: e.ANTHROPIC_API_KEY, model: e.CONVERT_MODEL || PROVIDERS.anthropic.model, source: 'env' };
  return null;
}
function safeBase(u: string) { // bloqueia endpoints locais/privados (SSRF básico)
  let x: URL; try { x = new URL(u); } catch { throw new AiError('URL base inválida', 400); }
  if (x.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/i.test(x.hostname) || !x.hostname.includes('.')) throw new AiError('Use uma URL https pública', 400);
  return u.replace(/\/+$/, '');
}
export async function complete(system: string, user: string, max = 4000, cfg: AiCfg | null = loadCfg()): Promise<string> {
  if (!cfg?.apiKey) throw new AiError('Nenhuma IA configurada. Toque na engrenagem (⚙), informe provedor, API key e modelo.', 400);
  if (!cfg.model) throw new AiError('Informe o modelo da IA', 400);
  const anth = cfg.provider === 'anthropic', base = cfg.baseUrl || PROVIDERS[cfg.provider]?.base;
  if (!anth && !base) throw new AiError('Informe a URL base do endpoint', 400);
  const res = await fetch(anth ? 'https://api.anthropic.com/v1/messages' : `${safeBase(base!)}/chat/completions`, { method: 'POST',
    headers: anth ? { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' } : { Authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(anth ? { model: cfg.model, max_tokens: max, system, messages: [{ role: 'user', content: user }] } : { model: cfg.model, max_tokens: max, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) }).catch(() => { throw new AiError('Não foi possível alcançar o provedor de IA', 502); });
  const d: any = await res.json().catch(() => ({}));
  if (!res.ok) { const m = d.error?.message || d[0]?.error?.message || d.message || res.statusText, auth = res.status === 401 || res.status === 403;
    throw new AiError(auth ? `Chave recusada pelo provedor (${res.status}): ${m}` : res.status === 404 ? `Modelo ou endpoint não encontrado: ${m}` : `Erro do provedor (${res.status}): ${m}`, auth ? 401 : 502); }
  return anth ? (d.content || []).map((b: any) => b.text || '').join('') : d.choices?.[0]?.message?.content || '';
}
