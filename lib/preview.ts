// Pré-visualização: dados de EXEMPLO (não vêm de nenhuma conta). Servem só para conhecer a interface; ordens ficam desativadas.
const SEC: Record<string, number> = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
const BASE: Record<string, number> = { EURUSD: 1.0842, GBPUSD: 1.2618, USDJPY: 154.31, XAUUSD: 2641.2 };
const base = (s: string) => BASE[s] ?? 50 + ([...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 100);
const dec = (p: number) => (p < 10 ? 5 : p < 500 ? 3 : 2);
export function sampleCandles(symbol: string, tf: string, n = 600) {
  const step = SEC[tf] || 300, end = Math.floor(Date.now() / 1000 / step) * step, d = dec(base(symbol));
  let seed = [...symbol].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), p = base(symbol);
  const r = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296, v = p * 0.0006, out: any[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const o = p, c = o + (r() - 0.5) * v * 2, h = Math.max(o, c) + r() * v, l = Math.min(o, c) - r() * v;
    out.push({ time: end - i * step, open: +o.toFixed(d), high: +h.toFixed(d), low: +l.toFixed(d), close: +c.toFixed(d), vol: 50 + Math.floor(r() * 100) }); p = c;
  }
  return out;
}
const last = (s: string) => sampleCandles(s, '5m').pop().close as number;
// Cotações públicas (Yahoo Finance, não oficial, podem diferir um pouco da corretora; ouro usa futuros GC=F). Se falhar, cai nos dados de exemplo.
const YF: Record<string, string> = { XAUUSD: 'GC=F', XAGUSD: 'SI=F', EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'USDJPY=X', AUDUSD: 'AUDUSD=X', USDCAD: 'USDCAD=X', USDCHF: 'USDCHF=X', NZDUSD: 'NZDUSD=X', BTCUSD: 'BTC-USD', ETHUSD: 'ETH-USD', US30: 'YM=F', NAS100: 'NQ=F', US500: 'ES=F', USOIL: 'CL=F' };
const RNG: Record<string, [string, string]> = { '1m': ['1m', '1d'], '5m': ['5m', '5d'], '15m': ['15m', '5d'], '30m': ['30m', '1mo'], '1h': ['60m', '1mo'], '4h': ['60m', '3mo'], '1d': ['1d', '1y'] };
const cache = new Map<string, { t: number; v: any[] }>();
function agg(c: any[], sec: number) { const m = new Map<number, any>(); for (const k of c) { const b = Math.floor(k.time / sec) * sec, x = m.get(b); if (!x) m.set(b, { ...k, time: b }); else { x.high = Math.max(x.high, k.high); x.low = Math.min(x.low, k.low); x.close = k.close; x.vol += k.vol; } } return [...m.values()]; }
export async function marketCandles(symbol: string, tf: string): Promise<any[] | null> {
  const ys = YF[symbol.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)]; if (!ys) return null;
  const key = ys + tf, hit = cache.get(key); if (hit && Date.now() - hit.t < 20000) return hit.v;
  try {
    const [iv, rg] = RNG[tf] || RNG['5m'];
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ys)}?interval=${iv}&range=${rg}`, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(String(res.status));
    const r = (await res.json()).chart?.result?.[0], q = r?.indicators?.quote?.[0]; if (!r?.timestamp || !q) throw new Error('vazio');
    const d = dec(q.close.find((x: any) => x != null) || 1), f = (n: number) => +n.toFixed(d);
    let out = r.timestamp.map((t: number, i: number) => ({ time: t, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], vol: q.volume?.[i] || 0 })).filter((c: any) => c.open != null && c.high != null && c.low != null && c.close != null).map((c: any) => ({ ...c, open: f(c.open), high: f(c.high), low: f(c.low), close: f(c.close) }));
    if (tf === '4h') out = agg(out, 14400);
    if (out.length < 5) throw new Error('curto');
    out = out.slice(-1000); cache.set(key, { t: Date.now(), v: out }); return out;
  } catch { return hit && Date.now() - hit.t < 900000 ? hit.v : null; }
}
export async function candlesFor(symbol: string, tf: string) { const r = await marketCandles(symbol, tf); return r ? { candles: r, source: 'mercado' } : { candles: sampleCandles(symbol, tf), source: 'exemplo' }; }
const px = async (sy: string) => { const r = await marketCandles(sy, '5m'); return { c: (r ? r[r.length - 1].close : last(sy)) as number, real: !!r }; };
export async function previewTrade(history: string | null, syms: string[]) {
  if (history) return { deals: [], preview: true };
  const quotes: any = {}, flags: boolean[] = [];
  for (const sy of syms) { const { c, real } = await px(sy), d = dec(c), sp = c * 0.00002; flags.push(real); quotes[sy] = { bid: +c.toFixed(d), ask: +(c + sp).toFixed(d) }; }
  const [E, G, X] = await Promise.all([px('EURUSD'), px('GBPUSD'), px('XAUUSD')]), e = E.c, g = G.c, x = X.c;
  return { preview: true, source: [...flags, E.real, G.real, X.real].every(Boolean) ? 'mercado' : 'exemplo', quotes,
    account: { balance: 10000, equity: 10009.3, margin: 108.2, freeMargin: 9901.1, marginLevel: 9251, currency: 'USD' },
    positions: [
      { id: 'ex1', symbol: 'EURUSD', type: 'POSITION_TYPE_BUY', volume: 0.1, openPrice: +(e - 0.0012).toFixed(5), currentPrice: +e.toFixed(5), stopLoss: +(e - 0.003).toFixed(5), takeProfit: +(e + 0.004).toFixed(5), profit: 12.4 },
      { id: 'ex2', symbol: 'XAUUSD', type: 'POSITION_TYPE_SELL', volume: 0.02, openPrice: +(x + 1.6).toFixed(2), currentPrice: +x.toFixed(2), stopLoss: +(x + 6).toFixed(2), takeProfit: +(x - 10).toFixed(2), profit: -3.1 }],
    orders: [{ id: 'ex3', symbol: 'GBPUSD', type: 'ORDER_TYPE_BUY_LIMIT', currentVolume: 0.05, openPrice: +(g - 0.004).toFixed(5), stopLoss: +(g - 0.008).toFixed(5), takeProfit: +(g + 0.006).toFixed(5) }] };
}
