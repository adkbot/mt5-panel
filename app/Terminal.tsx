'use client';
import { useEffect, useRef, useState } from 'react';
import { createChart, LineStyle } from 'lightweight-charts';
import { DEFAULT_CODE } from '@/lib/defaultIndicator';
import { LIB } from '@/lib/library';
import { report } from '@/lib/report';
import { api, inp, btn, runIndicator, PAL } from '@/lib/ui';

const TF: Record<string, string> = { M1: '1m', M5: '5m', M15: '15m', M30: '30m', H1: '1h', H4: '4h', D1: '1d' };
const T = (s: string) => s.replace(/^(POSITION|ORDER|DEAL)_TYPE_/, '').replace('_', ' ').toLowerCase();
const col = (n: number) => (n >= 0 ? '#4c8dff' : '#ff453a');
const dg = (n: number) => (n < 10 ? 5 : n < 500 ? 3 : 2);
const BUY = '#4c8dff', SELL = '#ff453a', GRAY = '#8e8e93', LINE = '#1c1c1e';
const n2 = (n: any) => (n ? String(n) : '');
const TABS: [string, string][] = [['quotes', 'Cotações'], ['chart', 'Gráfico'], ['trade', 'Negociação'], ['hist', 'Histórico'], ['agent', 'Agentes'], ['ai', 'Assistente'], ['ind', 'Indicadores']];
const IC: Record<string, any> = {
  quotes: <path d="M4 6h16M4 12h16M4 18h10" />,
  chart: <><path d="M7 3v3M7 14v4M17 5v3M17 17v3" /><rect x="5" y="6" width="4" height="8" /><rect x="15" y="8" width="4" height="9" /></>,
  trade: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
  hist: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></>,
  agent: <><rect x="5" y="8" width="14" height="10" rx="2" /><path d="M12 4v4M9 13h.01M15 13h.01M9 17h6" /></>,
  ai: <path d="M5 6h14v9H9l-4 4V6z" />,
  ind: <path d="M5 18c3 0 3-12 6-12M8 11h6M14 17l5-6M19 17l-5-6" />,
};
const TS: Record<string, number> = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400 };
const AI_DEF: Record<string, string> = { gemini: 'gemini-2.5-flash', openrouter: 'anthropic/claude-sonnet-4.5', openai: 'gpt-4o-mini', anthropic: 'claude-sonnet-5-5', custom: '' };
const AI_NAME: Record<string, string> = { gemini: 'Google Gemini', openrouter: 'OpenRouter', openai: 'OpenAI', anthropic: 'Anthropic', custom: 'Endpoint customizado' };
const ha = (c: any[]) => { let po = 0, pc = 0; return c.map((k, i) => { const cl = (k.open + k.high + k.low + k.close) / 4, op = i ? (po + pc) / 2 : (k.open + k.close) / 2; po = op; pc = cl; return { time: k.time, open: op, close: cl, high: Math.max(k.high, op, cl), low: Math.min(k.low, op, cl) }; }); };
const fmtT = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` : `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`);
const money = (n: number) => (n < 0 ? '-' : '') + Math.abs(n).toFixed(2);
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
    api('/api/store').then(s => { const i = s.indicators; if (i?.length) { setInds(i); setSel(i[0].id); setCode(i[0].code); setApplied(i[0].code); setActIds(a => (a.length ? a : [i[0].id])); }
      if (s.profile) setProf(s.profile); if (s.guard) setGuard(s.guard); if (s.journal) { jnRef.current = s.journal; setJn(s.journal); } });
  }, []);
  const saveW = (w: string[]) => { setWatch(w); try { localStorage.setItem('watch', JSON.stringify(w)); } catch {} };
  const persist = (l: any[]) => { setInds(l); api('/api/store', 'PUT', { key: 'indicators', value: l }); };
  const pick = (id: string, l = inds) => { const i = l.find(x => x.id === id); if (i) { setSel(id); setCode(i.code); setApplied(i.code); } };

  const refresh = async () => { const r = await api(`/api/trade?q=${[...new Set([symbol, ...watch])].join(',')}`); if (!r.error) setD(r); };
  useEffect(() => { refresh(); const t = setInterval(refresh, 2000); return () => clearInterval(t); }, [symbol, watch]);
  const [hv, setHv] = useState('list'), [histDays, setHistDays] = useState(7), [symList, setSymList] = useState<string[]>([]), [addSym, setAddSym] = useState('');
  useEffect(() => { if (tab === 'hist') api(`/api/trade?history=${histDays}`).then(r => setHist(r.deals || [])); }, [tab, histDays]);
  useEffect(() => { api('/api/trade?symbols=1').then(r => { if (r.symbols) setSymList(r.symbols); }); }, []);

  const act = async (body: any, src = 'user') => { setMsg(''); const r = await api('/api/trade', 'POST', body); setMsg(r.error || 'Ordem executada'); if (!r.error && (body.action === 'buy' || body.action === 'sell') && r.positionId) journalAdd(body, r, src); refresh(); return !r.error; };
  const edit = (label: string, cur: any) => { const v = prompt(label, n2(cur)); return v === null ? undefined : v; };
  const q = d?.quotes?.[symbol];

  // gráfico estilo MT5: tema claro/escuro, vários indicadores, legenda e linhas das posições
  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>('dark'), [actIds, setActIds] = useState<string[]>(['d']), [oneClick, setOneClick] = useState(true);
  const [legend, setLegend] = useState<any[]>([]), [showInd, setShowInd] = useState(false), [chartVer, setChartVer] = useState(0);
  const csRef = useRef<any>(null), plRef = useRef<any[]>([]);
  useEffect(() => { try { const t0 = localStorage.getItem('chartTheme'); if (t0 === 'light' || t0 === 'auto') setTheme(t0); if (localStorage.getItem('oneClick') === '0') setOneClick(false); const a = JSON.parse(localStorage.getItem('actIds') || 'null'); if (Array.isArray(a) && a.length) setActIds(a); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('actIds', JSON.stringify(actIds)); localStorage.setItem('chartTheme', theme); localStorage.setItem('oneClick', oneClick ? '1' : '0'); } catch {} }, [actIds, theme, oneClick]);
  const [sysDark, setSysDark] = useState(true), [ctype, setCtype] = useState<'candle' | 'ha' | 'line'>('candle'), [hover, setHover] = useState<any>(null), [, setClock] = useState(0);
  const barT = useRef(0), lsRef = useRef<any[]>([]);
  useEffect(() => { const m = window.matchMedia('(prefers-color-scheme: dark)'), f = () => setSysDark(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  const dk = theme === 'dark' || (theme === 'auto' && sysDark);
  const th = dk ? { bg: '#000000', tx: '#c8c8c8', gr: '#3a3a3a' } : { bg: '#ffffff', tx: '#222222', gr: '#d4d4d4' };
  const shown = inds.filter(i => actIds.includes(i.id)), shownKey = shown.map(i => i.id + ':' + i.code).join('|');
  useEffect(() => {
    if (tab !== 'chart') return;
    const el = document.getElementById('chart'); if (!el) return;
    const chart = createChart(el, { autoSize: true, layout: { background: { color: th.bg }, textColor: th.tx }, grid: { vertLines: { color: th.gr, style: LineStyle.Dotted }, horzLines: { color: th.gr, style: LineStyle.Dotted } }, crosshair: { mode: 0 }, rightPriceScale: { borderColor: th.gr }, timeScale: { timeVisible: true, borderColor: th.gr } } as any);
    const G = '#00c853', cs: any = ctype === 'line' ? chart.addLineSeries({ color: '#4c8dff', lineWidth: 2, priceLineColor: '#9e9e9e', priceLineStyle: LineStyle.Dotted } as any)
      : chart.addCandlestickSeries({ upColor: '#ffffff', downColor: '#000000', borderUpColor: G, borderDownColor: G, wickUpColor: G, wickDownColor: G, priceLineColor: '#9e9e9e', priceLineStyle: LineStyle.Dotted } as any);
    const conv = (c: any[]) => (ctype === 'line' ? c.map(k => ({ time: k.time, value: k.close })) : ctype === 'ha' ? ha(c) : c);
    csRef.current = cs; plRef.current = []; lsRef.current = []; setChartVer(v => v + 1);
    const lines: any = {}; let dead = false, first = true, lastBar: any = null;
    chart.subscribeCrosshairMove((pm: any) => { // janela de dados: OHLC e valores dos indicadores sob o cursor
      if (!pm.time) return setHover(null);
      const dd: any = pm.seriesData.get(cs), vals: any = {}; lsRef.current.forEach(l => { const v: any = pm.seriesData.get(l.series); if (v) vals[l.name] = v.value; });
      setHover({ o: dd?.open, h: dd?.high, l: dd?.low, c: dd?.close ?? dd?.value, vals });
    });
    const load = async () => {
      const r = await api(`/api/candles?symbol=${symbol}&tf=${TF[tf]}`); if (dead) return; if (r.error) return setMsg(r.error);
      const pr = dg(r.candles[r.candles.length - 1]?.close || 1); cs.applyOptions({ priceFormat: { type: 'price', precision: pr, minMove: 1 / 10 ** pr } } as any);
      cs.setData(conv(r.candles)); lastBar = r.candles.length ? { ...r.candles[r.candles.length - 1] } : null; barT.current = lastBar?.time || 0;
      const outs = await Promise.all(shown.map(i => runIndicator(i.code, r.candles))); if (dead) return;
      const mk: any[] = [], lg: any[] = [], ls: any[] = []; let ci = 0;
      outs.forEach((o, k) => {
        if (o?.error) { setMsg(`Indicador "${shown[k].name}": ${o.error}`); return; }
        if (shown[k].id === sel || !indRef.current) indRef.current = { ...o, lastTime: r.candles[r.candles.length - 1]?.time };
        Object.keys(o?.lines || {}).forEach(n => {
          const color = PAL[ci++ % PAL.length], key = shown[k].id + n, name = `${shown[k].name} · ${n}`;
          const ser = (lines[key] ??= chart.addLineSeries({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false })); ser.setData(o.lines[n]);
          ls.push({ name, series: ser }); lg.push({ name, color, value: o.lines[n][o.lines[n].length - 1]?.value });
        });
        (o?.signals || []).forEach((sg: any) => mk.push({ time: sg.time, position: sg.type === 'V' ? 'aboveBar' : 'belowBar', shape: sg.type === 'C' ? 'arrowUp' : sg.type === 'V' ? 'arrowDown' : 'circle', color: sg.type === 'C' ? '#2f6fed' : sg.type === 'V' ? '#ff453a' : '#9e9e9e', text: sg.type === 'C' ? 'Compra' : sg.type === 'V' ? 'Venda' : 'Saída', size: 1.5 }));
      });
      mk.sort((a, b) => a.time - b.time); cs.setMarkers(mk); setLegend(lg); lsRef.current = ls;
      if (first) { chart.timeScale().fitContent(); first = false; }
    };
    load(); const t = setInterval(load, 10000);
    const t2 = setInterval(() => { // a cada segundo: cronômetro da vela e última vela acompanhando a cotação
      setClock(Date.now()); const b = qRef.current?.[symbol]?.bid; if (!lastBar || b == null || ctype === 'ha') return;
      lastBar.close = b; lastBar.high = Math.max(lastBar.high, b); lastBar.low = Math.min(lastBar.low, b); cs.update(ctype === 'line' ? { time: lastBar.time, value: b } : lastBar);
    }, 1000);
    return () => { dead = true; clearInterval(t); clearInterval(t2); csRef.current = null; chart.remove(); };
  }, [tab, symbol, tf, shownKey, theme, sysDark, ctype]);
  // linhas das posições abertas no gráfico (entrada, SL e TP), como no MT5
  useEffect(() => {
    const cs = csRef.current; if (!cs || tab !== 'chart') return;
    plRef.current.forEach(l => { try { cs.removePriceLine(l); } catch {} }); plRef.current = [];
    (d?.positions || []).filter((p: any) => p.symbol === symbol).forEach((p: any) => {
      const buy = /BUY/.test(p.type), add = (price: number, color: string, title: string, style: number) => { if (price) plRef.current.push(cs.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title })); };
      add(p.openPrice, buy ? '#2f6fed' : '#ff453a', `${buy ? 'buy' : 'sell'} ${p.volume} ${p.profit >= 0 ? '+' : ''}${p.profit.toFixed(2)}`, LineStyle.Solid);
      add(p.stopLoss, '#ff453a', 'SL', LineStyle.Dashed); add(p.takeProfit, '#00c853', 'TP', LineStyle.Dashed);
    });
  }, [d?.positions, symbol, tab, chartVer]);

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
      if (!o?.error && o?.lines) { ok = true; const ind = { id: String(Date.now()), name: mqlName || 'Convertido do MQL5', code: js }; const l = [...inds, ind]; persist(l); pick(ind.id, l); setActIds(a => [...a, ind.id]); setTab('chart'); break; }
      err = o?.error || 'calculate não retornou { lines, signals }';
    }
    setMsg(ok ? 'Indicador convertido e aplicado no gráfico' : 'Não foi possível converter: ' + err);
    setBusy(false);
  };

  const qRef = useRef<any>(null); qRef.current = d?.quotes;
  const tickRef = useRef<Record<string, { p: number; c: string }>>({});
  const tick = (sym: string, bid?: number) => { const t = (tickRef.current[sym] ||= { p: bid ?? 0, c: '#e6e6e6' }); if (bid != null) { if (bid > t.p) t.c = BUY; else if (bid < t.p) t.c = SELL; t.p = bid; } return t.c; };
  const px = (n?: number) => { if (n == null) return '—'; const t = n.toFixed(dg(n)); return <><span style={{ fontSize: 15 }}>{t.slice(0, -3)}</span><b style={{ fontSize: 21, fontWeight: 600 }}>{t.slice(-3, -1)}</b><sup style={{ fontSize: 11 }}>{t.slice(-1)}</sup></>; };
  const openDlg = () => { const p = (d?.positions || []).find((x: any) => x.symbol === symbol); setF(f0 => ({ ...f0, type: 'MARKET', sl: p?.stopLoss ? String(p.stopLoss) : '', tp: p?.takeProfit ? String(p.takeProfit) : '' })); setDlg(true); }; // preenche SL/TP já existentes para não removê-los sem querer
  const addS = () => { const sy = addSym.trim().toUpperCase(); if (sy && !watch.includes(sy)) saveW([...watch, sy]); setAddSym(''); };
  const [chat, setChat] = useState<{ role: string; content: string }[]>([]), [aiQ, setAiQ] = useState(''), [aiLoad, setAiLoad] = useState(false);
  const ask = async (qq: string) => { if (!qq.trim() || aiLoad) return; const msgs = [...chat, { role: 'user', content: qq }]; setChat(msgs); setAiQ(''); setAiLoad(true); const r = await api('/api/ai/chat', 'POST', { question: qq, symbol, tf: TF[tf], history: chat.slice(-6) }); setAiLoad(false); setChat([...msgs, { role: 'assistant', content: r.error ? `⚠ ${r.error}` : r.answer }]); };
  const addLib = (it: { name: string; code: string }) => { const ex = inds.find(x => x.name === it.name), ind = ex || { id: String(Date.now()), name: it.name, code: it.code }; if (!ex) persist([...inds, ind]); setActIds(a => (a.includes(ind.id) ? a : [...a, ind.id])); setTab('chart'); };
  const rp = report(hist), cv = rp.curve, mnC = Math.min(0, ...cv), mxC = Math.max(0, ...cv);
  const sxC = (i: number) => (cv.length > 1 ? (i / (cv.length - 1)) * 296 + 2 : 150), syC = (v: number) => 86 - ((v - mnC) / (mxC - mnC || 1)) * 80;
  const pxs = (n?: number) => { if (n == null) return <b className="p2">—</b>; const t = n.toFixed(dg(n)); return <><span className="p1">{t.slice(0, -3)}</span><b className="p2">{t.slice(-3, -1)}</b><sup className="p3">{t.slice(-1)}</sup></>; };
  const A = d?.account, P: any[] = d?.positions || [], O: any[] = d?.orders || [];
  const cell = { padding: '6px 4px', borderBottom: '1px solid #1c1c1e', fontSize: 13 } as const;
  const sm = (bg = '#1c1c1e') => ({ ...btn(bg), flex: 'none', padding: '6px 10px', fontSize: 13 } as const);

  return (
    <div className="app">
      <aside className="side">
        {TABS.map(([k, t]) => <button key={k} className={'nb' + (tab === k ? ' on' : '')} title={t} aria-label={t} onClick={() => setTab(k)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{IC[k]}</svg><span>{t}</span></button>)}
        <div className="tp">
          <button className="sell" onClick={() => (oneClick ? act({ action: 'sell', symbol, volume: lot }) : openDlg())}><small>VENDER</small>{pxs(q?.bid)}</button>
          <input className="lot" type="number" step="0.01" min="0" value={lot} onChange={e => setLot(+e.target.value)} aria-label="Lotes" />
          <button className="buy" onClick={() => (oneClick ? act({ action: 'buy', symbol, volume: lot }) : openDlg())}><small>COMPRAR</small>{pxs(q?.ask)}</button>
          <label className="oc"><input type="checkbox" checked={oneClick} onChange={e => setOneClick(e.target.checked)} /> 1 clique</label>
          <button className="more" onClick={() => openDlg()}>+ Ordem</button>
        </div>
      </aside>
      <main className="content" style={{ maxWidth: tab === 'chart' ? 'none' : 960, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <b>{symbol}</b>
        <span>{A ? <>Saldo {A.balance} · Equity {A.equity} <span style={{ color: col(A.equity - A.balance) }}>({(A.equity - A.balance).toFixed(2)})</span></> : '…'}</span>
        <button style={sm()} aria-label="Configurar IA" title="Configurar IA" onClick={() => setCfgOpen(true)}>⚙<span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, marginLeft: 5, background: ai?.configured ? '#30a46c' : '#e5484d' }} /></button>
        <button style={sm()} onClick={async () => { await api('/api/connect', 'DELETE'); onOut(); }}>Trocar conta</button>
      </div>
      {d?.preview && <div style={{ background: '#3a2f0b', border: '1px solid #f5a52455', color: '#f5d58a', borderRadius: 8, padding: '8px 10px', fontSize: 12, margin: '0 0 8px' }}>{d.source === 'mercado' ? 'Pré-visualização com cotações públicas de mercado (Yahoo Finance), que podem diferir um pouco da sua corretora.' : 'Pré-visualização com dados de exemplo.'} As ordens estão desativadas. Toque em Trocar conta e conecte uma conta MT5 para operar de verdade.</div>}
      {msg && <p style={{ color: '#f5a524', margin: '4px 0' }}>{msg}</p>}

      {tab === 'quotes' && <>
        {watch.map(sy => { const qq = d?.quotes?.[sy], c = tick(sy, qq?.bid); return (
          <div key={sy} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 2px', borderBottom: `1px solid ${LINE}` }} onClick={() => { setSymbol(sy); setTab('chart'); }}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 16 }}>{sy}</div><div style={{ color: GRAY, fontSize: 11 }}>{qq ? `spread ${Math.round((qq.ask - qq.bid) * 10 ** dg(qq.bid))}` : 'sem cotação'}</div></div>
            <div style={{ color: c, minWidth: 88, textAlign: 'right' }}>{px(qq?.bid)}</div>
            <div style={{ color: c, minWidth: 88, textAlign: 'right' }}>{px(qq?.ask)}</div>
            <button style={sm()} onClick={e => { e.stopPropagation(); saveW(watch.filter(x => x !== sy)); }}>×</button></div>); })}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <input list="symlist" value={addSym} onChange={e => setAddSym(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && addS()} placeholder="Adicionar símbolo (ex.: EURUSD)" style={{ ...inp, flex: 1 }} />
          <button style={sm(BUY)} onClick={addS}>Adicionar</button></div>
        <datalist id="symlist">{symList.slice(0, 4000).map(x => <option key={x} value={x} />)}</datalist>
      </>}

      {tab === 'chart' && <>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
          {Object.keys(TF).map(k => <button key={k} style={sm(k === tf ? BUY : LINE)} onClick={() => setTf(k)}>{k}</button>)}
          <span style={{ flex: 1 }} />
          <select value={ctype} onChange={e => setCtype(e.target.value as any)} aria-label="Tipo de gráfico" style={{ background: LINE, color: '#fff', border: 0, borderRadius: 8, padding: '6px 8px', fontSize: 13 }}><option value="candle">Velas</option><option value="ha">Heikin Ashi</option><option value="line">Linha</option></select>
          <div style={{ position: 'relative' }}>
            <button style={sm(showInd ? BUY : LINE)} onClick={() => setShowInd(!showInd)}>ƒx Indicadores ({shown.length})</button>
            {showInd && <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 6, background: '#111113', border: '1px solid #2a2a2c', borderRadius: 8, padding: 8, minWidth: 230 }}>
              {inds.map(i => <label key={i.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 2px', fontSize: 14 }}><input type="checkbox" checked={actIds.includes(i.id)} onChange={() => setActIds(a => (a.includes(i.id) ? a.filter(x => x !== i.id) : [...a, i.id]))} />{i.name}</label>)}
              <button style={{ ...sm(), width: '100%', marginTop: 6 }} onClick={() => { setShowInd(false); setTab('ind'); }}>Biblioteca e editor</button></div>}
          </div>
          <button style={sm()} title="Tema do gráfico" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')}>{theme === 'dark' ? '☾ Escuro' : theme === 'light' ? '☀ Claro' : '◐ Auto'}</button>
        </div>
        <div style={{ position: 'relative' }}>
          <div id="chart" style={{ height: `calc(100vh - ${d?.preview ? 215 : 150}px)`, minHeight: 340 }} />
          <div style={{ position: 'absolute', top: 6, left: 8, zIndex: 3, pointerEvents: 'none', fontSize: 12, color: th.tx, lineHeight: 1.55 }}>
            <b>{symbol}, {tf}</b>{barT.current > 0 && <span> · ⏱ {fmtT(Math.max(0, barT.current + TS[tf] - Math.floor(Date.now() / 1000)))}</span>}
            <div>{hover ? `O ${hover.o ?? '—'}  H ${hover.h ?? '—'}  L ${hover.l ?? '—'}  C ${hover.c ?? '—'}` : q ? `Bid ${q.bid} · Ask ${q.ask}` : ''}</div>
            {legend.map(l => { const v = hover?.vals?.[l.name] ?? l.value; return <div key={l.name}><span style={{ display: 'inline-block', width: 16, height: 3, background: l.color, marginRight: 6, verticalAlign: 'middle' }} />{l.name}{v != null && <b> {Number(v).toFixed(dg(v))}</b>}</div>; })}
          </div>
        </div>
      </>}

      {tab === 'trade' && <>
        {A && <div style={{ marginBottom: 10 }}>
          {([['Saldo', A.balance], ['Equity', A.equity], ['Margem', A.margin], ['Margem livre', A.freeMargin], ['Lucro', P.reduce((t: number, p: any) => t + p.profit, 0)]] as [string, number][]).map(([k, v]) => <div key={k} style={{ display: 'flex', alignItems: 'baseline', padding: '4px 0', fontSize: 14 }}><span style={{ color: GRAY }}>{k}:</span><span style={{ flex: 1, borderBottom: '1px dotted #3a3a3c', margin: '0 6px' }} /><b style={{ fontWeight: 600, color: k === 'Lucro' ? col(v) : undefined }}>{v.toFixed(2)}</b></div>)}
          <div style={{ display: 'flex', alignItems: 'baseline', padding: '4px 0', fontSize: 14 }}><span style={{ color: GRAY }}>Nível de margem (%):</span><span style={{ flex: 1, borderBottom: '1px dotted #3a3a3c', margin: '0 6px' }} /><b style={{ fontWeight: 600 }}>{A.marginLevel ? A.marginLevel.toFixed(2) : '—'}</b></div>
        </div>}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <button style={sm(BUY)} onClick={() => openDlg()}>Nova ordem</button>
          {[['all', 'Fechar tudo'], ['profit', 'Fechar lucro'], ['loss', 'Fechar prejuízo']].map(([m, t]) => <button key={m} style={sm(SELL)} onClick={() => confirm(t + '?') && act({ action: 'closeAll', mode: m })}>{t}</button>)}
        </div>
        <div style={{ background: LINE, color: GRAY, fontSize: 12, padding: '4px 8px' }}>Posições ({P.length})</div>
        {P.map(p => { const buy = /BUY/.test(p.type); return <div key={p.id} style={{ padding: '8px 2px', borderBottom: `1px solid ${LINE}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span><b>{p.symbol}</b><small style={{ color: GRAY }}> #{String(p.id).slice(-6)}</small>, <span style={{ color: buy ? BUY : SELL }}>{buy ? 'buy' : 'sell'} {p.volume}</span></span><b style={{ fontSize: 17, color: col(p.profit) }}>{p.profit.toFixed(2)}</b></div>
          <div style={{ color: GRAY, fontSize: 13 }}>{p.openPrice} → {p.currentPrice}</div>
          <div style={{ color: GRAY, fontSize: 12 }}>S/L: {n2(p.stopLoss) || '—'} · T/P: {n2(p.takeProfit) || '—'}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button style={sm()} onClick={() => { const sl = edit('Stop Loss', p.stopLoss); if (sl === undefined) return; const tp = edit('Take Profit', p.takeProfit); if (tp === undefined) return; act({ action: 'modify', positionId: p.id, sl, tp }); }}>Modificar</button>
            <button style={sm()} onClick={() => { const v = edit('Volume a fechar', p.volume); if (v) act({ action: 'close', positionId: p.id, volume: +v < p.volume ? v : undefined }); }}>Fechar parcial</button>
            <button style={sm(SELL)} onClick={() => act({ action: 'close', positionId: p.id })}>Fechar</button>
          </div></div>; })}
        <div style={{ background: LINE, color: GRAY, fontSize: 12, padding: '4px 8px', marginTop: 12 }}>Ordens pendentes ({O.length})</div>
        {O.map(o => { const buy = /BUY/.test(o.type); return <div key={o.id} style={{ padding: '8px 2px', borderBottom: `1px solid ${LINE}` }}>
          <div><b>{o.symbol}</b>, <span style={{ color: buy ? BUY : SELL }}>{T(o.type)} {o.currentVolume ?? o.volume}</span></div>
          <div style={{ color: GRAY, fontSize: 13 }}>@ {o.openPrice} · S/L {n2(o.stopLoss) || '—'} · T/P {n2(o.takeProfit) || '—'}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button style={sm()} onClick={() => { const price = edit('Preço', o.openPrice); if (price === undefined) return; const sl = edit('Stop Loss', o.stopLoss); if (sl === undefined) return; const tp = edit('Take Profit', o.takeProfit); if (tp === undefined) return; act({ action: 'modifyOrder', orderId: o.id, price, sl, tp }); }}>Modificar</button>
            <button style={sm(SELL)} onClick={() => act({ action: 'cancel', orderId: o.id })}>Cancelar</button>
          </div></div>; })}
      </>}

      {tab === 'hist' && <>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
          {[['list', 'Lista'], ['rep', 'Relatório']].map(([k, t]) => <button key={k} style={sm(hv === k ? BUY : LINE)} onClick={() => setHv(k)}>{t}</button>)}
          <span style={{ flex: 1 }} />
          {[7, 30, 90].map(n => <button key={n} style={sm(histDays === n ? BUY : LINE)} onClick={() => setHistDays(n)}>{n} dias</button>)}
        </div>
        {!hist.length && <p style={{ color: GRAY }}>Nenhuma operação fechada no período.</p>}
        {hist.length > 0 && hv === 'list' && hist.map(x => { const net = x.profit + (x.commission || 0) + (x.swap || 0), dir = /SELL/.test(x.type) ? 'buy' : 'sell'; return <div key={x.id} style={{ padding: '8px 2px', borderBottom: `1px solid ${LINE}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span><b>{x.symbol}</b><small style={{ color: GRAY }}> #{String(x.positionId || x.id).slice(-6)}</small>, <span style={{ color: dir === 'buy' ? BUY : SELL }}>{dir} {x.volume}</span></span><b style={{ fontSize: 17, color: col(net) }}>{money(net)}</b></div>
          <div style={{ color: GRAY, fontSize: 12 }}>{new Date(x.time).toLocaleString()} · saída {x.price}</div></div>; })}
        {hist.length > 0 && hv === 'rep' && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginBottom: 10 }}>
            {([['Resultado líquido', money(rp.net), col(rp.net)], ['Operações', String(rp.n)], ['Taxa de acerto', (rp.winRate * 100).toFixed(1) + '%'], ['Fator de lucro', isFinite(rp.pf) ? rp.pf.toFixed(2) : '∞'], ['Ganho médio', money(rp.avgWin)], ['Perda média', money(rp.avgLoss)], ['Melhor / pior', `${money(rp.best)} / ${money(rp.worst)}`], ['Rebaixamento máx.', money(rp.dd)], ['Perdas seguidas', String(rp.mcl)]] as [string, string, string?][]).map(([k, v, c]) => <div key={k} style={{ background: '#0e0e10', border: `1px solid ${LINE}`, borderRadius: 8, padding: 10 }}><div style={{ color: GRAY, fontSize: 12 }}>{k}</div><div style={{ fontSize: 18, fontWeight: 600, color: c }}>{v}</div></div>)}
          </div>
          <div style={{ color: GRAY, fontSize: 12, marginBottom: 4 }}>Curva de resultado acumulado</div>
          <svg viewBox="0 0 300 90" style={{ width: '100%', height: 130, background: '#0b0b0d', borderRadius: 8 }}><line x1="2" x2="298" y1={syC(0)} y2={syC(0)} stroke="#3a3a3c" strokeDasharray="3 3" /><polyline fill="none" stroke={col(rp.net)} strokeWidth="1.8" points={cv.map((v, i) => `${sxC(i)},${syC(v)}`).join(' ')} /></svg>
          <div style={{ background: LINE, color: GRAY, fontSize: 12, padding: '4px 8px', margin: '12px 0 0' }}>Compras e vendas</div>
          {([['Compras (buy)', rp.long], ['Vendas (sell)', rp.short]] as [string, { n: number; net: number; win: number }][]).map(([k, v]) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 2px', borderBottom: `1px solid ${LINE}` }}><span>{k} · {v.n} op. · {v.n ? Math.round((v.win / v.n) * 100) : 0}% acerto</span><b style={{ color: col(v.net) }}>{money(v.net)}</b></div>)}
          <div style={{ background: LINE, color: GRAY, fontSize: 12, padding: '4px 8px', margin: '12px 0 0' }}>Por símbolo</div>
          {rp.bySymbol.map(([sy, v]) => <div key={sy} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 2px', borderBottom: `1px solid ${LINE}` }}><span><b>{sy}</b> · {v.n} op.</span><b style={{ color: col(v.net) }}>{money(v.net)}</b></div>)}
        </>}
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

      {tab === 'ai' && <>
        <b>Assistente de IA</b>
        <p style={{ color: GRAY, fontSize: 12, margin: '4px 0 8px' }}>Analisa o mercado, suas posições e seu histórico, e consulta o calendário econômico quando disponível. É somente leitura: não envia ordens. Informativo, não é aconselhamento de investimento. {!ai?.configured && <span style={{ color: '#f5a524' }}>Configure a IA na engrenagem ⚙.</span>}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {[`Analise a situação atual do ${symbol} no ${tf}: tendência, suporte e resistência.`, 'Analise minhas posições abertas. Quais parecem mais arriscadas e por quê?', 'Analise meu histórico de 30 dias e diga o que posso melhorar.', `Há notícias de alto impacto nas próximas 48h que afetem o ${symbol}?`].map(t => <button key={t} style={sm()} onClick={() => ask(t)}>{t.length > 44 ? t.slice(0, 42) + '…' : t}</button>)}
        </div>
        {chat.map((m, i) => <div key={i} style={{ margin: '8px 0', padding: '8px 10px', borderRadius: 8, background: m.role === 'user' ? '#14213d' : '#111113', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.5 }}>{m.content}</div>)}
        {aiLoad && <p style={{ color: GRAY }}>Analisando…</p>}
        <div style={{ display: 'flex', gap: 6 }}>
          <input style={{ ...inp, flex: 1 }} placeholder="Pergunte sobre o mercado, suas posições ou seu histórico" value={aiQ} onChange={e => setAiQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask(aiQ)} />
          <button style={sm(BUY)} disabled={aiLoad} onClick={() => ask(aiQ)}>Enviar</button></div>
        {chat.length > 0 && <button style={{ ...sm(), marginTop: 8 }} onClick={() => setChat([])}>Limpar conversa</button>}
      </>}

      {tab === 'ind' && <>
        <b>Biblioteca de indicadores</b>
        <p style={{ color: GRAY, fontSize: 12, margin: '4px 0 8px' }}>Toque em Adicionar para colocar no gráfico. Cada linha e cada seta aparece identificada na legenda do gráfico.</p>
        {LIB.map(it => <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px', borderBottom: `1px solid ${LINE}` }}><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{it.name}</div><div style={{ color: GRAY, fontSize: 12 }}>{it.desc}</div></div><button style={sm(BUY)} onClick={() => addLib(it)}>Adicionar</button></div>)}
        <div style={{ height: 14 }} />
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
        <button style={{ ...btn('#3e63dd'), width: '100%', marginTop: 8 }} onClick={() => { persist(inds.map(i => i.id === sel ? { ...i, code } : i)); setApplied(code); setActIds(a => (a.includes(sel) ? a : [...a, sel])); setTab('chart'); }}>Salvar e aplicar no gráfico</button>
      </>}

      {cfgOpen && <div style={{ position: 'fixed', inset: 0, background: '#000b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 20 }} onClick={() => setCfgOpen(false)}>
        <div role="dialog" aria-label="Configurar IA" style={{ background: '#0e1116', border: '1px solid #1c1c1e', borderRadius: 12, padding: 16, width: '100%', maxWidth: 400, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
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
            <button style={btn('#1c1c1e')} onClick={() => setCfgOpen(false)}>Fechar</button></div>
        </div></div>}

      {dlg && <div style={{ position: 'fixed', inset: 0, background: '#000b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#0e1116', border: '1px solid #1c1c1e', borderRadius: 12, padding: 16, width: '100%', maxWidth: 380 }}>
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
            <button style={btn('#1c1c1e')} onClick={() => setDlg(false)}>Cancelar</button></div>
        </div></div>}

      </main>
    </div>
  );
}
