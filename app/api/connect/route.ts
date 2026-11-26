import { api, dropConn } from '@/lib/metaapi';
import { setSession, getSession, getUserKey, clearSession } from '@/lib/session';
import { db } from '@/lib/db';
import { createHash } from 'crypto';
export const maxDuration = 60;
// A senha vai direto para a MetaApi e NÃO é guardada por este sistema; só o id da conta fica no cookie assinado.
export async function POST(r: Request) {
  if (!process.env.METAAPI_TOKEN || !process.env.SESSION_SECRET) return Response.json({ error: 'Servidor sem METAAPI_TOKEN ou SESSION_SECRET configurado (Vercel → Environment Variables → Redeploy)' }, { status: 500 });
  const { login, server, password } = await r.json();
  if (!login || !server || !password) return Response.json({ error: 'Preencha login, servidor e senha' }, { status: 400 });
  const rel = process.env.METAAPI_RELIABILITY === 'high' ? 'high' : 'regular';
  try {
    const account = await api().metatraderAccountApi.createAccount({ name: `u-${login}`, type: 'cloud', login: String(login), password, server, platform: 'mt5', magic: 0, reliability: rel as 'high' | 'regular' });
    await account.deploy(); await account.waitConnected();
    setSession(account.id, createHash('sha256').update(`${server}|${login}`).digest('hex')); // chave estável: o estado sobrevive a sair e reconectar
    return Response.json({ ok: true });
  } catch (e: any) {
    console.error('connect-falhou', JSON.stringify({ server, reliability: rel, status: e.status, details: e.details, message: e.message })); // vai para os logs do Vercel (sem senha)
    const hint = /top up/i.test(String(e.message)) ? ' — A MetaApi cobra crédito para esse tipo de conta (contas reais costumam exigir confiabilidade alta). Teste com uma conta demo ou adicione crédito em metaapi.cloud.' : '';
    return Response.json({ error: e.message + hint }, { status: 400 });
  }
}
export async function DELETE() { // sair: remove a conta da MetaApi (para a cobrança), exceto se o automático 24h estiver ligado
  const id = getSession(), uk = getUserKey(); let keep = false;
  if (id && uk) { try { const { data } = await db().from('panel_state').select('value').eq('user_key', uk).eq('key', 'auto').maybeSingle(); keep = !!data?.value?.enabled; } catch {} }
  if (id && !keep) { try { await (await api().metatraderAccountApi.getAccount(id)).remove(); } catch {} dropConn(id); }
  clearSession(); return Response.json({ ok: true, kept: keep });
}
export async function GET() { return Response.json({ connected: !!getSession() }); }
