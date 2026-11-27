import './globals.css';
import SwRegister from './sw-register';
export const metadata = { title: 'ADK New Trade · Painel MT5', description: 'Painel de trading MT5 com gráfico, indicadores, agentes e assistente de IA', manifest: '/manifest.json', icons: { icon: '/icon-192.png', apple: '/icon-192.png' }, appleWebApp: { capable: true, title: 'ADK MT5', statusBarStyle: 'black-translucent' } };
export const viewport = { themeColor: '#050607', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function L({ children }: any) {
  return <html lang="pt-BR"><body style={{ margin: 0, background: '#000', color: '#e6e9ef', fontFamily: 'system-ui,sans-serif' }}>{children}<SwRegister /></body></html>;
}
