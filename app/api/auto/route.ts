import { db } from '@/lib/db';
import { getSession, getUserKey } from '@/lib/session';
const TFS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
const bad = (m: string, s = 400) => Response.json({ error: m }, { status: s });
// Liga/desliga o automático 24h: grava o pedido no banco; quem executa é o worker (Render).
export async function POST(r: Request) {
  const accountId = getSession(), uk = getUserKey(); if (!accountId || !uk) return bad('Não conectado', 401);
  const { enabled, symbol, tf, code } = await r.json(), sb = db(), now = new Date().toISOString();
  const put = (key: string, value: any) => sb.from('panel_state').upsert({ user_key: uk, key, value, updated_at: now }, { onConflict: 'user_key,key' });
  if (!enabled) { await put('auto', { enabled: false }); return Response.json({ ok: true }); }
  if (!/^[\w.#-]{1,20}$/.test(String(symbol)) || !TFS.includes(tf)) return bad('Símbolo ou timeframe inválido');
  if (typeof code !== 'string' || code.length < 20 || code.length > 30000) return bad('Indicador inválido');
  const { data } = await sb.from('panel_state').select('key,value').eq('user_key', uk).in('key', ['profile', 'guard']);
  const m: any = Object.fromEntries((data || []).map((x: any) => [x.key, x.value]));
  if (!m.profile) return bad('Analise seu setup antes de ligar o automático');
  if (!(m.guard?.lotMax > 0 && m.guard?.lossMax > 0)) return bad('Defina as travas de risco (lote máximo e perda máxima do dia)');
  await sb.from('panel_state').delete().eq('user_key', uk).eq('key', 'autostate'); // recomeça limpo
  const { error } = await put('auto', { enabled: true, accountId, symbol, tf, code, since: Date.now() });
  return error ? bad(error.message, 500) : Response.json({ ok: true });
}
