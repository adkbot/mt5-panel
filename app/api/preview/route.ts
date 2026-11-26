import { setSession } from '@/lib/session';
// Abre o painel em modo de pré-visualização (dados de exemplo, sem conta e sem ordens).
export async function POST() {
  if (!process.env.SESSION_SECRET) return Response.json({ error: 'Servidor sem SESSION_SECRET configurado' }, { status: 500 });
  setSession('preview', 'preview'); return Response.json({ ok: true });
}
