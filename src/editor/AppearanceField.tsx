import { useEffect, useRef, useState } from 'react';
import { responsiveAppearanceSchema, type ResponsiveAppearance } from '../project/appearance-schema';
import { buttonDestinationSchema, type ButtonDestination, type Project } from '../project/schema';
import './appearance-field.css';

export type AppearanceKey = keyof ResponsiveAppearance;
type Screen = 'mobile' | 'tablet' | 'desktop';
const screens: Screen[] = ['mobile', 'tablet', 'desktop'];
const groups: { label: string; keys: AppearanceKey[] }[] = [
  { label: 'Typography', keys: ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight'] },
  { label: 'Colors and borders', keys: ['color', 'background', 'borderColor', 'borderWidth', 'radius'] },
  { label: 'Spacing and size', keys: ['paddingX', 'paddingY', 'gap', 'maxWidth', 'minHeight', 'aspectRatio'] },
];
const labels: Record<AppearanceKey, string> = {
  fontFamily: 'Font family', fontSize: 'Font size', fontWeight: 'Font weight', lineHeight: 'Line height',
  color: 'Text color', background: 'Background', borderColor: 'Border color', borderWidth: 'Border width',
  radius: 'Corner radius', paddingX: 'Side padding', paddingY: 'Top and bottom padding',
  gap: 'Content gap', maxWidth: 'Maximum width', minHeight: 'Minimum height', aspectRatio: 'Image / box ratio',
};
const bounds: Partial<Record<AppearanceKey, { min: number; max: number; step: number | 'any' }>> = {
  fontSize: { min: 4, max: 1000, step: 'any' }, lineHeight: { min: 0.5, max: 4, step: 0.05 },
  borderWidth: { min: 0, max: 100, step: 'any' }, radius: { min: 0, max: 6000, step: 'any' },
  paddingX: { min: 0, max: 400, step: 'any' }, paddingY: { min: 0, max: 400, step: 'any' },
  gap: { min: 0, max: 400, step: 'any' }, maxWidth: { min: 1, max: 12000, step: 'any' },
  minHeight: { min: 0, max: 12000, step: 'any' }, aspectRatio: { min: 0.05, max: 20, step: 'any' },
};
const colors = new Set<AppearanceKey>(['color', 'background', 'borderColor']);

/** Clearing mobile removes a whole override; larger screens simply inherit again. */
export function changeAppearanceValue(value: ResponsiveAppearance | undefined, key: AppearanceKey, screen: Screen, entry: string | number | undefined): ResponsiveAppearance | undefined {
  const next: Record<string, unknown> = { ...value };
  if (entry === undefined && screen === 'mobile') delete next[key];
  else {
    const previous = next[key] as Record<string, unknown> | undefined;
    if (entry !== undefined) next[key] = { ...previous, [screen]: entry };
    else if (previous) { const setting = { ...previous }; delete setting[screen]; next[key] = setting; }
  }
  const checked = responsiveAppearanceSchema.parse(next);
  return Object.keys(checked).length ? checked : undefined;
}

function DraftInput({ value, label, placeholder, disabled, limits, commit }: {
  value: string | number | undefined; label: string; placeholder: string; disabled: boolean;
  limits?: { min: number; max: number; step: number | 'any' }; commit: (raw: string) => boolean;
}) {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  const edited = useRef(false);
  useEffect(() => { setDraft(value === undefined ? '' : String(value)); edited.current = false; }, [value]);
  return <input aria-label={label} type={limits ? 'number' : 'text'} value={draft} placeholder={placeholder} disabled={disabled}
    min={limits?.min} max={limits?.max} step={limits?.step}
    onChange={event => { edited.current = true; setDraft(event.target.value); }}
    onBlur={() => { if (!edited.current) return; edited.current = false; if (!commit(draft)) setDraft(value === undefined ? '' : String(value)); }}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === 'Escape') { edited.current = false; setDraft(value === undefined ? '' : String(value)); event.currentTarget.blur(); }
    }}/>;
}

export default function AppearanceField({ value, onChange, label = 'Authored appearance', fields }: {
  value?: ResponsiveAppearance; onChange: (value: ResponsiveAppearance | undefined) => void;
  label?: string; fields?: readonly AppearanceKey[];
}) {
  const [screen, setScreen] = useState<Screen>('mobile'), [error, setError] = useState('');
  function commit(key: AppearanceKey, raw: string): boolean {
    try {
      const entry = raw.trim() === '' ? undefined : (bounds[key] || key === 'fontWeight') ? Number(raw) : raw.trim();
      const next = changeAppearanceValue(value, key, screen, entry);
      setError('');
      if (JSON.stringify(next) !== JSON.stringify(value)) onChange(next);
      return true;
    } catch {
      const limit = bounds[key];
      setError(labels[key] + ': ' + (colors.has(key) ? 'use #RRGGBB, #RRGGBBAA or transparent.' : limit ? 'enter a number from ' + limit.min + ' to ' + limit.max + '.' : 'choose a valid value.'));
      return false;
    }
  }
  return <details className="appearance-field"><summary>{label}</summary>
    <label className="appearance-screen">Screen<select aria-label={label + ' screen'} value={screen} onChange={event => { setScreen(event.target.value as Screen); setError(''); }}>
      {screens.map(device => <option key={device} value={device}>{device[0].toUpperCase() + device.slice(1)}</option>)}
    </select></label>
    <p className="appearance-help">Mobile starts each override. Blank tablet and desktop values inherit the previous screen. Clear mobile to use the preset.</p>
    {groups.map(group => {
      const keys = group.keys.filter(key => !fields || fields.includes(key));
      return keys.length > 0 && <fieldset key={group.label}><legend>{group.label}</legend>{keys.map(key => {
        const setting = value?.[key], current = setting?.[screen];
        const inherited = screen === 'desktop' ? setting?.tablet ?? setting?.mobile : setting?.mobile;
        const disabled = screen !== 'mobile' && !setting;
        const description = label + ' ' + labels[key].toLowerCase() + ' ' + screen;
        const placeholder = disabled ? 'Set mobile first' : inherited === undefined || screen === 'mobile' ? 'Use preset' : 'Inherit ' + inherited;
        return <label className="appearance-row" key={key}><span>{labels[key]}{bounds[key] && key !== 'lineHeight' && key !== 'aspectRatio' ? ' (px)' : ''}</span>
          {key === 'fontFamily' || key === 'fontWeight' ? <select aria-label={description} value={current ?? ''} disabled={disabled} onChange={event => commit(key, event.target.value)}>
            <option value="">{screen === 'mobile' ? 'Use preset' : 'Inherit'}</option>
            {key === 'fontFamily' ? ['Arial', 'Georgia', 'system-ui', 'monospace'].map(font => <option key={font} value={font}>{font === 'system-ui' ? 'System UI' : font === 'monospace' ? 'Monospace' : font}</option>)
              : [100, 200, 300, 400, 500, 600, 700, 800, 900].map(weight => <option key={weight} value={weight}>{weight}{weight === 400 ? ' · Regular' : weight === 500 ? ' · Medium' : weight === 700 ? ' · Bold' : ''}</option>)}
          </select> : <div className={colors.has(key) ? 'appearance-color' : undefined}>
            {colors.has(key) && <input type="color" aria-label={description + ' picker'} disabled={disabled} value={typeof current === 'string' && /^#[a-f0-9]{6}/i.test(current) ? current.slice(0, 7) : '#ffffff'} onChange={event => commit(key, event.target.value)}/>}
            <DraftInput key={screen + key} label={description} value={current} placeholder={placeholder} disabled={disabled} limits={bounds[key]} commit={raw => commit(key, raw)}/>
          </div>}
        </label>;
      })}</fieldset>;
    })}
    {error && <p role="alert" className="appearance-error">{error}</p>}
    <button type="button" disabled={!value} onClick={() => { onChange(undefined); setError(''); }}>Use preset appearance</button>
  </details>;
}

export function ButtonDestinationField({ value, onChange, subject = 'Button', project }: { value?: ButtonDestination; onChange: (value: ButtonDestination | undefined) => void; subject?: string; project?: Project }) {
  type Kind = ButtonDestination['kind'] | 'internal';
  const [kind, setKind] = useState<Kind>(value?.kind ?? 'internal');
  const valueText = value && 'value' in value ? value.value : '';
  const [draft, setDraft] = useState(valueText), [error, setError] = useState('');
  const edited = useRef(false);
  useEffect(() => { setKind(value?.kind ?? 'internal'); setDraft(valueText); edited.current = false; setError(''); }, [value?.kind, valueText]);
  const descriptions = { url: 'Website address', email: 'Email address', phone: 'Phone number' };
  function choices(selected: 'service' | 'article' | 'portfolio') {
    if (!project) return [];
    const entries = selected === 'service' ? project.content.services : selected === 'article' ? project.content.articles : project.content.portfolio;
    return entries.flatMap(entry => entry.published ? [{ id: entry.id, label: entry.published.title }] : []);
  }
  function apply() {
    if (!edited.current || kind === 'internal' || kind === 'service' || kind === 'article' || kind === 'portfolio') return;
    edited.current = false;
    const next = buttonDestinationSchema.safeParse({ kind, value: draft.trim() });
    if (!next.success) { setError(next.error.issues[0]?.message ?? 'Choose a valid destination.'); return; }
    setError(''); onChange(next.data);
  }
  return <div className="appearance-destination"><label>Action type<select aria-label={subject + ' action type'} value={kind} onChange={event => {
    const next = event.target.value as Kind; setKind(next); setDraft(value?.kind === next && 'value' in value ? value.value : ''); edited.current = false; setError('');
    if (next === 'internal') onChange(undefined);
    else if (next === 'service' || next === 'article' || next === 'portfolio') { const first = choices(next)[0]; if (first) onChange({ kind: next, entryId: first.id }); }
  }}><option value="internal">Page or section</option><option value="url">Open a website</option><option value="email">Write an email</option><option value="phone">Call a phone number</option><option value="service" disabled={!choices('service').length}>Published service</option><option value="article" disabled={!choices('article').length}>Published article</option><option value="portfolio" disabled={!choices('portfolio').length}>Published portfolio project</option></select></label>
    {(kind === 'service' || kind === 'article' || kind === 'portfolio') && <label>Published item<select aria-label={subject + ' published item'} value={value?.kind === kind ? value.entryId : ''} onChange={event => onChange({ kind, entryId: event.target.value })}>{value?.kind === kind && !choices(kind).some(item => item.id === value.entryId) && <option value={value.entryId}>Missing or unpublished item — choose another</option>}{choices(kind).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
    {(kind === 'url' || kind === 'email' || kind === 'phone') && <label>{descriptions[kind]}<input aria-label={subject + ' ' + descriptions[kind].toLowerCase()} value={draft} maxLength={kind === 'url' ? 2048 : kind === 'email' ? 254 : 30}
      placeholder={kind === 'url' ? 'https://example.com' : kind === 'email' ? 'hello@example.com' : '+92 300 1234567'}
      onChange={event => { setDraft(event.target.value); edited.current = true; setError(''); }} onBlur={apply} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}/></label>}
    <p className="appearance-help">{kind === 'internal' ? 'Choose a page or section below.' : kind === 'service' || kind === 'article' || kind === 'portfolio' ? 'This link follows the selected published item. Unpublished or missing items must be fixed before download.' : 'Enter a valid address to apply this action. The page destination below is used for page or section actions.'}</p>
    {error && <p className="appearance-error" role="alert">{error}</p>}
  </div>;
}
