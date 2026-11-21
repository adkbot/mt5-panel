'use client';
import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { DEFAULT_CODE } from '@/lib/defaultIndicator';
import { api, inp, btn, runIndicator, PAL } from '@/lib/ui';

const TF: Record<string, string> = { M1: '1m', M5: '5m', M15: '15m', M30: '30m', H1: '1h', H4: '4h', D1: '1d' };
const T = (s: string) => s.replace(/^(POSITION|ORDER|DEAL)_TYPE_/, '').replace('_', ' ').toLowerCase();
const col = (n: number) => (n >= 0 ? '#30a46c' : '#e5484d');
const n2 = (n: any) => (n ? String(n) : '');
const TABS: [string, string][] = [['quotes', 'Cotações'], ['chart', 'Gráfico'], ['trade', 'Negociação'], ['hist', 'Histórico'], ['agent', 'Agentes'], ['ind', 'Indicadores']];
const TS: Record<string, number> = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400 };
const AI_DEF: Record<string, string> = { gemini: 'gemini-2.5-flash', openrouter: 'anthropic/claude-sonnet-4.5', openai: 'gpt-4o-mini', anthropic: 'claude-sonnet-5-5', custom: '' };
const AI_NAME: Record<string, string> = { gemini: 'Google Gemini', openrouter: 'OpenRouter', openai: 'OpenAI', anthropic: 'Anthropic', custom: 'Endpoint customizado' };
const nyHour = () => +new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }).format(new Date());
const J = (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };

export default function Terminal({ onOut }: { onOut: () => void }) {
  const [tab, setTab] = useState('chart'), [symbol, setSymbol] = useState('EURUSD'), [tf, setTf] = useState('M5'), [lot, setLot] = useState(0.01);
  const [watch, setWatch] = useState<string[]>(['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD']);
  const [d, setD] = useState<any>(null), [hist, setHist] = useState<any[]>([]), [msg, setMsg] = useState('');
  const [dlg, setDlg] = useState(false), [f, setF] = useState({ type: 'MARKET', price: '', sl: '', tp: '' });
  const [inds, setInds] = useState<any[]>([{ id: 'd', name: 'Pré-Tóquio + VWAP', code: DEFAULT_CODE }]), [sel, setSel] = useState('d');
  const [code, setCode] = useState(DEFAULT_CODE), [applied, setApplied] = useState(DEFAULT_CODE);
  const [mql, setMql] = useState(''), [mqlName, setMqlName] = useState(''), [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<any>(null), [cfgOpen, setCfgOpen] = useState(false), [aiBusy, setAiBusy] = useState(false), [aiMsg, setAiMsg] = useState<[boolean, string] | null>(null);
  const [af, setAf] = useState({ provider: 'gemini', apiKey: '', model: AI_DEF.gemini, baseUrl: '', show: false });
  useEffect(() => { try { const x = JSON.parse(localStorage.getItem('aiform') || 'null'); if (x) setAf(a => ({ ...a, ...x })); } catch {} api('/api/ai/settings').then(x => { if (!x.error) setAi(x); }); }, []);
  // Salva no servidor (cookie criptografado), testa a chave na hora e ativa; só provedor/modelo ficam no localStorage, nunca a chave
  const saveAi = async () => {
    setAiBusy(true); setAiMsg(null);
    const { show, ...body } = af; const r = await api('/api/ai/settings', 'POST', body); setAiBusy(false);
    if (r.error) return setAiMsg([false, r.error]);
    setAi(r); setAf({ ...af, apiKey: '' }); setAiMsg([true, 'IA conectada e ativa']);
    try { localStorage.setItem('aiform', JSON.stringify({ provider: af.provider, model: af.model, baseUrl: af.baseUrl })); } catch {}
  };

  useEffect(() => {
    try { const w = JSON.parse(localStorage.getItem('watch') || 'null'); if (w?.length) setWatch(w); } catch {}
    api('/api/store').then(s => { const i = s.indicators; if (i?.length) { setInds(i); setSel(i[0].id); setCode(i[0].code); setApplied(i[0].code); }
      if (s.profile) setProf(s.profile); if (s.guard) setGuard(s.guard); if (s.journal) { jnRef.current = s.journal; setJn(s.journal); } });
  }, []);
  const saveW = (w: string[]) => { setWatch(w); try { localStorage.setItem('watch', JSON.stringify(w)); } catch {} };
  const persist = (l: any[]) => { setInds(l); api('/api/store', 'PUT', { key: 'indicators', value: l }); };
  const pick = (id: string, l = inds) => { const i = l.find(x => x.id === id); if (i) { setSel(id); setCode(i.code); setApplied(i.code); } };

  const refresh = async () => { const r = await api(`/api/trade?q=${[...new Set([symbol, ...watch])].join(',')}`); if (!r.error) setD(r); };
  useEffect(() => { refresh(); const t = setInterval(refresh, 2000); return () => clearInterval(t); }, [symbol, watch]);
  useEffect(() => { if (tab === 'hist') api('/api/trade?history=7').then(r => setHist(r.deals || [])); }, [tab]);

  const act = async (body: any, src = 'user') => { setMsg(''); const r = await api('/api/trade', 'POST', body); setMsg(r.error || 'Ordem executada'); if (!r.error && (body.action === 'buy' || body.action === 'sell') && r.positionId) journalAdd(body, r, src); refresh(); return !r.error; };
  const edit = (label: string, cur: any) => { const v = prompt(label, n2(cur)); return v === null ? undefined : v; };
  const q = d?.quotes?.[symbol];

  // gráfico com atualização contínua
  useEffect(() => {
    if (tab !== 'chart') return;
    const el = document.getElementById('chart'); if (!el) return;
    const chart = createChart(el, { height: 360, layout: { background: { color: '#0e1116' }, textColor: '#9aa4b2' }, grid: { vertLines: { color: '#171c24' }, horzLines: { color: '#171c24' } }, timeScale: { timeVisible: true } });
    const cs = chart.addCandlestickSeries(), lines: any = {}; let dead = false, first = true;
    const load = async () => {
      const r = await api(`/api/candles?symbol=${symbol}&tf=${TF[tf]}`); if (dead) return; if (r.error) return setMsg(r.error);
      cs.setData(r.candles);
      const o = await runIndicator(applied, r.candles); if (dead) return;
      indRef.current = { ...o, lastTime: r.candles[r.candles.length - 1]?.time };
      if (o?.error) setMsg('Indicador: ' + o.error);
      Object.keys(o?.lines || {}).forEach((n, i) => { (lines[n] ??= chart.addLineSeries({ color: PAL[i % 6], lineWidth: 1, priceLineVisible: false })).setData(o.lines[n]); });
      cs.setMarkers((o?.signals || []).map((s: any) => ({ time: s.time, position: s.type === 'V' ? 'aboveBar' : 'belowBar', shape: s.type === 'C' ? 'arrowUp' : s.type === 'V' ? 'arrowDown' : 'circle', color: s.type === 'C' ? '#30a46c' : s.type === 'V' ? '#e5484d' : '#9aa4b2', text: s.type })));
      if (first) { chart.timeScale().fitContent(); first = false; }
    };
    load(); const t = setInterval(load, 10000);
    return () => { dead = true; clearInterval(t); chart.remove(); };
  }, [tab, symbol, tf, applied]);

  const [jn, setJn] = useState<any[]>([]), jnRef = useRef<any[]>([]);
  const indRef = useRef<any>(null), acted = useRef(0), running = useRef(false);
  const [prof, setProf] = useState<any>(null), [auto, setAuto] = useState(false), [log, setLog] = useState<string[]>([]), [learning, setLearning] = useState(false);
  const [guard, setGuard] = useState({ lotMax: 0.1, lossMax: 50, perDay: 3 });
  useEffect(() => { acted.current = +(localStorage.getItem('acted') || 0); }, []);
  const [srv, setSrv] = useState<any>(null), [srvSt, setSrvSt] = useState<any>(null), [srvBusy, setSrvBusy] = useState(false);
  const loadSrv = () => api('/api/store').then(s => { if (!s.error) { setSrv(s.auto || null); setSrvSt(s.autostate || null); } });
  useEffect(() => { if (tab !== 'agent') return; loadSrv(); const t = setInterval(loadSrv, 15000); return () => clearInterval(t); }, [tab]);
  const toggleSrv = async () => {
    const on = !srv?.enabled;
    if (on && !confirm(`Ligar o automático 24h em ${symbol} ${tf}? O servidor vai enviar ordens reais na conta conectada, mesmo com o painel fechado, com no máx. ${guard.lotMax} lote e perda diária de ${guard.lossMax}.`)) return;
    setSrvBusy(true);
    if (on) await api('/api/store', 'PUT', { key: 'guard', value: guard });
    const r = await api('/api/auto', 'POST', { enabled: on, symbol, tf: TF[tf], code: applied });
    setSrvBusy(false); if (r.error) return setMsg(r.error);
    if (on) setAuto(false); loadSrv();
  };
  const setG = (g: any) => { setGuard(g); api('/api/store', 'PUT', { key: 'guard', value: g }); };

  // Agente de memória: cada entrada feita pelo painel é gravada com o contexto do indicador naquele momento
  const journalAdd = (b: any, r: any, src: string) => {
    const o = indRef.current, last = (a: any[]) => (a?.length ? a[a.length - 1] : null), ls = last(o?.signals || []);
    const ctx = { tf, nyHour: nyHour(), price: b.price ?? d?.quotes?.[b.symbol]?.[b.action === 'buy' ? 'ask' : 'bid'],
      lines: Object.fromEntries(Object.entries(o?.lines || {}).map(([k, v]: any) => [k, last(v)?.value])), lastSignal: ls?.type || null,
      barsSinceSignal: ls && o?.lastTime ? Math.round((o.lastTime - ls.time) / TS[tf]) : null };
    const e = { id: String(r.positionId), src, ts: Date.now(), symbol: b.symbol, side: b.action, lot: b.volume, sl: +b.sl || null, tp: +b.tp || null, ctx };
    const n = [...jnRef.current, e].slice(-200); jnRef.current = n; setJn(n); api('/api/store', 'PUT', { key: 'journal', value: n });
  };
  const jc = jn.filter((e: any) => e.src === 'user').length;

  // Agente analista: aprende o padrão do setup a partir do diário (só entradas manuais) e dos resultados
  const learn = async () => {
    setLearning(true); setMsg('Analisando suas entradas…');
    const deals = (await api('/api/trade?history=60')).deals || [];
    const entries = jnRef.current.filter((e: any) => e.src === 'user').map((e: any) => { const x = deals.find((y: any) => String(y.positionId) === e.id); return { ...e, outcome: x ? { profit: x.profit, exitPrice: x.price, exitTime: x.time } : null }; });
    const r = await api('/api/agent/learn', 'POST', { entries }); setLearning(false);
    if (r.error) return setMsg(r.error);
    setProf(r.profile); api('/api/store', 'PUT', { key: 'profile', value: r.profile }); setMsg('Perfil do setup atualizado');
  };

  // Agente executor: regras determinísticas do perfil, com travas de risco definidas pelo usuário
  useEffect(() => {
    if (!auto || !prof) return;
    const say = (m: string) => setLog(l => [new Date().toLocaleTimeString() + ' ' + m, ...l].slice(0, 30));
    const mark = (t: number) => { acted.current = t; try { localStorage.setItem('acted', String(t)); } catch {} };
    const tick = async () => {
      if (running.current) return; running.current = true;
      try {
        const r = await api(`/api/candles?symbol=${symbol}&tf=${TF[tf]}`); if (r.error) return say(r.error);
        const o = await runIndicator(applied, r.candles); if (!o?.signals) return;
        indRef.current = { ...o, lastTime: r.candles[r.candles.length - 1]?.time };
        const st = await api(`/api/trade?q=${symbol}`); if (st.error || !st.quotes?.[symbol]) return;
        const A = st.account, P = st.positions.filter((p: any) => p.symbol === symbol), q = st.quotes[symbol];
        const day = new Date().toDateString(); let d0 = J('day0', null); if (!d0 || d0.day !== day) d0 = { day, bal: A.balance, n: 0 };
        if (A.equity <= d0.bal - guard.lossMax) { setAuto(false); return say('Perda máxima do dia atingida. Automático desligado.'); }
        const last = o.signals[o.signals.length - 1]; if (!last || last.time <= acted.current) return;
        if (last.type === 'X') { if (prof.exit?.onX && P.length) { for (const p of P) await act({ action: 'close', positionId: p.id }, 'agent'); say('Saída pelo sinal X'); } return mark(last.time); }
        if (P.length) return;
        if (prof.trigger.signal !== 'both' && prof.trigger.signal !== last.type) return mark(last.time);
        const ago = r.candles.length - 1 - r.candles.findIndex((b: any) => b.time === last.time);
        if (ago > (prof.trigger.maxBarsAgo ?? 1)) return mark(last.time);
        const h = nyHour(); if (prof.hoursNY && !(h >= prof.hoursNY[0] && h < prof.hoursNY[1])) { say('Sinal fora do horário do setup'); return mark(last.time); }
        if (d0.n >= Math.min(prof.maxPerDay ?? 3, guard.perDay)) { say('Limite de operações do dia'); return mark(last.time); }
        const buy = last.type === 'C', px = buy ? q.ask : q.bid, dec = (String(q.bid).split('.')[1] || '').length, fx = (n: number) => +n.toFixed(dec);
        const dist = prof.sl.value, sl = fx(buy ? px - dist : px + dist), L = o.lines?.[prof.tp.line];
        const tp = prof.tp.mode === 'rr' ? fx(buy ? px + dist * prof.tp.value : px - dist * prof.tp.value) : L?.length ? fx(L[L.length - 1].value) : undefined;
        const vol = Math.min(prof.lot, guard.lotMax);
        mark(last.time);
        if (await act({ action: buy ? 'buy' : 'sell', symbol, volume: vol, sl, tp, price: px }, 'agent')) { d0.n++; try { localStorage.setItem('day0', JSON.stringify(d0)); } catch {} say(`${buy ? 'Compra' : 'Venda'} ${vol} ${symbol} · SL ${sl}${tp ? ' · TP ' + tp : ''}`); }
      } finally { running.current = false; }
    };
    tick(); const t = setInterval(tick, 15000); return () => clearInterval(t);
  }, [auto, prof, symbol, tf, applied, guard]);

  // Conversor automático MQL5 -> JS: converte, testa no sandbox com candles reais e se der erro devolve o erro para corrigir (até 3 tentativas)
  const convert = async () => {
    setBusy(true); setMsg('Convertendo…');
    const c = await api(`/api/candles?symbol=${symbol}&tf=${TF[tf]}`);
    let js = '', err = '', ok = false;
    for (let i = 0; i < 3 && !ok; i++) {
      const r = await api('/api/convert', 'POST', { mql, js, err });
      if (r.error) { err = r.error; break; }
      js = r.code;
      if (js.startsWith('// ERRO')) { err = js.slice(3); break; }
      const o = await runIndicator(js, c.candles || []);
      if (!o?.error && o?.lines) { ok = true; const ind = { id: String(Date.now()), name: mqlName || 'Convertido do MQL5', code: js }; const l = [...inds, ind]; persist(l); pick(ind.id, l); setTab('chart'); break; }
      err = o?.error || 'calculate não retornou { lines, signals }';
    }
    setMsg(ok ? 'Indicador convertido e aplicado no gráfico' : 'Não foi possível converter: ' + err);
    setBusy(false);
  };

  const A = d?.account, P: any[] = d?.positions || [], O: any[] = d?.orders || [];
  const cell = { padding: '6px 4px', borderBottom: '1px solid #262d38', fontSize: 13 } as const;
  const sm = (bg = '#262d38') => ({ ...btn(bg), flex: 'none', padding: '6px 10px', fontSize: 13 } as const);

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '12px 12px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <b>{symbol}</b>
        <span>{A ? <>Saldo {A.balance} · Equity {A.equity} <span style={{ color: col(A.equity - A.balance) }}>({(A.equity - A.balance).toFixed(2)})</span></> : '…'}</span>
        <button style={sm()} aria-label="Configurar IA" title="Configurar IA" onClick={() => setCfgOpen(true)}>⚙<span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, marginLeft: 5, background: ai?.configured ? '#30a46c' : '#e5484d' }} /></button>
        <button style={sm()} onClick={async () => { await api('/api/connect', 'DELETE'); onOut(); }}>Sair</button>
      </div>
      {msg && <p style={{ color: '#f5a524', margin: '4px 0' }}>{msg}</p>}

      {tab === 'quotes' && <>
        {watch.map(s => <div key={s} style={{ display: 'flex', justifyContent: 'space-between', ...cell, fontSize: 16 }} onClick={() => { setSymbol(s); setTab('chart'); }}>
          <b>{s}</b><span style={{ color: '#e5484d' }}>{d?.quotes?.[s]?.bid ?? '—'}</span><span style={{ color: '#3e63dd' }}>{d?.quotes?.[s]?.ask ?? '—'}</span>
          <button style={sm()} onClick={e => { e.stopPropagation(); saveW(watch.filter(x => x !== s)); }}>×</button></div>)}
        <button style={{ ...sm('#3e63dd'), marginTop: 10 }} onClick={() => { const s = prompt('Símbolo (como na sua corretora)')?.toUpperCase().trim(); if (s && !watch.includes(s)) saveW([...watch, s]); }}>+ Adicionar símbolo</button>
      </>}

      {tab === 'chart' && <>
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 6 }}>{Object.keys(TF).map(k => <button key={k} style={sm(k === tf ? '#3e63dd' : '#262d38')} onClick={() => setTf(k)}>{k}</button>)}</div>
        <div id="chart" />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button style={btn('#e5484d')} onClick={() => act({ action: 'sell', symbol, volume: lot })}>Vender {q?.bid}</button>
          <input style={{ ...inp, width: 80 }} type="number" step="0.01" value={lot} onChange={e => setLot(+e.target.value)} />
          <button style={btn('#3e63dd')} onClick={() => act({ action: 'buy', symbol, volume: lot })}>Comprar {q?.ask}</button>
        </div>
        <button style={{ ...sm(), width: '100%', marginTop: 8 }} onClick={() => setDlg(true)}>Nova ordem (mercado ou pendente)</button>
      </>}

      {tab === 'trade' && <>
        {A && <div style={{ fontSize: 13, color: '#9aa4b2', marginBottom: 8 }}>Margem {A.margin} · Livre {A.freeMargin} · Nível {A.marginLevel ? A.marginLevel.toFixed(0) + '%' : '—'}</div>}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <button style={sm('#3e63dd')} onClick={() => setDlg(true)}>Nova ordem</button>
          {[['all', 'Fechar tudo'], ['profit', 'Fechar lucro'], ['loss', 'Fechar prejuízo']].map(([m, t]) => <button key={m} style={sm('#e5484d')} onClick={() => confirm(t + '?') && act({ action: 'closeAll', mode: m })}>{t}</button>)}
        </div>
        <b>Posições ({P.length})</b>
        {P.map(p => <div key={p.id} style={cell}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><b>{p.symbol}</b> {T(p.type)} {p.volume}</span><b style={{ color: col(p.profit) }}>{p.profit.toFixed(2)}</b></div>
          <div style={{ color: '#9aa4b2' }}>{p.openPrice} → {p.currentPrice} · SL {n2(p.stopLoss) || '—'} · TP {n2(p.takeProfit) || '—'}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button style={sm()} onClick={() => { const sl = edit('Stop Loss', p.stopLoss); if (sl === undefined) return; const tp = edit('Take Profit', p.takeProfit); if (tp === undefined) return; act({ action: 'modify', positionId: p.id, sl, tp }); }}>Modificar</button>
            <button style={sm()} onClick={() => { const v = edit('Volume a fechar', p.volume); if (v) act({ action: 'close', positionId: p.id, volume: +v < p.volume ? v : undefined }); }}>Fechar parcial</button>
            <button style={sm('#e5484d')} onClick={() => act({ action: 'close', positionId: p.id })}>Fechar</button>
          </div></div>)}
        <b style={{ display: 'block', marginTop: 12 }}>Ordens pendentes ({O.length})</b>
        {O.map(o => <div key={o.id} style={cell}>
          <div><b>{o.symbol}</b> {T(o.type)} {o.currentVolume ?? o.volume} @ {o.openPrice} · SL {n2(o.stopLoss) || '—'} · TP {n2(o.takeProfit) || '—'}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button style={sm()} onClick={() => { const price = edit('Preço', o.openPrice); if (price === undefined) return; const sl = edit('Stop Loss', o.stopLoss); if (sl === undefined) return; const tp = edit('Take Profit', o.takeProfit); if (tp === undefined) return; act({ action: 'modifyOrder', orderId: o.id, price, sl, tp }); }}>Modificar</button>
            <button style={sm('#e5484d')} onClick={() => act({ action: 'cancel', orderId: o.id })}>Cancelar</button>
          </div></div>)}
      </>}

      {tab === 'hist' && <>
        <b>Últimos 7 dias</b>
        {hist.map(x => <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', ...cell }}>
          <span>{new Date(x.time).toLocaleString()} · <b>{x.symbol}</b> {T(x.type)} {x.volume}</span><b style={{ color: col(x.profit) }}>{(x.profit + (x.commission || 0) + (x.swap || 0)).toFixed(2)}</b></div>)}
        {!hist.length && <p style={{ color: '#9aa4b2' }}>Nenhuma operação fechada no período.</p>}
      </>}

      {tab === 'agent' && <>
        <b>Agentes do setup</b>
        <p style={{ color: '#9aa4b2', fontSize: 13 }}>Agente de memória: grava cada entrada que você faz neste painel com o contexto do indicador. Agente analista: aprende seu padrão. Agente executor: opera seguindo esse padrão quando o automático está ligado.</p>
        <p>Entradas memorizadas: <b>{jc}</b> {jc < 5 && <span style={{ color: '#f5a524' }}>(mínimo 5 para analisar)</span>}</p>
        <button style={{ ...btn('#3e63dd'), width: '100%' }} disabled={learning || jc < 5} onClick={learn}>{learning ? 'Analisando…' : 'Analisar meu setup'}</button>
        {prof && <div style={{ ...cell, fontSize: 13, marginTop: 8 }}>
          <p style={{ margin: '0 0 6px' }}>{prof.summary}</p>
          <div style={{ color: '#9aa4b2' }}>Gatilho: sinal {prof.trigger.signal === 'both' ? 'C ou V' : prof.trigger.signal} até {prof.trigger.maxBarsAgo} candle(s) depois · Horário NY: {prof.hoursNY ? prof.hoursNY.join('–') + 'h' : 'qualquer'}<br />Stop: {prof.sl.value} de preço · Alvo: {prof.tp.mode === 'rr' ? prof.tp.value + 'R' : 'linha ' + prof.tp.line} · Sai no X: {prof.exit?.onX ? 'sim' : 'não'} · Lote {prof.lot}</div></div>}
        <b style={{ display: 'block', marginTop: 12 }}>Travas de risco</b>
        <div style={{ display: 'flex', gap: 8, margin: '6px 0' }}>
          {([['lotMax', 'Lote máx.'], ['lossMax', 'Perda máx./dia'], ['perDay', 'Ordens/dia']] as const).map(([k, t]) => <label key={k} style={{ flex: 1, fontSize: 12, color: '#9aa4b2' }}>{t}<input style={inp} type="number" step="any" value={guard[k]} onChange={e => setG({ ...guard, [k]: +e.target.value })} /></label>)}</div>
        <button style={{ ...btn(auto ? '#e5484d' : '#30a46c'), width: '100%' }} disabled={!prof} onClick={() => { if (auto) return setAuto(false); if (guard.lotMax > 0 && guard.lossMax > 0 && confirm(`Ligar o automático em ${symbol} ${tf}? Ele envia ordens reais na conta conectada, com no máx. ${guard.lotMax} lote e perda diária de ${guard.lossMax}.`)) { setLog([]); setAuto(true); } }}>{auto ? 'Automático LIGADO · tocar para desligar' : 'Ligar automático'}</button>
        {auto && <p style={{ color: '#f5a524', fontSize: 12 }}>Mantenha o painel aberto e a tela ligada: o executor roda neste aparelho.</p>}
        <div style={{ ...cell, marginTop: 12 }}>
          <b>Automático 24h no servidor</b>
          <p style={{ color: '#9aa4b2', fontSize: 12, margin: '4px 0 8px' }}>Roda mesmo com o painel fechado, com as mesmas travas. Usa o símbolo, o timeframe e o indicador abertos agora.</p>
          <button style={{ ...btn(srv?.enabled ? '#e5484d' : '#30a46c'), width: '100%' }} disabled={!prof || srvBusy} onClick={toggleSrv}>{srv?.enabled ? `24h LIGADO em ${srv.symbol} ${srv.tf} · tocar para desligar` : 'Ligar automático 24h'}</button>
          {srv?.enabled && srvSt && <div style={{ fontSize: 12, color: '#9aa4b2', marginTop: 6 }}>Última checagem: {srvSt.lastRun ? new Date(srvSt.lastRun).toLocaleTimeString() : '—'}{srvSt.error ? ' · ' + srvSt.error : ''}</div>}
          {(srvSt?.log || []).slice(0, 8).map((l: string, i: number) => <div key={i} style={{ fontSize: 12, padding: '3px 0' }}>{l}</div>)}
        </div>
        {log.map((l, i) => <div key={i} style={{ ...cell, fontSize: 12 }}>{l}</div>)}
      </>}

      {tab === 'ind' && <>
        <b>Importar código MQL5</b>
        <input style={{ ...inp, margin: '8px 0' }} placeholder="Nome do indicador" value={mqlName} onChange={e => setMqlName(e.target.value)} />
        <textarea style={{ ...inp, height: 140, fontFamily: 'monospace', fontSize: 12 }} placeholder="Cole aqui o código .mq5 do indicador" value={mql} onChange={e => setMql(e.target.value)} spellCheck={false} />
        <button style={{ ...btn('#30a46c'), width: '100%', margin: '8px 0 16px' }} disabled={busy || !mql.trim()} onClick={convert}>{busy ? 'Convertendo e testando…' : 'Converter automaticamente e aplicar'}</button>
        <b>Meus indicadores</b>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select style={inp} value={sel} onChange={e => pick(e.target.value)}>{inds.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
          <button style={sm()} onClick={() => { const n = prompt('Nome do indicador'); if (!n) return; const i = { id: String(Date.now()), name: n, code: 'function calculate(candles) {\n  return { lines: {}, signals: [] };\n}' }; const l = [...inds, i]; persist(l); pick(i.id, l); }}>Novo</button>
        </div>
        <textarea style={{ ...inp, height: 260, fontFamily: 'monospace', fontSize: 12 }} value={code} onChange={e => setCode(e.target.value)} spellCheck={false} />
        <button style={{ ...btn('#3e63dd'), width: '100%', marginTop: 8 }} onClick={() => { persist(inds.map(i => i.id === sel ? { ...i, code } : i)); setApplied(code); setTab('chart'); }}>Salvar e aplicar no gráfico</button>
      </>}

      {cfgOpen && <div style={{ position: 'fixed', inset: 0, background: '#000b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 20 }} onClick={() => setCfgOpen(false)}>
        <div role="dialog" aria-label="Configurar IA" style={{ background: '#0e1116', border: '1px solid #262d38', borderRadius: 12, padding: 16, width: '100%', maxWidth: 400, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
          <b>Configurar IA</b>
          <p style={{ fontSize: 13, color: ai?.configured ? '#30a46c' : '#9aa4b2', margin: '6px 0 10px' }}>{ai?.configured ? `Ativa: ${AI_NAME[ai.provider] || ai.provider} · ${ai.model} · chave …${ai.last4}${ai.source === 'env' ? ' (do servidor)' : ''}` : 'Nenhuma IA ativa'}</p>
          <select style={{ ...inp, marginBottom: 8 }} value={af.provider} onChange={e => { const p = e.target.value; setAf({ ...af, provider: p, model: !af.model || Object.values(AI_DEF).includes(af.model) ? AI_DEF[p] : af.model }); }}>
            {Object.keys(AI_NAME).map(k => <option key={k} value={k}>{AI_NAME[k]}</option>)}</select>
          {af.provider === 'custom' && <input style={{ ...inp, marginBottom: 8 }} placeholder="URL base (https://…/v1)" value={af.baseUrl} onChange={e => setAf({ ...af, baseUrl: e.target.value })} />}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input style={inp} type={af.show ? 'text' : 'password'} placeholder="API Key" autoComplete="off" value={af.apiKey} onChange={e => setAf({ ...af, apiKey: e.target.value })} />
            <button style={sm()} onClick={() => setAf({ ...af, show: !af.show })}>{af.show ? 'Ocultar' : 'Mostrar'}</button></div>
          <input style={{ ...inp, marginBottom: 8 }} placeholder="Modelo" value={af.model} onChange={e => setAf({ ...af, model: e.target.value })} />
          {aiMsg && <p role="alert" style={{ fontSize: 13, color: aiMsg[0] ? '#30a46c' : '#e5484d', margin: '0 0 8px' }}>{aiMsg[1]}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn('#3e63dd')} disabled={aiBusy || !af.apiKey} onClick={saveAi}>{aiBusy ? 'Conectando…' : 'Salvar e conectar'}</button>
            <button style={btn('#262d38')} onClick={() => setCfgOpen(false)}>Fechar</button></div>
        </div></div>}

      {dlg && <div style={{ position: 'fixed', inset: 0, background: '#000b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#0e1116', border: '1px solid #262d38', borderRadius: 12, padding: 16, width: '100%', maxWidth: 380 }}>
          <b>Nova ordem · {symbol}</b>
          <select style={{ ...inp, margin: '8px 0' }} value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
            <option value="MARKET">Execução a mercado</option><option value="BUY_LIMIT">Buy Limit</option><option value="SELL_LIMIT">Sell Limit</option><option value="BUY_STOP">Buy Stop</option><option value="SELL_STOP">Sell Stop</option></select>
          <input style={{ ...inp, marginBottom: 8 }} type="number" step="0.01" placeholder="Volume (lotes)" value={lot} onChange={e => setLot(+e.target.value)} />
          {f.type !== 'MARKET' && <input style={{ ...inp, marginBottom: 8 }} type="number" placeholder="Preço" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} />}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input style={inp} type="number" placeholder="Stop Loss" value={f.sl} onChange={e => setF({ ...f, sl: e.target.value })} />
            <input style={inp} type="number" placeholder="Take Profit" value={f.tp} onChange={e => setF({ ...f, tp: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            {f.type === 'MARKET' ? <>
              <button style={btn('#e5484d')} onClick={async () => (await act({ action: 'sell', symbol, volume: lot, sl: f.sl, tp: f.tp })) && setDlg(false)}>Vender {q?.bid}</button>
              <button style={btn('#3e63dd')} onClick={async () => (await act({ action: 'buy', symbol, volume: lot, sl: f.sl, tp: f.tp })) && setDlg(false)}>Comprar {q?.ask}</button></> :
              <button style={btn('#3e63dd')} onClick={async () => (await act({ action: 'pending', type: f.type, symbol, volume: lot, price: f.price, sl: f.sl, tp: f.tp })) && setDlg(false)}>Enviar ordem</button>}
            <button style={btn('#262d38')} onClick={() => setDlg(false)}>Cancelar</button></div>
        </div></div>}

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', background: '#171c24', borderTop: '1px solid #262d38', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(([k, t]) => <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '14px 2px', border: 0, background: 'none', color: tab === k ? '#3e63dd' : '#9aa4b2', fontSize: 12, fontWeight: tab === k ? 700 : 400 }}>{t}</button>)}
      </nav>
    </main>
  );
}
