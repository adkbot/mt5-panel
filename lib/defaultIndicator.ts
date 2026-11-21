// Formato do indicador do usuário: defina function calculate(candles) e devolva { lines, signals }.
// candles: [{time (seg), open, high, low, close, vol}]  ·  signals.type: 'C' compra, 'V' venda, 'X' saída
export const DEFAULT_CODE = `function calculate(c) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const ny = (t) => { const p = Object.fromEntries(fmt.formatToParts(new Date(t * 1000)).map(x => [x.type, x.value]));
    const s = new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) + 6 * 3600e3);
    return { key: s.toISOString().slice(0, 10), inRange: s.getUTCHours() < 2 }; };
  const out = { lines: { preHigh: [], preLow: [], vwap: [] }, signals: [] };
  let key = '', hi = 0, lo = 0, pv = 0, v = 0, pos = null;
  c.forEach((k, i) => {
    const s = ny(k.time);
    if (s.key !== key) { key = s.key; hi = -Infinity; lo = Infinity; pv = 0; v = 0; pos = null; }
    const vol = k.vol || 1; pv += ((k.high + k.low + k.close) / 3) * vol; v += vol; const vwap = pv / v;
    if (s.inRange) { hi = Math.max(hi, k.high); lo = Math.min(lo, k.low); return; }
    if (!isFinite(hi)) return;
    out.lines.preHigh.push({ time: k.time, value: hi }); out.lines.preLow.push({ time: k.time, value: lo }); out.lines.vwap.push({ time: k.time, value: vwap });
    const prev = c[i - 1] ? c[i - 1].close : k.close;
    if (pos === 'C' && (k.high >= hi || k.close < vwap)) { out.signals.push({ time: k.time, type: 'X' }); pos = null; }
    else if (pos === 'V' && (k.low <= lo || k.close > vwap)) { out.signals.push({ time: k.time, type: 'X' }); pos = null; }
    else if (!pos && k.low <= lo && k.close > lo && prev <= k.close && k.close >= vwap) { out.signals.push({ time: k.time, type: 'C' }); pos = 'C'; }
    else if (!pos && k.high >= hi && k.close < hi && prev >= k.close && k.close <= vwap) { out.signals.push({ time: k.time, type: 'V' }); pos = 'V'; }
  });
  return out;
}`;
