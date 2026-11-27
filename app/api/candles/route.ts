import { getConn } from '@/lib/metaapi';
import { getSession } from '@/lib/session';
import { candlesFor } from '@/lib/preview';
export const maxDuration = 60;
export async function GET(r: Request) {
  const id = getSession(); if (!id) return Response.json({ error: 'Não conectado' }, { status: 401 });
  const u = new URL(r.url);
  if (id === 'preview') return Response.json(await candlesFor(u.searchParams.get('symbol') || 'EURUSD', u.searchParams.get('tf') || '5m'));
  try {
    const { account } = await getConn(id);
    // limit conta para trás a partir de startTime (confira na doc da MetaApi sua versão do SDK)
    const raw = await account.getHistoricalCandles(u.searchParams.get('symbol') || 'EURUSD', u.searchParams.get('tf') || '5m', new Date(), 1000);
    const candles = raw.map((k: any) => ({ time: Math.floor(new Date(k.time).getTime() / 1000), open: k.open, high: k.high, low: k.low, close: k.close, vol: k.tickVolume })).sort((a: any, b: any) => a.time - b.time);
    return Response.json({ candles });
  } catch (e: any) { return Response.json({ error: e.message }, { status: 500 }); }
}
