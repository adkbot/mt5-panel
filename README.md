# Painel MT5 multiusuário (Next.js + MetaApi + Supabase)
Variáveis (no Vercel > Settings > Environment Variables): METAAPI_TOKEN, SESSION_SECRET (`openssl rand -hex 32`), ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
Banco: tabela `panel_state` já criada no projeto Supabase `mt5-panel`; indicadores, diário, perfil do setup e travas ficam lá, ligados a login+servidor da conta MT5.
Local: `cp .env.example .env.local && npm install && npm run dev`.
Agentes: o executor automático roda no navegador com o painel aberto; para 24h é preciso um worker no servidor.
