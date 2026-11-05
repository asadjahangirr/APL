import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import type { IconProps } from '@phosphor-icons/react';

export function IconButton({ icon: Icon, label, active, children, className = '', ...props }: { icon: ComponentType<IconProps>; label: string; active?: boolean; children?: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={'dc-button ' + (active ? 'is-active ' : '') + className} aria-label={label} title={label} aria-pressed={active === undefined ? undefined : active} {...props}><Icon size={19} weight="regular" aria-hidden="true"/>{children}</button>;
}

export function NumberField({ label, value, min = -100000, max = 100000, step = 1, onChange, disabled = false }: { label: string; value: number; min?: number; max?: number; step?: number; disabled?: boolean; onChange: (value: number) => void }) {
  const displayed = String(Math.round(value * 100) / 100);
  const [draft, setDraft] = useState(displayed);
  const edited = useRef(false);
  useEffect(() => { setDraft(String(Math.round(value * 100) / 100)); edited.current = false; }, [value]);
  return <label className="dc-field"><span>{label}</span><input type="number" value={draft} min={min} max={max} step={step} disabled={disabled} onChange={event => { edited.current = true; setDraft(event.target.value); }} onBlur={() => { if (!edited.current) return; edited.current = false; const next = Number(draft); setDraft(displayed); if (draft.trim() && Number.isFinite(next) && next >= min && next <= max && next !== value) onChange(next); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/></label>;
}

export function TextField({ label, value, onChange, multiline = false, maxLength = 100, disabled = false }: { label: string; value: string; multiline?: boolean; maxLength?: number; disabled?: boolean; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const shared = { value: draft, disabled, maxLength, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value), onBlur: () => { if (draft !== value && (multiline || draft.trim())) onChange(multiline ? draft : draft.trim()); else setDraft(value); } };
  return <label className="dc-field"><span>{label}</span>{multiline ? <textarea {...shared} rows={4}/> : <input {...shared} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/>}</label>;
}

export function ColorField({ label, value, onChange, disabled = false }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <label className="dc-field dc-color-field"><span>{label}</span><div><input type="color" aria-label={label + ' picker'} value={/^#[a-f0-9]{6}/i.test(value) ? value.slice(0, 7) : '#ffffff'} disabled={disabled} onChange={event => onChange(event.target.value)}/><input aria-label={label + ' value'} value={draft} maxLength={11} disabled={disabled} onChange={event => setDraft(event.target.value)} onBlur={() => { if (/^(#[a-f0-9]{6}|#[a-f0-9]{8}|transparent)$/i.test(draft)) onChange(draft); else setDraft(value); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}/></div></label>;
}
