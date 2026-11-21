import { api, dropConn } from '@/lib/metaapi';
import { setSession, getSession, clearSession } from '@/lib/session';
import { createHash } from 'crypto';
export const maxDuration = 60;
// A senha vai direto para a MetaApi e NÃO é guardada por este sistema; só o id da conta fica no cookie assinado.
export async function POST(r: Request) {
  if (!process.env.METAAPI_TOKEN || !process.env.SESSION_SECRET) return Response.json({ error: 'Servidor sem METAAPI_TOKEN ou SESSION_SECRET configurado (Vercel → Environment Variables → Redeploy)' }, { status: 500 });
  const { login, server, password } = await r.json();
  if (!login || !server || !password) return Response.json({ error: 'Preencha login, servidor e senha' }, { status: 400 });
  try {
    const account = await api().metatraderAccountApi.createAccount({ name: `u-${login}`, type: 'cloud', login: String(login), password, server, platform: 'mt5', magic: 0 });
    await account.deploy(); await account.waitConnected();
    setSession(account.id, createHash('sha256').update(`${server}|${login}`).digest('hex')); // chave estável: o estado sobrevive a sair e reconectar
    return Response.json({ ok: true });
  } catch (e: any) { return Response.json({ error: e.message }, { status: 400 }); }
}
export async function DELETE() { // desconectar: remove a conta da MetaApi (para a cobrança) e limpa a sessão
  const id = getSession();
  if (id) { try { await (await api().metatraderAccountApi.getAccount(id)).remove(); } catch {} dropConn(id); }
  clearSession(); return Response.json({ ok: true });
}
export async function GET() { return Response.json({ connected: !!getSession() }); }
