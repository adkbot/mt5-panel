import { createClient } from '@supabase/supabase-js';
import { getUserKey } from '@/lib/session';
// Só o servidor acessa o banco (service role). A tabela tem RLS ligado e sem acesso para anon/authenticated.
const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const KEYS = ['indicators', 'journal', 'profile', 'guard'];
const bad = (m: string, s: number) => Response.json({ error: m }, { status: s });
export async function GET() {
  const k = getUserKey(); if (!k) return bad('Não conectado', 401);
  if (k === 'preview') return Response.json({});
  const { data, error } = await db().from('panel_state').select('key,value').eq('user_key', k);
  if (error) return bad(error.message, 500);
  return Response.json(Object.fromEntries((data || []).map((r: any) => [r.key, r.value])));
}
export async function PUT(r: Request) {
  const k = getUserKey(); if (!k) return bad('Não conectado', 401);
  if (k === 'preview') return Response.json({ ok: true });
  const { key, value } = await r.json();
  if (!KEYS.includes(key) || value === undefined) return bad('Chave inválida', 400);
  if (JSON.stringify(value).length > 500000) return bad('Dados grandes demais', 413);
  const { error } = await db().from('panel_state').upsert({ user_key: k, key, value, updated_at: new Date().toISOString() }, { onConflict: 'user_key,key' });
  return error ? bad(error.message, 500) : Response.json({ ok: true });
}
