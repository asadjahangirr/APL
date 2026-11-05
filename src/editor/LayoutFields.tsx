import type { ComponentProps, LayoutPreset, Project, Responsive } from '../project/schema';
import { pageAnchors } from '../project/pages';
import CompositionPicker from './CompositionPicker';
import { layoutOptions } from '../site/layout-utils';

const devices = ['mobile', 'tablet', 'desktop'] as const;
function inherited<T>(value: Responsive<T>, device: 'tablet' | 'desktop'): T { return device === 'tablet' ? value.mobile : value.tablet ?? value.mobile; }
export function ResponsiveNumber({ label, value, onChange, min = 0, max }: { label: string; value: Responsive<number>; onChange: (next: Responsive<number>) => void; min?: number; max: number }) {
  return <fieldset className="layout-field"><legend>{label}</legend><div className="responsive-field-grid">{devices.map(device => <label key={device}><span>{device}</span>
    <input aria-label={device + ' ' + label} type="number" min={min} max={max} step={1} value={value[device] ?? ''} placeholder={device === 'mobile' ? undefined : String(inherited(value, device))}
      onChange={event => { const raw = event.target.value; const next = { ...value }; if (raw === '' && device !== 'mobile') delete next[device]; else next[device] = Number(raw); onChange(next); }}/>
    {device !== 'mobile' && <small>{value[device] === undefined ? 'Inherits ' + inherited(value, device) + 'px' : 'Own value · clear to inherit'}</small>}
  </label>)}</div><small>Pixels. Larger screens inherit the previous screen when left empty.</small></fieldset>;
}
export function LayoutPresetField({ value, onChange }: { value: Responsive<LayoutPreset>; onChange: (next: Responsive<LayoutPreset>) => void }) {
  return <fieldset className="layout-field"><legend>Column widths</legend>{devices.map(device => <label className="layout-select" key={device}><span>{device}</span><select aria-label={device + ' column widths'} value={value[device] ?? 'inherit'} onChange={event => {
    const next = { ...value }; if (event.target.value === 'inherit' && device !== 'mobile') delete next[device]; else next[device] = event.target.value as LayoutPreset; onChange(next);
  }}>{device !== 'mobile' && <option value="inherit">Inherit · {layoutOptions.find(option => option.value === inherited(value, device))?.label}</option>}{layoutOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
    <p className="layout-field-note">Presets arrange existing columns in reading order. Extra columns wrap onto another row; no content is removed.</p>
  </fieldset>;
}
export function ButtonDesignField({ value, onChange }: { value: ComponentProps['Button']['variant']; onChange: (value: ComponentProps['Button']['variant']) => void }) {
  return <CompositionPicker family="button" value={value} onChange={onChange}/>;
}
export function TargetField({ value, onChange, project, subject = 'Button' }: { value: ComponentProps['Button']['target']; onChange: (value: ComponentProps['Button']['target']) => void; project: Project; subject?: string }) {
  const options = project.pages.flatMap(page => pageAnchors(page).map(anchor => ({ value: JSON.stringify({ pageId: page.id, anchor }), label: page.name + ' · ' + (anchor === '#top' ? 'top of page' : anchor.slice(1)) })));
  const encoded = JSON.stringify(value);
  return <label className="layout-select">{subject} destination<select aria-label={subject + ' destination'} value={encoded} onChange={event => onChange(JSON.parse(event.target.value))}>
    {!options.some(option => option.value === encoded) && <option value={encoded}>Missing destination — choose a page</option>}
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select></label>;
}
export function IconTargetField({ value, onChange, project }: { value?: ComponentProps['Icon']['target']; onChange: (value?: ComponentProps['Icon']['target']) => void; project: Project }) {
  const options = project.pages.flatMap(page => pageAnchors(page).map(anchor => ({ value: JSON.stringify({ pageId: page.id, anchor }), label: page.name + ' · ' + (anchor === '#top' ? 'top of page' : anchor.slice(1)) })));
  const encoded = value ? JSON.stringify(value) : '';
  return <label className="layout-select">Icon page or section<select aria-label="Icon page or section" value={encoded} onChange={event => onChange(event.target.value ? JSON.parse(event.target.value) : undefined)}>
    <option value="">No internal link</option>
    {value && !options.some(option => option.value === encoded) && <option value={encoded}>Missing destination — choose a page</option>}
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select></label>;
}
