import { useEffect, useMemo, useState } from 'react';
import { BREAKPOINTS, BREAKPOINT_WIDTH } from '../doc/breakpoints';
import { lumenSample } from '../doc/samples';
import { SitePage } from '../render/SitePage';
import './v2.css';

/** Batch 1 demo: the sample SiteDoc rendered by the shared renderer. */
export default function RenderDemo() {
  const doc = useMemo(() => lumenSample(), []);
  const [view, setView] = useState<'live' | 'all'>('live');
  useEffect(() => {
    // Interim font loading for the demo; proper Google Fonts support arrives with typography.
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap' });
    document.head.append(link);
    document.title = 'APL v2 · Render preview';
    return () => link.remove();
  }, []);
  const page = doc.pages[0];
  return (
    <div className="v2-demo">
      <header className="v2-bar">
        <strong>APL v2</strong>
        <span className="v2-muted">Render preview: one design document, rendered as a real website</span>
        <div className="v2-seg" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === 'live'} onClick={() => setView('live')}>Live (resize window)</button>
          <button role="tab" aria-selected={view === 'all'} onClick={() => setView('all')}>All breakpoints</button>
        </div>
      </header>
      {view === 'live' ? (
        <SitePage doc={doc} pageId={page.id} mode="responsive" scope="site-live" />
      ) : (
        <div className="v2-boards">
          {BREAKPOINTS.map(bp => (
            <figure key={bp} className="v2-board">
              <figcaption>{bp[0].toUpperCase() + bp.slice(1)} · {BREAKPOINT_WIDTH[bp]}px</figcaption>
              <div className="v2-frame" style={{ width: BREAKPOINT_WIDTH[bp], zoom: 0.5 }}>
                <SitePage doc={doc} pageId={page.id} mode={{ breakpoint: bp }} scope={'site-' + bp} />
              </div>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
