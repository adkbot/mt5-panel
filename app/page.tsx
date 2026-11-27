'use client';
import { useEffect, useState } from 'react';
import Terminal from './Terminal';
import { api } from '@/lib/ui';

const CANDLES = [34, 52, 41, 66, 48, 72, 58, 90, 70, 64, 96, 80, 110, 92, 84, 120]; // velas decorativas fixas
function Connect({ onOk }: { onOk: () => void }) {
  const [f, setF] = useState({ login: '', server: '', password: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); setErr(''); const d = await api('/api/connect', 'POST', f); setF(x => ({ ...x, password: '' })); setBusy(false); d.error ? setErr(d.error) : onOk(); };
  const seePreview = async () => { setBusy(true); setErr(''); const d = await api('/api/preview', 'POST'); setBusy(false); d.error ? setErr(d.error) : onOk(); };
  const fields = [['login', 'Login (ID da conta)', 'text'], ['server', 'Servidor (ex.: ICMarkets-Demo)', 'text'], ['password', 'Senha de negociação', 'password']] as const;
  return (
    <div className="login">
      <svg className="bg" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        {CANDLES.map((h, i) => <rect key={i} x={40 + i * 72} y={600 - h * 2 - (i % 3) * 20} width="14" height={h * 2} rx="2" className={i % 4 === 1 ? 'dn' : 'up'} />)}
        <path className="ln" d="M0 470 C120 440 200 500 320 430 S520 380 640 330 S860 300 960 220 S1120 160 1200 110" />
      </svg>
      <main className="wrap">
        <img className="logo" src="/logo.png" alt="ADK New Trade" width={190} height={190} />
        <form className="card" onSubmit={e => { e.preventDefault(); go(); }}>
          <h1>Conectar conta MT5</h1>
          <p className="sub">Use o login, o servidor e a senha de negociação da sua corretora. Comece por uma conta demo.</p>
          {fields.map(([k, t, ty]) => <label key={k}>{t}<input type={ty} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} autoComplete={k === 'password' ? 'new-password' : 'off'} name={'adk_' + k} data-lpignore="true" data-1p-ignore inputMode={k === 'login' ? 'numeric' : undefined} required /></label>)}
          <button type="button" className="link" onClick={() => { setF({ login: '', server: '', password: '' }); setErr(''); }}>Limpar campos</button>
          <button className="cta" disabled={busy}>{busy ? 'Conectando… pode levar até 1 minuto' : 'Conectar conta'}</button>
          <button type="button" className="ghost" disabled={busy} onClick={seePreview}>Ver o painel sem conectar (dados de exemplo)</button>
          {err && <p className="err" role="alert">{err}</p>}
          <p className="fine">Sua senha vai direto para a MetaApi e não fica guardada aqui. Se a sua corretora oferecer, use a senha de nível Trading, que não permite saques nem troca de senha.</p>
        </form>
      </main>
    </div>
  );
}

export default function Page() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { api('/api/connect').then(d => setOn(!!d.connected)); }, []);
  if (on === null) return null;
  return on ? <Terminal onOut={() => setOn(false)} /> : <Connect onOk={() => setOn(true)} />;
}
