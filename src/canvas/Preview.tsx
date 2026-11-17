import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BREAKPOINT_WIDTH, BREAKPOINTS, type Breakpoint } from '../doc/breakpoints';
import type { SiteDoc } from '../doc/schema';
import { SitePage } from '../render/SitePage';
import { IconButton, Segmented } from './controls';
import { DeviceMobile, DeviceTablet, Monitor, X } from './icons';

/** Full-screen preview of the current page at a chosen device width, rendered by the shared site renderer. */
export function Preview({ doc, pageId, onClose, title, action }: { doc: SiteDoc; pageId: string; onClose: () => void; title?: string; action?: { label: string; run: () => void } }) {
  const [device, setDevice] = useState<Breakpoint>('desktop');
  const [current, setCurrent] = useState(pageId);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const hasColors = Object.keys(doc.variables ?? {}).length > 0;
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const update = () => setScale(Math.min(1, ((stage.current?.clientWidth ?? 1200) - 32) / BREAKPOINT_WIDTH[device]));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [device]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const page = doc.pages.find(value => value.id === current) ?? doc.pages[0];
  return (
    <div className="ed-preview" role="dialog" aria-modal="true" aria-label="Preview">
      <header className="ed-preview-bar">
        <select aria-label="Page" value={page.id} onChange={event => setCurrent(event.target.value)}>
          {doc.pages.map(value => <option key={value.id} value={value.id}>{value.name} ({value.path})</option>)}
        </select>
        <Segmented label="Device" value={device} onChange={setDevice} options={BREAKPOINTS.map(bp => [bp, bp === 'desktop' ? <Monitor size={16} key={bp} /> : bp === 'tablet' ? <DeviceTablet size={16} key={bp} /> : <DeviceMobile size={16} key={bp} />, `${bp[0].toUpperCase() + bp.slice(1)} (${BREAKPOINT_WIDTH[bp]}px)`] as const)} />
        <span className="ed-muted">{BREAKPOINT_WIDTH[device]}px{scale < 1 ? ` · ${Math.round(scale * 100)}%` : ''}</span>
        {hasColors && <Segmented label="Color mode" value={theme} onChange={setTheme} options={[['light', <span key="l">☀</span>, 'Light colors'], ['dark', <span key="d">☾</span>, 'Dark colors']] as const} />}
        {action && <button type="button" className="ed-btn ed-btn-primary" onClick={action.run}>{action.label}</button>}
        <IconButton label="Close preview" shortcut="Esc" onClick={onClose}><X size={16} /></IconButton>
      </header>
      <div className="ed-preview-stage" ref={stage}>
        <div className="ed-preview-frame" style={{ width: BREAKPOINT_WIDTH[device], zoom: scale }}>
          <SitePage key={page.id + device} doc={doc} pageId={page.id} mode={{ breakpoint: device }} scope="ed-preview-site" motion theme={theme} onNavigate={setCurrent} />
        </div>
      </div>
    </div>
  );
}
