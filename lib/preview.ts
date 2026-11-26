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
export function previewTrade(history: string | null, syms: string[]) {
  if (history) return { deals: [], preview: true };
  const quotes: any = {};
  for (const s of syms) { const c = last(s), d = dec(c), sp = c * 0.00002; quotes[s] = { bid: +c.toFixed(d), ask: +(c + sp).toFixed(d) }; }
  const e = last('EURUSD'), g = last('GBPUSD'), x = last('XAUUSD');
  return { preview: true, quotes,
    account: { balance: 10000, equity: 10009.3, margin: 108.2, freeMargin: 9901.1, marginLevel: 9251, currency: 'USD' },
    positions: [
      { id: 'ex1', symbol: 'EURUSD', type: 'POSITION_TYPE_BUY', volume: 0.1, openPrice: +(e - 0.0012).toFixed(5), currentPrice: +e.toFixed(5), stopLoss: +(e - 0.003).toFixed(5), takeProfit: +(e + 0.004).toFixed(5), profit: 12.4 },
      { id: 'ex2', symbol: 'XAUUSD', type: 'POSITION_TYPE_SELL', volume: 0.02, openPrice: +(x + 1.6).toFixed(2), currentPrice: +x.toFixed(2), stopLoss: +(x + 6).toFixed(2), takeProfit: +(x - 10).toFixed(2), profit: -3.1 }],
    orders: [{ id: 'ex3', symbol: 'GBPUSD', type: 'ORDER_TYPE_BUY_LIMIT', currentVolume: 0.05, openPrice: +(g - 0.004).toFixed(5), stopLoss: +(g - 0.008).toFixed(5), takeProfit: +(g + 0.006).toFixed(5) }] };
}
