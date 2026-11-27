import { DEFAULT_CODE } from './defaultIndicator';
// Biblioteca de indicadores prontos (JavaScript puro; rodam no navegador e no worker 24h).
export const LIB: { id: string; name: string; desc: string; code: string }[] = [
  { id: 'pretokyo', name: 'Pré-Tóquio + VWAP', desc: 'Faixa Pré-Tóquio (18h-20h NY), VWAP ancorada e sinais de varredura de liquidez', code: DEFAULT_CODE },
  { id: 'ema', name: 'EMA 20 / 50 + cruzamento', desc: 'Duas médias exponenciais; seta quando a rápida cruza a lenta', code: `function calculate(c) {
  const ema = p => { const k = 2 / (p + 1); let e = null; return c.map(x => { e = e === null ? x.close : x.close * k + e * (1 - k); return { time: x.time, value: e }; }); };
  const a = ema(20), b = ema(50), s = [];
  for (let i = 51; i < c.length; i++) { const up = a[i].value > b[i].value, was = a[i - 1].value > b[i - 1].value; if (up && !was) s.push({ time: c[i].time, type: 'C' }); if (!up && was) s.push({ time: c[i].time, type: 'V' }); }
  return { lines: { 'EMA 20': a, 'EMA 50': b }, signals: s };
}` },
  { id: 'sma200', name: 'Média simples 200', desc: 'Tendência de longo prazo', code: `function calculate(c) {
  const out = []; let sum = 0;
  for (let i = 0; i < c.length; i++) { sum += c[i].close; if (i >= 200) sum -= c[i - 200].close; if (i >= 199) out.push({ time: c[i].time, value: sum / 200 }); }
  return { lines: { 'SMA 200': out }, signals: [] };
}` },
  { id: 'bb', name: 'Bandas de Bollinger (20, 2)', desc: 'Média de 20 períodos com bandas a 2 desvios', code: `function calculate(c) {
  const P = 20, K = 2, u = [], m = [], l = [];
  for (let i = P - 1; i < c.length; i++) {
    let s = 0; for (let j = i - P + 1; j <= i; j++) s += c[j].close;
    const mean = s / P; let v = 0; for (let j = i - P + 1; j <= i; j++) v += (c[j].close - mean) * (c[j].close - mean);
    const sd = Math.sqrt(v / P);
    u.push({ time: c[i].time, value: mean + K * sd }); m.push({ time: c[i].time, value: mean }); l.push({ time: c[i].time, value: mean - K * sd });
  }
  return { lines: { 'Banda superior': u, 'Média 20': m, 'Banda inferior': l }, signals: [] };
}` },
  { id: 'vwap', name: 'VWAP diária', desc: 'Preço médio ponderado por volume, reinicia a cada dia (UTC)', code: `function calculate(c) {
  const out = []; let day = '', pv = 0, v = 0;
  for (const k of c) { const d = new Date(k.time * 1000).toISOString().slice(0, 10); if (d !== day) { day = d; pv = 0; v = 0; } const vol = k.vol || 1; pv += (k.high + k.low + k.close) / 3 * vol; v += vol; out.push({ time: k.time, value: pv / v }); }
  return { lines: { 'VWAP diária': out }, signals: [] };
}` },
  { id: 'zigzag', name: 'ZigZag (3 x ATR)', desc: 'Liga topos e fundos relevantes; reversão de 3 vezes o ATR(14)', code: `function calculate(c) {
  const n = c.length; if (n < 20) return { lines: {}, signals: [] };
  const tr = c.map((x, i) => i ? Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close)) : x.high - x.low);
  const atr = []; let a = 0; for (let i = 0; i < n; i++) { a = i < 14 ? (a * i + tr[i]) / (i + 1) : (a * 13 + tr[i]) / 14; atr.push(a); }
  let dir = 0, hi = c[0].high, hiI = 0, lo = c[0].low, loI = 0; const piv = [];
  for (let i = 1; i < n; i++) {
    if (c[i].high > hi) { hi = c[i].high; hiI = i; } if (c[i].low < lo) { lo = c[i].low; loI = i; }
    const th = 3 * atr[i];
    if (dir >= 0 && hi - c[i].low >= th) { piv.push({ i: hiI, v: hi }); dir = -1; lo = c[i].low; loI = i; hi = c[i].high; hiI = i; }
    else if (dir <= 0 && c[i].high - lo >= th) { piv.push({ i: loI, v: lo }); dir = 1; hi = c[i].high; hiI = i; lo = c[i].low; loI = i; }
  }
  piv.push(dir > 0 ? { i: hiI, v: hi } : { i: loI, v: lo });
  const pts = []; let last = -1; for (const p of piv) { if (p.i > last) { pts.push({ time: c[p.i].time, value: p.v }); last = p.i; } }
  return { lines: { 'ZigZag': pts }, signals: [] };
}` },
];
