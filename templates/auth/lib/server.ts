import 'server-only';
import { createClient } from '@supabase/supabase-js';
export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('BACKEND_NOT_CONFIGURED');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function sameOrigin(request: Request) {
  const site = process.env.SITE_URL;
  if (!site) return false;
  try { return request.headers.get('origin') === new URL(site).origin; } catch { return false; }
}
export async function administrator(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const db = database();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const member = await db.from('site_admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return !member.error && member.data ? db : null;
}
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

