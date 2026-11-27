// Service worker mínimo: permite instalar o painel no celular. Não guarda dados de trading em cache: tudo vem da rede.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
