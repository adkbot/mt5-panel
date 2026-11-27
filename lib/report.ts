// Relatório de trading a partir das operações fechadas (como o relatório do MT5: resumo, lucro/prejuízo, compra/venda, símbolos, riscos).
export function report(deals: any[]) {
  const rows = deals.map(d => ({ ...d, net: (d.profit || 0) + (d.commission || 0) + (d.swap || 0), long: /SELL/.test(d.type) })) // deal de saída SELL fecha uma posição comprada
    .sort((a, b) => +new Date(a.time) - +new Date(b.time));
  const wins = rows.filter(r => r.net > 0), loss = rows.filter(r => r.net < 0), sum = (a: any[]) => a.reduce((t, r) => t + r.net, 0);
  const gp = sum(wins), gl = -sum(loss); let cum = 0, peak = 0, dd = 0, cl = 0, mcl = 0;
  const curve = rows.map(r => { cum += r.net; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); cl = r.net < 0 ? cl + 1 : 0; mcl = Math.max(mcl, cl); return cum; });
  const by: Record<string, { n: number; net: number }> = {}; rows.forEach(r => { const b = (by[r.symbol] ||= { n: 0, net: 0 }); b.n++; b.net += r.net; });
  const side = (l: boolean) => { const a = rows.filter(r => r.long === l); return { n: a.length, net: sum(a), win: a.filter(r => r.net > 0).length }; };
  return { n: rows.length, wins: wins.length, losses: loss.length, winRate: rows.length ? wins.length / rows.length : 0, net: sum(rows), gp, gl,
    pf: gl ? gp / gl : gp ? Infinity : 0, avgWin: wins.length ? gp / wins.length : 0, avgLoss: loss.length ? -gl / loss.length : 0,
    best: rows.length ? Math.max(...rows.map(r => r.net)) : 0, worst: rows.length ? Math.min(...rows.map(r => r.net)) : 0, dd, mcl, curve,
    bySymbol: Object.entries(by).sort((a, b) => b[1].net - a[1].net), long: side(true), short: side(false) };
}
