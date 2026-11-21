// Executa o indicador do usuário num QuickJS isolado (WASM): sem acesso a process, rede, arquivos ou segredos.
const { getQuickJS, shouldInterruptAfterDeadline } = require('quickjs-emscripten');
// QuickJS não tem Intl: mínimo compatível (UTC e America/New_York, com horário de verão dos EUA).
const PRELUDE = `(function(){
  const off = ms => { const y = new Date(ms).getUTCFullYear();
    const nth = (m, n) => { const f = (7 - new Date(Date.UTC(y, m, 1)).getUTCDay()) % 7; return 1 + f + 7 * (n - 1); };
    return ms >= Date.UTC(y, 2, nth(2, 2), 7) && ms < Date.UTC(y, 10, nth(10, 1), 6) ? -240 : -300; };
  class DTF { constructor(l, o) { this.tz = (o && o.timeZone) || 'UTC'; if (this.tz !== 'UTC' && this.tz !== 'America/New_York') throw new Error('Fuso não suportado no 24h: ' + this.tz); }
    formatToParts(d) { const ms = +d, t = new Date(ms + (this.tz === 'UTC' ? 0 : off(ms)) * 60000), p = n => String(n).padStart(2, '0');
      return [['year', t.getUTCFullYear()], ['month', p(t.getUTCMonth() + 1)], ['day', p(t.getUTCDate())], ['hour', p(t.getUTCHours())], ['minute', p(t.getUTCMinutes())], ['second', p(t.getUTCSeconds())]].map(x => ({ type: x[0], value: String(x[1]) })); } }
  globalThis.Intl = { DateTimeFormat: DTF };
})();`;
let QJS;
async function runIndicator(code, candles) {
  QJS = QJS || await getQuickJS();
  const vm = QJS.newContext();
  vm.runtime.setMemoryLimit(96 * 1024 * 1024); vm.runtime.setMaxStackSize(1024 * 1024);
  vm.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + 8000));
  try {
    const r = vm.evalCode(`${PRELUDE}\n${code}\n;JSON.stringify(calculate(${JSON.stringify(candles)}))`);
    if (r.error) { const e = vm.dump(r.error); r.error.dispose(); throw new Error('Indicador: ' + (e && e.message ? e.message : JSON.stringify(e))); }
    const s = vm.getString(r.value); r.value.dispose();
    return JSON.parse(s);
  } finally { vm.dispose(); }
}
module.exports = { runIndicator };
