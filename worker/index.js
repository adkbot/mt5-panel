// Worker 24h: lê pedidos de automático no Supabase e executa o perfil do setup nas contas MT5 via MetaApi.
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const M = require('metaapi.cloud-sdk'); const MetaApi = M.default || M;
const { runIndicator } = require('./sandbox');
for (const k of ['METAAPI_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) if (!process.env[k]) { console.error('Falta a variável ' + k); process.exit(1); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const api = new MetaApi(process.env.METAAPI_TOKEN);
const HARD_LOT = +process.env.HARD_MAX_LOT || 1; // teto absoluto de lote, acima de qualquer trava do usuário
const log = (...a) => console.log(new Date().toISOString(), ...a);
const nyHour = () => +new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }).format(new Date());
const get = async (u, k) => (await sb.from('panel_state').select('value').eq('user_key', u).eq('key', k).maybeSingle()).data?.value ?? null;
const put = (u, k, v) => sb.from('panel_state').upsert({ user_key: u, key: k, value: v, updated_at: new Date().toISOString() }, { onConflict: 'user_key,key' });
const conns = new Map();
async function getConn(id) {
  if (conns.has(id)) return conns.get(id);
  const account = await api.metatraderAccountApi.getAccount(id);
  if (account.state !== 'DEPLOYED') await account.deploy();
  await account.waitConnected();
  const conn = account.getRPCConnection(); await conn.connect(); await conn.waitSynchronized();
  const v = { account, conn }; conns.set(id, v); return v;
}
async function tickUser(user, a) {
  const [prof, guard, st0] = await Promise.all([get(user, 'profile'), get(user, 'guard'), get(user, 'autostate')]);
  const st = st0 || { acted: 0, day: null, open: [], log: [] };
  const say = m => { st.log = [new Date().toISOString().slice(11, 19) + ' ' + m, ...(st.log || [])].slice(0, 30); };
  const off = async m => { say(m); await put(user, 'auto', { ...a, enabled: false }); };
  try {
    st.error = null;
    if (!prof || !(guard?.lotMax > 0) || !(guard?.lossMax > 0)) return await off('Perfil ou travas ausentes. Automático desligado.');
    const { account, conn: c } = await getConn(a.accountId);
    const raw = await account.getHistoricalCandles(a.symbol, a.tf, new Date(), 1000);
    const cs = raw.map(k => ({ time: Math.floor(new Date(k.time).getTime() / 1000), open: k.open, high: k.high, low: k.low, close: k.close, vol: k.tickVolume })).sort((x, y) => x.time - y.time);
    const o = await runIndicator(a.code, cs), sig = o.signals || [], last = sig[sig.length - 1];
    if (!st0) { st.acted = last?.time || 0; say(`Automático iniciado em ${a.symbol} ${a.tf}`); } // sinal antigo não dispara ordem
    const info = await c.getAccountInformation(), P = (await c.getPositions()).filter(p => p.symbol === a.symbol), q = await c.getSymbolPrice(a.symbol);
    const day = new Date().toISOString().slice(0, 10); if (!st.day || st.day.d !== day) st.day = { d: day, bal: info.balance, n: 0 };
    if (info.equity <= st.day.bal - guard.lossMax) return await off('Perda máxima do dia atingida. Automático desligado.');
    if (!last || last.time <= st.acted) return;
    st.acted = last.time;
    if (last.type === 'X') {
      if (prof.exit?.onX) for (const p of P) if ((st.open || []).includes(String(p.id))) { await c.closePosition(String(p.id)); say('Saída pelo sinal X em ' + p.id); }
      return;
    }
    if (P.length) return;
    if (prof.trigger.signal !== 'both' && prof.trigger.signal !== last.type) return;
    const ago = cs.length - 1 - cs.findIndex(b => b.time === last.time);
    if (ago > (prof.trigger.maxBarsAgo ?? 1)) return;
    const h = nyHour(); if (prof.hoursNY && !(h >= prof.hoursNY[0] && h < prof.hoursNY[1])) return say('Sinal fora do horário do setup');
    if (st.day.n >= Math.min(prof.maxPerDay ?? 3, guard.perDay ?? 3)) return say('Limite de operações do dia');
    const buy = last.type === 'C', px = buy ? q.ask : q.bid, dec = (String(q.bid).split('.')[1] || '').length, fx = n => +n.toFixed(dec);
    const dist = prof.sl.value, sl = fx(buy ? px - dist : px + dist), L = o.lines?.[prof.tp?.line];
    const tp = prof.tp.mode === 'rr' ? fx(buy ? px + dist * prof.tp.value : px - dist * prof.tp.value) : L?.length ? fx(L[L.length - 1].value) : undefined;
    const vol = Math.min(prof.lot, guard.lotMax, HARD_LOT);
    const res = buy ? await c.createMarketBuyOrder(a.symbol, vol, sl, tp, { comment: 'adk-auto' }) : await c.createMarketSellOrder(a.symbol, vol, sl, tp, { comment: 'adk-auto' });
    st.day.n++; st.open = [...(st.open || []), String(res.positionId)].slice(-20);
    say(`${buy ? 'Compra' : 'Venda'} ${vol} ${a.symbol} SL ${sl}${tp ? ' TP ' + tp : ''}`);
  } catch (e) { st.error = e.message; say('Erro: ' + e.message); conns.delete(a.accountId); }
  finally { st.lastRun = Date.now(); await put(user, 'autostate', st); }
}
let busy = false;
async function loop() {
  if (busy) return; busy = true;
  try {
    const { data, error } = await sb.from('panel_state').select('user_key,value').eq('key', 'auto'); if (error) throw error;
    const active = new Set();
    for (const r of data || []) if (r.value?.enabled) { active.add(r.value.accountId); await tickUser(r.user_key, r.value).catch(e => log('erro', e.message)); }
    for (const id of [...conns.keys()]) if (!active.has(id)) conns.delete(id);
  } catch (e) { log('loop', e.message); } finally { busy = false; }
}
http.createServer((q, r) => r.end('ok')).listen(process.env.PORT || 10000); // health check do Render
setInterval(loop, 15000); loop(); log('worker iniciado');
