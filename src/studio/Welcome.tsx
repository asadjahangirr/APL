import { useMemo, useState, type CSSProperties } from 'react';
import Header from '../site/Header';
import Hero from '../site/Hero';
import { headerHref, navigationLinks } from '../project/pages';
import { themePresets, themeStyle } from '../project/theme';
import type { Project } from '../project/schema';
import { createExample, exampleDetails, type ExampleKind } from './examples';
import ProjectCover from './ProjectCover';
import siteCss from '../site/site.css?inline';

export default function Welcome({ start, projects, preview, guide, create }: {
  start: () => void; projects: () => void; preview: (project: Project) => void;
  guide: () => void; create: (project: Project) => void;
}) {
  const [kind, setKind] = useState<ExampleKind>('northline');
  const [theme, setTheme] = useState('original');
  const [layout, setLayout] = useState<'split' | 'editorial' | 'centered'>('split');
  const samples = useMemo(() => ({ northline: createExample('northline'), ellis: createExample('ellis') }), []);
  const selected = useMemo(() => {
    const p = structuredClone(samples[kind]);
    if (theme !== 'original') p.theme = { ...themePresets.find(t => t.id === theme)!.theme };
    const hero = p.pages[0].nodes.find(n => n.type === 'Hero')!;
    hero.props.layout = layout;
    return p;
  }, [samples, kind, theme, layout]);
  const hero = selected.pages[0].nodes.find(n => n.type === 'Hero')!;
  return <main id="main" className="studio-home">
    <section className="welcome-hero">
      <div className="welcome-copy"><p className="studio-eyebrow">An independent space for your next website</p><h1>Make it yours.<br/><em>Take it with you.</em></h1><p className="welcome-intro">Shape a website visually, try it on every screen, and download source code you own.</p><div className="welcome-ctas"><button className="studio-primary" onClick={start}>Start a project <span aria-hidden="true">↗</span></button><button className="studio-text-button" onClick={() => document.getElementById('examples')?.scrollIntoView({ behavior: 'smooth' })}>Explore the examples <span aria-hidden="true">↓</span></button></div><p className="welcome-footnote">No account. No AI key. Saved on your device.</p></div>
      <div className="welcome-art"><img src={exampleDetails[0].image} alt="Original green architectural illustration of a colonnade and courtyard"/></div>
    </section>
    <section id="examples" className="studio-section examples-section"><div className="section-heading"><div><p className="studio-eyebrow">A place to begin</p><h2>A starting point.<br/>Never the final word.</h2></div><p>Two original, fictional brands. Complete pages, real navigation, and a contact module you can export. Open an example and make it your own.</p></div>
      <div className="example-grid">{exampleDetails.map(example => <article className="example-card" key={example.id}><button className="cover-button" onClick={() => preview(samples[example.id])} aria-label={'Preview ' + example.name}><ProjectCover project={samples[example.id]}/><span className="cover-preview">Open live preview ↗</span></button><div className="example-card-heading"><h3>{example.name}</h3><span>{example.category} / {example.pages} pages</span></div><p>{example.description}</p><div className="example-card-actions"><button className="studio-secondary" onClick={() => create(createExample(example.id))}>Use {example.name} <span aria-hidden="true">↗</span></button><button className="studio-text-button" onClick={() => preview(samples[example.id])}>Preview</button></div></article>)}</div>
      <div className="starter-details"><button className="studio-text-button" onClick={start}>Prefer a simple starting point? ↗</button><p>Choose a minimal business or portfolio starter in the new-project screen.</p></div>
    </section>
    <section className="studio-section live-lab"><div className="section-heading"><div><h2>Same story.<br/>A different feeling.</h2></div><p>These are the real header and hero components. Change the theme or composition, then preview the whole website or keep your changes in a new project.</p></div><div className="lab-controls"><label>Example<select aria-label="Live example" value={kind} onChange={e => { setKind(e.target.value as ExampleKind); setLayout(e.target.value === 'ellis' ? 'editorial' : 'split'); }}>{exampleDetails.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label>Composition<select aria-label="Live composition" value={layout} onChange={e => setLayout(e.target.value as typeof layout)}><option value="split">Split introduction</option><option value="editorial">Editorial statement</option><option value="centered">Centered composition</option></select></label><fieldset className="lab-palettes"><legend>Theme</legend>{['original', 'editorial', 'cobalt', 'ink'].map(id => <button key={id} aria-label={'Try ' + id + ' theme'} aria-pressed={theme === id} title={id} onClick={() => setTheme(id)} style={{ '--swatch': id === 'original' ? samples[kind].theme.accent : themePresets.find(t => t.id === id)!.theme.accent } as CSSProperties}><span/><small>{id}</small></button>)}</fieldset></div>
      <div className="live-preview-label"><span>Live component preview / Homepage</span><button onClick={() => preview(selected)}>Open full responsive preview ↗</button></div><div className="live-component-preview"><style>{siteCss}</style><div className="site" inert data-font={selected.theme.font} style={themeStyle(selected.theme)}><Header {...selected.shared.header.props} href={headerHref(selected) || ''} links={navigationLinks(selected)} activePageId="home"/><Hero {...hero.props}/></div></div><div className="lab-footer"><span>Your choices affect this example only.</span><button className="studio-primary" onClick={() => create({ ...selected, id: crypto.randomUUID(), updatedAt: new Date().toISOString() })}>Start with this look ↗</button></div>
    </section>
    <section className="studio-section journey-section"><div className="section-heading"><div><h2>A clear path<br/>through the studio.</h2></div><button className="studio-text-button" onClick={guide}>Read the quick guide ↗</button></div><ol className="journey-list"><li><span>01</span><div><h3>Design</h3><p>Create freeform artboards with text, images, shapes, and layers. Download editable APL, artboard PNGs, or a visual PDF.</p></div><small>Canvas available now</small></li><li><span>02</span><div><h3>Build</h3><p>Edit pages, arrange sections, choose designs, and connect the content your site needs.</p></div><small>Available now</small></li><li><span>03</span><div><h3>Preview</h3><p>Try mobile, tablet, and desktop. Links navigate; contact submissions stay in sample mode inside the builder.</p></div><small>Available now</small></li><li><span>04</span><div><h3>Download</h3><p>Keep both modes in an editable APL backup, share PNG/PDF artboards, or download independent website code with setup guides.</p></div><small>Available now</small></li></ol></section>
    <section className="welcome-close"><p className="studio-eyebrow">Your ideas. Your website. Your source.</p><h2>Ready when you are.</h2><div><button className="studio-primary" onClick={start}>Open the studio ↗</button><button className="studio-text-button" onClick={projects}>Your saved projects</button></div></section>
  </main>;
}
