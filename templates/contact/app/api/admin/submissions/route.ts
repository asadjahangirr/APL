import { administrator, json, sameOrigin } from '../../../../lib/server';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const db = await administrator(request);
    if (!db) return json({ error: 'Administrator access required.' }, 401);
    const result = await db.from('contact_submissions').select('id,name,email,message,status,email_status,created_at').order('created_at', { ascending: false }).limit(100);
    if (result.error) return json({ error: 'Inbox unavailable.' }, 503);
    return json({ submissions: result.data });
  } catch { return json({ error: 'Backend setup is incomplete.' }, 503); }
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Invalid origin.' }, 403);
  try {
    const db = await administrator(request);
    if (!db) return json({ error: 'Administrator access required.' }, 401);
    const body = await request.text();
    if (body.length > 1000) return json({ error: 'Request too large.' }, 413);
    const input = JSON.parse(body);
    if (typeof input.id !== 'string' || !/^[0-9a-f-]{36}$/.test(input.id) || !['new','read'].includes(input.status)) return json({ error: 'Invalid update.' }, 400);
    const result = await db.from('contact_submissions').update({ status: input.status }).eq('id', input.id).select('id').maybeSingle();
    if (result.error) return json({ error: 'Update failed.' }, 503);
    return result.data ? json({ ok: true }) : json({ error: 'Not found.' }, 404);
  } catch { return json({ error: 'Invalid request or unavailable backend.' }, 400); }
}

