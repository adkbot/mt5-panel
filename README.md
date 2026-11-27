# ADK New Trade · Painel MT5 (Next.js + MetaApi + Supabase)
Painel web e instalável no celular (PWA) para operar contas MT5 pela MetaApi.

**Recursos:** barra lateral estilo MT5; gráfico (velas, Heikin Ashi, linha) com tema escuro/claro/auto, janela de dados, cronômetro da vela e linhas das posições; vários indicadores ao mesmo tempo, com legenda; biblioteca de indicadores (EMA, SMA, Bollinger, VWAP, ZigZag, Pré-Tóquio); conversor MQL5 para JS; negociação de 1 clique (liga/desliga), ordens a mercado e pendentes, fechar tudo/lucro/prejuízo; relatório de trading; assistente de IA somente leitura (Gemini, OpenRouter, OpenAI, Anthropic ou endpoint próprio); agentes que aprendem o setup e operam no navegador ou 24h no worker.

**Variáveis (Vercel):** METAAPI_TOKEN, SESSION_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (opcional: METAAPI_RELIABILITY=high, ANTHROPIC_API_KEY ou AI_API_KEY).
**Worker 24h:** pasta `worker` (Render). **Celular:** abra o endereço e use "Adicionar à tela inicial".
