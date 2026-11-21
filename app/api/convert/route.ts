import { getSession } from '@/lib/session';
import { complete } from '@/lib/ai';
export const maxDuration = 60;
const SYS = `Você converte indicadores MQL5 (MetaTrader 5) para JavaScript puro. Responda SOMENTE com código JavaScript, sem markdown e sem explicações.
Formato obrigatório: defina function calculate(candles) e retorne { lines: { nome: [{time, value}] }, signals: [{time, type}] }.
- candles: array em ordem cronológica crescente [{time (segundos Unix), open, high, low, close, vol}].
- Cada buffer/plot de linha do MQL5 vira uma entrada em lines (use o nome/label do plot). Pule valores vazios (EMPTY_VALUE, 0 usado como vazio, NaN) em vez de enviá-los.
- Buffers de seta/sinal (compra/venda) viram signals: type 'C' compra, 'V' venda, 'X' saída. Objetos gráficos (linhas, retângulos) aproxime como lines ou ignore, comentando o que foi ignorado.
- Reimplemente em JS puro as funções nativas usadas (iMA, iRSI, iATR, iMACD, iBands, iStochastic, iADX, etc.) dentro do próprio código. Respeite ArraySetAsSeries (índices invertidos), prev_calculated/rates_total e os inputs (use os valores default como constantes no topo).
- Código autocontido e puro: sem imports, sem DOM, sem rede, sem eval. Deve terminar rápido para milhares de candles.
- Se o código for um EA/script (não indicador) ou não for convertível, responda apenas: // ERRO: motivo curto em português.`;
const hits = new Map<string, number[]>();
export async function POST(r: Request) {
  const id = getSession(); if (!id) return Response.json({ error: 'Não conectado' }, { status: 401 });
  const now = Date.now(), h = (hits.get(id) || []).filter(t => now - t < 36e5);
  if (h.length >= 20) return Response.json({ error: 'Limite de conversões por hora atingido' }, { status: 429 });
  hits.set(id, [...h, now]);
  const { mql, js, err } = await r.json();
  if (typeof mql !== 'string' || !mql.trim() || mql.length > 40000) return Response.json({ error: 'Cole o código MQL5 (até 40 mil caracteres)' }, { status: 400 });
  const content = js ? `Código MQL5:\n${mql}\n\nSua conversão anterior:\n${js}\n\nErro ao executar:\n${err}\n\nCorrija e devolva o código completo.` : `Código MQL5:\n${mql}`;
  try {
    const out = await complete(SYS, content, 6000);
    return Response.json({ code: out.trim().replace(/^```(?:javascript|js)?\s*/i, '').replace(/\s*```$/, '') });
  } catch (e: any) { return Response.json({ error: e.message }, { status: e.status || 502 }); }
}
