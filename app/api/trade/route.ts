import { getConn } from '@/lib/metaapi';
import { getSession } from '@/lib/session';
import { previewTrade } from '@/lib/preview';
const num = (v: any) => (v === '' || v == null || isNaN(+v) ? undefined : +v);
const E = (m: string, s = 400) => Response.json({ error: m }, { status: s });
export async function GET(r: Request) {
  const id = getSession(); if (!id) return E('Não conectado', 401);
  const u = new URL(r.url);
  if (id === 'preview') return Response.json(previewTrade(u.searchParams.get('history'), (u.searchParams.get('q') || '').split(',').filter(Boolean).slice(0, 20)));
  try { const { conn } = await getConn(id);
    const h = u.searchParams.get('history');
    if (h) { const d = await conn.getDealsByTimeRange(new Date(Date.now() - (+h || 7) * 864e5), new Date());
      return Response.json({ deals: (d.deals || []).filter((x: any) => x.entryType === 'DEAL_ENTRY_OUT').reverse() }); }
    const syms = (u.searchParams.get('q') || '').split(',').filter(Boolean).slice(0, 20);
    const [account, positions, orders, q] = await Promise.all([conn.getAccountInformation(), conn.getPositions(), conn.getOrders(), Promise.allSettled(syms.map(s => conn.getSymbolPrice(s)))]);
    const quotes: any = {}; q.forEach((x: any, i) => { if (x.status === 'fulfilled') quotes[syms[i]] = { bid: x.value.bid, ask: x.value.ask }; });
    return Response.json({ account, positions, orders, quotes });
  } catch (e: any) { return E(e.message, 500); }
}
export async function POST(r: Request) {
  const id = getSession(); if (!id) return E('Não conectado', 401);
  if (id === 'preview') return E('Pré-visualização: ordens desativadas. Conecte uma conta MT5 para operar.');
  const b = await r.json(), v = num(b.volume), sl = num(b.sl), tp = num(b.tp), px = num(b.price), sym = String(b.symbol || '');
  const needVol = () => { if (!(v! > 0 && v! <= 100)) throw new Error('Volume inválido'); if (!/^[\w.#-]{1,20}$/.test(sym)) throw new Error('Símbolo inválido'); };
  try { const { conn } = await getConn(id); let res: any;
    switch (b.action) {
      case 'buy': needVol(); res = await conn.createMarketBuyOrder(sym, v, sl, tp); break;
      case 'sell': needVol(); res = await conn.createMarketSellOrder(sym, v, sl, tp); break;
      case 'pending': { needVol(); if (!px) throw new Error('Informe o preço');
        const f: any = { BUY_LIMIT: 'createLimitBuyOrder', SELL_LIMIT: 'createLimitSellOrder', BUY_STOP: 'createStopBuyOrder', SELL_STOP: 'createStopSellOrder' }[b.type as string];
        if (!f) throw new Error('Tipo inválido'); res = await (conn as any)[f](sym, v, px, sl, tp); break; }
      case 'modify': res = await conn.modifyPosition(String(b.positionId), sl, tp); break;
      case 'modifyOrder': res = await conn.modifyOrder(String(b.orderId), px, sl, tp); break;
      case 'cancel': res = await conn.cancelOrder(String(b.orderId)); break;
      case 'close': res = v ? await conn.closePositionPartially(String(b.positionId), v) : await conn.closePosition(String(b.positionId)); break;
      case 'closeAll': { const ps = await conn.getPositions(); const m = b.mode;
        for (const p of ps) if (m === 'all' || (m === 'profit' && p.profit > 0) || (m === 'loss' && p.profit < 0)) await conn.closePosition(p.id);
        res = { closed: true }; break; }
      default: return E('Ação inválida');
    }
    return Response.json(res ?? {});
  } catch (e: any) { return E(e.message, 500); }
}
export const maxDuration = 60;
