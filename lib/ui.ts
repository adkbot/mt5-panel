export const TFS = ['1m', '5m', '15m', '1h', '4h'], PAL = ['#e5484d', '#30a46c', '#f5a524', '#3e63dd', '#ab4aba', '#12a594'];
export const inp = { background: '#171c24', color: '#e6e9ef', border: '1px solid #262d38', borderRadius: 8, padding: 10, width: '100%', boxSizing: 'border-box' } as const;
export const btn = (bg: string) => ({ flex: 1, padding: 14, border: 0, borderRadius: 8, background: bg, color: '#fff', fontSize: 16, fontWeight: 600 } as const);
export const api = (url: string, method = 'GET', body?: any) => fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }).then(r => r.json());

// O código do usuário roda num iframe isolado (sandbox sem acesso a cookies, sessão ou à página).
export function runIndicator(code: string, candles: any[]): Promise<any> {
  return new Promise(res => {
    const f = document.createElement('iframe'); f.sandbox.add('allow-scripts'); f.style.display = 'none';
    const done = (v: any) => { window.removeEventListener('message', h); f.remove(); res(v); };
    const h = (e: MessageEvent) => { if (e.source === f.contentWindow) done(e.data); };
    window.addEventListener('message', h);
    f.srcdoc = `<script>try{${code.replace(/<\/script/gi, '')}\nparent.postMessage(calculate(${JSON.stringify(candles)}),'*')}catch(e){parent.postMessage({error:String(e)},'*')}<\/script>`;
    document.body.appendChild(f); setTimeout(() => done({ error: 'Indicador demorou demais (8s)' }), 8000);
  });
}

