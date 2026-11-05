import { createHmac } from 'node:crypto';
import { database, json, sameOrigin } from '../../../lib/server';
import { contactInput } from '../../../lib/contact';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'This website is not configured for this address.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Expected JSON.' }, 415);
  // Bound actual streamed bytes, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'Missing message.' }, 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 20_000) { await reader.cancel(); return json({ error: 'Message is too large.' }, 413); }
    chunks.push(value);
  }
  let payload: unknown;
  try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return json({ error: 'Invalid message.' }, 400); }
  const input = contactInput.safeParse(payload);
  if (!input.success) return json({ error: 'Check your name, email, and message (10–4000 characters).' }, 400);
  if (input.data.website) return json({ ok: true });
  if (!process.env.CONTACT_HASH_SECRET || process.env.CONTACT_HASH_SECRET.length < 32) return json({ error: 'Contact form setup is incomplete.' }, 503);
  try {
    const db = database();
    const { name, email, message } = input.data;
    const key = createHmac('sha256', process.env.CONTACT_HASH_SECRET).update(email).digest('hex');
    const saved = await db.rpc('submit_contact', { p_name: name, p_email: email, p_message: message, p_rate_key: key });
    if (saved.error) {
      if (saved.error.message.includes('RATE_LIMIT')) return json({ error: 'Too many messages. Please try again later.' }, 429);
      return json({ error: 'Could not save your message. Please try again.' }, 503);
    }
    // Delivery is attempted only after the database transaction succeeds.
    if (process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL && process.env.CONTACT_NOTIFY_EMAIL) {
      let delivery = 'failed';
      try {
        const sent = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST', signal: AbortSignal.timeout(5000),
          headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: { email: process.env.BREVO_SENDER_EMAIL }, to: [{ email: process.env.CONTACT_NOTIFY_EMAIL }], replyTo: { email, name }, subject: 'New website inquiry', textContent: name + '\n' + email + '\n\n' + message })
        });
        if (sent.ok) delivery = 'sent';
      } catch { /* Keep the saved inquiry even when delivery fails. */ }
      await db.from('contact_submissions').update({ email_status: delivery }).eq('id', saved.data);
    }
    return json({ ok: true }, 201);
  } catch { return json({ error: 'Contact form setup is incomplete or the service is unavailable.' }, 503); }
}

