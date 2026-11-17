import { useEffect, useState } from 'react';
import type { DesignCode } from './code';
import { IconButton } from './controls';
import { X } from './icons';

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back to a hidden field */ }
  const field = Object.assign(document.createElement('textarea'), { value: text });
  field.style.cssText = 'position:fixed;opacity:0';
  document.body.append(field);
  field.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  field.remove();
  return ok;
}

/** Shows the HTML + CSS or React code of a design, with one-click copy. */
export function CodeDialog({ title, code, onClose }: { title: string; code: DesignCode; onClose: () => void }) {
  const [tab, setTab] = useState<'html' | 'react'>('html');
  const [copied, setCopied] = useState(false);
  const text = code[tab];
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 1800); return () => clearTimeout(timer); }, [copied]);
  return (
    <div className="code-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="code" role="dialog" aria-modal="true" aria-label={`Code for ${title}`}>
        <header className="code-head">
          <div className="code-title"><h2>{title}</h2><span>Responsive, with fonts and animations included</span></div>
          <div className="code-tabs" role="tablist" aria-label="Format">
            <button type="button" role="tab" aria-selected={tab === 'html'} onClick={() => setTab('html')}>HTML + CSS</button>
            <button type="button" role="tab" aria-selected={tab === 'react'} onClick={() => setTab('react')}>React</button>
          </div>
          <button type="button" className="code-copy" onClick={() => void copyText(text).then(setCopied)}>{copied ? 'Copied ✓' : 'Copy code'}</button>
          <IconButton label="Close code" shortcut="Esc" onClick={onClose}><X size={16} /></IconButton>
        </header>
        <pre className="code-body" tabIndex={0}><code>{text}</code></pre>
        <footer className="code-foot">{text.split('\n').length.toLocaleString('en-US')} lines · {(text.length / 1024).toFixed(1)} KB · paste into any page or component</footer>
      </div>
    </div>
  );
}
