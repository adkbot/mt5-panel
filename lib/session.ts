import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
const sig = (b: string) => createHmac('sha256', process.env.SESSION_SECRET!).update(b).digest('base64url');
export function setSession(accountId: string, userKey: string) {
  const b = Buffer.from(JSON.stringify({ a: accountId, k: userKey, e: Date.now() + 30 * 864e5 })).toString('base64url');
  cookies().set('s', `${b}.${sig(b)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 30 * 86400 });
}
function read(): any {
  const v = cookies().get('s')?.value; if (!v) return null;
  const [b, s] = v.split('.'); if (!b || !s || s.length !== sig(b).length) return null;
  if (!timingSafeEqual(Buffer.from(s), Buffer.from(sig(b)))) return null;
  const p = JSON.parse(Buffer.from(b, 'base64url').toString()); return p.e > Date.now() ? p : null;
}
export const getSession = (): string | null => read()?.a ?? null;
export const getUserKey = (): string | null => read()?.k ?? null;
export const clearSession = () => cookies().delete('s');
