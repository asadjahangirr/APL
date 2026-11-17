import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface Gesture { begin(): void; end(): void }

const format = (value: number, precision: number) => String(Math.round(value * 10 ** precision) / 10 ** precision);

/**
 * Figma-style numeric field: type a value (simple + - * / math allowed),
 * use ↑/↓ (Shift ×10), or drag the label to scrub.
 */
export function NumberField({ label, value, onChange, min = -100_000, max = 100_000, step = 1, precision = 2, suffix, disabled, title, mixed, gesture, wide }: {
  label: ReactNode; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; precision?: number;
  suffix?: string; disabled?: boolean; title?: string; mixed?: boolean; gesture?: Gesture; wide?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState(mixed ? 'Mixed' : format(value, precision));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(mixed ? 'Mixed' : format(value, precision)); }, [value, mixed, precision]);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = (text: string) => {
    const expression = text.trim().replace(/,/g, '.');
    let next = Number(expression);
    if (!Number.isFinite(next) && /^[-+*/().\d\s]+$/.test(expression)) {
      try { next = Function('"use strict";return (' + expression + ')')() as number; } catch { next = NaN; }
    }
    if (Number.isFinite(next)) { const clamped = clamp(next); onChange(clamped); setDraft(format(clamped, precision)); }
    else setDraft(mixed ? 'Mixed' : format(value, precision));
  };
  const scrub = (event: React.PointerEvent<HTMLLabelElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget, startX = event.clientX, start = mixed ? 0 : value;
    target.setPointerCapture(event.pointerId);
    let moved = false;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 2) return;
      if (!moved) { moved = true; gesture?.begin(); }
      onChange(clamp(Math.round((start + dx * step * (e.shiftKey ? 10 : 1)) / step) * step));
    };
    const up = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); if (moved) gesture?.end(); };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', up);
  };
  return (
    <div className={'ed-num' + (disabled ? ' is-disabled' : '') + (wide ? ' is-wide' : '')} title={title}>
      <label htmlFor={id} onPointerDown={scrub}>{label}</label>
      <input
        id={id} value={draft} disabled={disabled} inputMode="decimal" spellCheck={false}
        onFocus={event => { focused.current = true; event.currentTarget.select(); }}
        onBlur={event => { focused.current = false; commit(event.currentTarget.value); }}
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') { commit(event.currentTarget.value); event.currentTarget.blur(); }
          else if (event.key === 'Escape') { setDraft(format(value, precision)); event.currentTarget.blur(); }
          else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const next = clamp((mixed ? 0 : value) + (event.key === 'ArrowUp' ? 1 : -1) * step * (event.shiftKey ? 10 : 1));
            onChange(next); setDraft(format(next, precision));
          }
        }}
      />
      {suffix && <span className="ed-num-suffix">{suffix}</span>}
    </div>
  );
}

const HEX = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
/** Color swatch + hex input. Supports #RRGGBB and #RRGGBBAA (alpha shown as %). */
export function ColorField({ value, onChange, gesture, label = 'Color' }: { value: string; onChange: (value: string) => void; gesture?: Gesture; label?: string }) {
  const [draft, setDraft] = useState(value.slice(1, 7).toUpperCase());
  useEffect(() => setDraft(value.slice(1, 7).toUpperCase()), [value]);
  const alpha = value.length === 9 ? parseInt(value.slice(7), 16) / 255 : 1;
  const withAlpha = (rgb: string, a: number) => (a >= 1 ? rgb : rgb + Math.round(a * 255).toString(16).padStart(2, '0')).toUpperCase();
  return (
    <div className="ed-color">
      <span className="ed-swatch" style={{ background: value }}>
        <input
          type="color" aria-label={label} value={value.slice(0, 7).toLowerCase()}
          onFocus={() => gesture?.begin()} onBlur={() => gesture?.end()}
          onChange={event => onChange(withAlpha(event.target.value, alpha))}
        />
      </span>
      <input
        className="ed-hex" aria-label={label + ' hex'} value={draft} spellCheck={false}
        onChange={event => setDraft(event.target.value)}
        onBlur={event => { const m = HEX.exec(event.target.value.trim()); if (m) onChange(withAlpha('#' + m[1].slice(0, 6), m[1].length === 8 ? parseInt(m[1].slice(6), 16) / 255 : alpha)); else setDraft(value.slice(1, 7).toUpperCase()); }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      />
      <NumberField label="" value={Math.round(alpha * 100)} min={0} max={100} precision={0} suffix="%" onChange={percent => onChange(withAlpha(value.slice(0, 7), percent / 100))} gesture={gesture} title="Opacity" />
    </div>
  );
}

export function Select<T extends string | number>({ label, value, options, onChange, disabled, title }: {
  label?: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void; disabled?: boolean; title?: string;
}) {
  return (
    <label className="ed-select" title={title}>
      {label && <span>{label}</span>}
      <select value={String(value)} disabled={disabled} onChange={event => onChange(options.find(([key]) => String(key) === event.target.value)![0])}>
        {options.map(([key, text]) => <option key={String(key)} value={String(key)}>{text}</option>)}
      </select>
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder, multiline, validate }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; validate?: (value: string) => string | null;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setDraft(value); setError(null); }, [value]);
  const commit = () => {
    if (draft === value) return;
    const problem = validate?.(draft) ?? null;
    setError(problem);
    if (!problem) onChange(draft); else setDraft(draft);
  };
  const props = {
    value: draft, placeholder, spellCheck: false, 'aria-invalid': error ? true : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setDraft(event.target.value),
    onBlur: commit,
    onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'Enter' && !multiline) (event.currentTarget as HTMLElement).blur(); if (event.key === 'Escape') { setDraft(value); setError(null); } },
  };
  return (
    <label className="ed-text-field">
      <span>{label}</span>
      {multiline ? <textarea rows={3} {...props} /> : <input {...props} />}
      {error && <small role="alert">{error}</small>}
    </label>
  );
}

export function Section({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <section className="ed-section">
      <header><h3>{title}</h3>{action}</header>
      {children && <div className="ed-section-body">{children}</div>}
    </section>
  );
}

export function IconButton({ label, onClick, children, active, disabled, shortcut, className }: {
  label: string; onClick: () => void; children: ReactNode; active?: boolean; disabled?: boolean; shortcut?: string; className?: string;
}) {
  return (
    <button type="button" className={'ed-icon-btn' + (active ? ' is-active' : '') + (className ? ' ' + className : '')} aria-label={label} aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, ReactNode, string])[]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="ed-segmented" role="radiogroup" aria-label={label}>
      {options.map(([key, content, title]) => (
        <button key={key} type="button" role="radio" aria-checked={value === key} title={title} aria-label={title} onClick={() => onChange(key)}>{content}</button>
      ))}
    </div>
  );
}
