import { PROVIDERS, saveCfg, clearCfg, loadCfg, complete, AiError } from '@/lib/ai';
import { getSession } from '@/lib/session';
const bad = (m: string, s = 400) => Response.json({ error: m }, { status: s });
const view = () => { const c = loadCfg(); return c ? { configured: true, provider: c.provider, model: c.model, baseUrl: c.baseUrl || '', last4: c.apiKey.slice(-4), source: c.source } : { configured: false }; };
export const maxDuration = 60;
export async function GET() { if (!getSession()) return bad('Não conectado', 401); return Response.json(view()); }
export async function POST(r: Request) {
  if (!getSession()) return bad('Não conectado', 401);
  if (!process.env.SESSION_SECRET) return bad('Servidor sem SESSION_SECRET configurado', 500);
  const { provider, apiKey, model, baseUrl } = await r.json();
  if (!PROVIDERS[provider]) return bad('Provedor inválido');
  const cfg = { provider, apiKey: String(apiKey || '').trim(), model: String(model || '').trim(), baseUrl: provider === 'custom' ? String(baseUrl || '').trim() : undefined };
  if (cfg.apiKey.length < 8 || cfg.apiKey.length > 400) return bad('Informe a API key');
  if (cfg.model.length < 2 || cfg.model.length > 120) return bad('Informe o modelo');
  try { await complete('Responda apenas OK.', 'ping', 16, cfg); } catch (e: any) { return bad(e.message, e instanceof AiError ? e.status : 502); } // testa na hora
  saveCfg(cfg); return Response.json(view());
}
export async function DELETE() { clearCfg(); return Response.json({ configured: false }); }
