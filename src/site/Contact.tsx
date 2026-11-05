'use client';
import { useState, type FormEvent } from 'react';
import type { ComponentProps } from '../project/schema';
import { appearanceStyle, authoredClass } from './authored-style';
export default function Contact({ title, description, button, appearance, buttonAppearance, fieldAppearance, preview = false }: ComponentProps['Contact'] & { preview?: boolean }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (preview) { setStatus('Preview only: this message was not sent.'); return; }
    setBusy(true); setStatus('');
    try {
      const values = Object.fromEntries(new FormData(form));
      const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Message could not be saved. Please try again.');
      setStatus('Thank you. Your message has been received.'); form.reset();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Connection failed. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section id="contact" className={authoredClass('site-section site-container contact-section', appearance)} style={appearanceStyle(appearance)}><div><h2 className={authoredClass('apl-contact-heading', appearance)} style={{ ...(appearance ? { whiteSpace: 'pre-line' } as const : {}), ...appearanceStyle(appearance, ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color']) }}>{title}</h2><p className={authoredClass('apl-contact-description', appearance)} style={{ ...(appearance ? { whiteSpace: 'pre-line' } as const : {}), ...appearanceStyle(appearance, ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color']) }}>{description}</p>{preview && <small className="sample-badge">Sample mode · no messages sent</small>}</div><form onSubmit={submit}>
    <label>Your name<input className={authoredClass('apl-contact-field', fieldAppearance)} style={appearanceStyle(fieldAppearance)} name="name" autoComplete="name" required maxLength={120}/></label>
    <label>Email address<input className={authoredClass('apl-contact-field', fieldAppearance)} style={appearanceStyle(fieldAppearance)} name="email" type="email" autoComplete="email" required maxLength={254}/></label>
    <label>What are you working on?<textarea className={authoredClass('apl-contact-field', fieldAppearance)} style={appearanceStyle(fieldAppearance)} name="message" required minLength={10} maxLength={4000} rows={4}/></label>
    <div className="honeypot" aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
    <button className={authoredClass('site-button', buttonAppearance)} style={appearanceStyle(buttonAppearance)} disabled={busy}>{busy ? 'Sending…' : button}<span aria-hidden="true"> ↗</span></button><p role="status" className="form-status">{status}</p>
  </form></section>;
}

