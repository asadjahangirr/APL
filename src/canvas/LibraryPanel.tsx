import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, categoryCount, LIBRARY, LIBRARY_COUNT, previewDoc, searchLibrary, themeFonts, THEMES, type CategoryId, type LibraryItem, type Theme } from '../library/catalog';
import { SitePage } from '../render/SitePage';
import { designCode } from './code';
import { CodeDialog } from './CodeDialog';
import { IconButton } from './controls';
import { loadFonts } from './fonts';
import { MagnifyingGlass, X } from './icons';
import { Preview } from './Preview';

const THEME_KEY = 'apl-v2-library-theme';
const KIND_LABEL = { page: 'Full page', section: 'Section', element: 'Element' } as const;
const CATEGORY_NAME = Object.fromEntries(CATEGORIES.map(category => [category.id, category.name])) as Record<CategoryId, string>;

/** Live thumbnail: the real design, rendered by the site renderer and scaled down. Built only once it scrolls into view. */
const Thumb = memo(function Thumb({ item, theme }: { item: LibraryItem; theme: Theme }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setSeen(true); observer.disconnect(); } }, { rootMargin: '240px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const doc = useMemo(() => (seen ? previewDoc(item, theme) : null), [seen, item, theme]);
  return (
    <div className={item.kind === 'page' ? 'lib-thumb' : 'lib-thumb is-centered'} ref={box} style={{ background: theme.bg }} aria-hidden="true">
      {doc && width > 0 && (
        <div className="lib-thumb-page" style={{ width: item.width, zoom: width / item.width }}>
          <SitePage doc={doc} pageId="page" mode={{ breakpoint: 'desktop' }} scope={'lib-' + item.id} motion interactive={false} />
        </div>
      )}
    </div>
  );
});

/** Browse, search and insert library designs. */
export function LibraryPanel({ onInsert, onClose }: { onInsert: (item: LibraryItem, theme: Theme) => void; onClose: () => void }) {
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [themeId, setThemeId] = useState(() => { try { return localStorage.getItem(THEME_KEY) ?? THEMES[0].id; } catch { return THEMES[0].id; } });
  const theme = THEMES.find(value => value.id === themeId) ?? THEMES[0];
  const grid = useRef<HTMLDivElement>(null);
  const [codeFor, setCodeFor] = useState<LibraryItem | null>(null);
  const [previewFor, setPreviewFor] = useState<LibraryItem | null>(null);
  const previewing = useMemo(() => (previewFor ? previewDoc(previewFor, theme) : null), [previewFor, theme]);
  const code = useMemo(() => (codeFor ? designCode(previewDoc(codeFor, theme), 'root', `${codeFor.name} ${theme.name}`) : null), [codeFor, theme]);
  const items = useMemo(() => searchLibrary(query, category), [query, category]);

  useEffect(() => { loadFonts(themeFonts(theme)); try { localStorage.setItem(THEME_KEY, theme.id); } catch { /* private mode */ } }, [theme]);
  useEffect(() => { grid.current?.scrollTo({ top: 0 }); }, [category, query]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !codeFor && !previewFor) { event.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, codeFor, previewFor]);

  return (
    <div className="lib-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="lib" role="dialog" aria-modal="true" aria-label="Design library">
        <header className="lib-head">
          <div className="lib-title">
            <h2>Design library</h2>
            <span>{LIBRARY_COUNT.toLocaleString('en-US')} designs · {LIBRARY.length} layouts in {THEMES.length} styles</span>
          </div>
          <label className="lib-search">
            <MagnifyingGlass size={15} />
            <input autoFocus type="search" value={query} placeholder="Search heroes, pricing, navbars, animations…" aria-label="Search designs" onChange={event => setQuery(event.target.value)} />
          </label>
          <IconButton label="Close library" shortcut="Esc" onClick={onClose}><X size={16} /></IconButton>
        </header>

        <div className="lib-themes" role="radiogroup" aria-label="Style">
          <span className="lib-themes-label">Style</span>
          {THEMES.map(value => (
            <button key={value.id} type="button" role="radio" aria-checked={value.id === theme.id} className="lib-theme" onClick={() => setThemeId(value.id)}>
              <span className="lib-swatch" style={{ background: `linear-gradient(135deg, ${value.bg} 0 50%, ${value.primary} 50% 100%)`, boxShadow: `inset 0 0 0 1px #0000001F, inset 0 -6px 0 ${value.accent}` }} />
              {value.name}
            </button>
          ))}
        </div>

        <div className="lib-body">
          <nav className="lib-cats" aria-label="Categories">
            <button type="button" className={category === 'all' ? 'is-on' : ''} onClick={() => setCategory('all')}>All designs <small>{LIBRARY.length}</small></button>
            {CATEGORIES.map(value => (
              <button key={value.id} type="button" className={category === value.id ? 'is-on' : ''} onClick={() => setCategory(value.id)}>{value.name} <small>{categoryCount(value.id)}</small></button>
            ))}
          </nav>
          <div className="lib-grid" ref={grid}>
            {items.length === 0 && <p className="lib-empty">No designs match “{query}”. Try a broader word such as “hero”, “pricing” or “footer”.</p>}
            {items.map(item => (
              <div key={item.id + theme.id} className="lib-card" data-design={item.id}>
                <button type="button" className="lib-card-main" aria-label={`Insert ${item.name}`} onClick={() => onInsert(item, theme)}>
                  <Thumb item={item} theme={theme} />
                  <span className="lib-card-foot">
                    <span className="lib-card-name">{item.name}</span>
                    <small>{KIND_LABEL[item.kind]} · {CATEGORY_NAME[item.category]}</small>
                  </span>
                  <span className="lib-card-add" aria-hidden="true">Insert</span>
                </button>
                <button type="button" className="lib-card-code lib-card-preview" aria-label={`Preview ${item.name}`} title="See it full size with animations, on desktop, tablet and phone" onClick={() => setPreviewFor(item)}>▶ Preview</button>
                <button type="button" className="lib-card-code" aria-label={`Copy code for ${item.name}`} title="Copy HTML + CSS or React code" onClick={() => setCodeFor(item)}>{'</>'} Code</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {previewFor && previewing && <Preview doc={previewing} pageId="page" onClose={() => setPreviewFor(null)} title={`${previewFor.name} · ${theme.name}`} action={{ label: 'Insert this design', run: () => { const item = previewFor; setPreviewFor(null); onInsert(item, theme); } }} />}
      {codeFor && code && <CodeDialog title={`${codeFor.name} · ${theme.name}`} code={code} onClose={() => setCodeFor(null)} />}
    </div>
  );
}
