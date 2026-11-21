import { getSession } from '@/lib/session';
import { complete, AiError } from '@/lib/ai';
export const maxDuration = 60;
const SYS = `Você é o agente analista de setup de um painel de trading. Recebe o diário de entradas MANUAIS de um trader: cada item tem symbol, side (buy/sell), lot, sl, tp, ctx (tf, nyHour = hora em Nova York, price, lines = últimos valores das linhas do indicador dele, lastSignal = último sinal C/V/X do indicador, barsSinceSignal = candles desde esse sinal) e outcome (profit, exitPrice, exitTime) quando já fechou.
Descubra o padrão: qual sinal precede as entradas, quantos candles depois ele entra, em que horário, a distância típica do stop (em unidades de preço, |preço - sl|), o alvo (múltiplo R do stop ou uma linha do indicador) e se sai no sinal X. Seja conservador: use a mediana, ignore outliers e, se a amostra for pequena ou inconsistente, diga isso no summary.
Responda SOMENTE com JSON válido neste formato, sem markdown:
{"summary":"3 a 5 frases em português explicando o padrão e a confiança","trigger":{"signal":"C"|"V"|"both","maxBarsAgo":número>=0},"hoursNY":[horaInicio,horaFim]|null,"sl":{"mode":"price","value":número>0},"tp":{"mode":"rr","value":número}|{"mode":"line","line":"nome exato de uma linha de ctx.lines"},"exit":{"onX":true|false},"lot":número,"maxPerDay":inteiro}`;
const hits = new Map<string, number[]>();
const bad = (m: string, s = 400) => Response.json({ error: m }, { status: s });
export async function POST(r: Request) {
  const id = getSession(); if (!id) return bad('Não conectado', 401);
  const now = Date.now(), h = (hits.get(id) || []).filter(t => now - t < 36e5);
  if (h.length >= 10) return bad('Limite de análises por hora atingido', 429);
  hits.set(id, [...h, now]);
  const { entries } = await r.json();
  if (!Array.isArray(entries) || entries.length < 5) return bad('Registre ao menos 5 entradas pelo painel antes de analisar');
  try {
    const out = await complete(SYS, JSON.stringify(entries.slice(-100)), 1500);
    const p = JSON.parse(out.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    const okTp = (p.tp?.mode === 'rr' && p.tp.value > 0 && p.tp.value <= 10) || (p.tp?.mode === 'line' && typeof p.tp.line === 'string');
    if (!['C', 'V', 'both'].includes(p.trigger?.signal) || !(p.sl?.value > 0) || !okTp || !(p.lot > 0)) throw new Error('perfil inválido');
    return Response.json({ profile: { ...p, lot: Math.min(+p.lot, 1), maxPerDay: Math.min(Math.max(+p.maxPerDay || 3, 1), 20) } });
  } catch (e: any) { return e instanceof AiError ? bad(e.message, e.status) : bad('A análise não devolveu um perfil válido. Registre mais entradas ou troque o modelo.', 502); }
}
