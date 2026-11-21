import MetaApi from 'metaapi.cloud-sdk';
const g = globalThis as any;
export const api = () => (g.__api ??= new MetaApi(process.env.METAAPI_TOKEN!));
export async function getConn(id: string) {
  g.__c ??= new Map();
  if (g.__c.has(id)) return g.__c.get(id);
  const account = await api().metatraderAccountApi.getAccount(id);
  if (account.state !== 'DEPLOYED') await account.deploy();
  await account.waitConnected();
  const conn = account.getRPCConnection(); await conn.connect(); await conn.waitSynchronized();
  const v = { account, conn }; g.__c.set(id, v); return v;
}
export const dropConn = (id: string) => g.__c?.delete(id);
