import './globals.css';
export const metadata = { title: 'ADK New Trade · Painel MT5', manifest: '/manifest.json', icons: { icon: '/logo.png' } };
export const viewport = { themeColor: '#050607' };
export default function L({ children }: any) {
  return <html lang="pt-BR"><body style={{ margin: 0, background: '#0e1116', color: '#e6e9ef', fontFamily: 'system-ui,sans-serif' }}>{children}</body></html>;
}
