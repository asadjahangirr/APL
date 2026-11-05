import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle, DeviceMobile, Monitor, SpinnerGap, X } from '../design/icons';
import { pageAnchors } from '../project/pages';
import type { Project, LayoutPreset, Responsive } from '../project/schema';
import { createStudioProject, type StudioProject } from '../project/studio-document';
import { getCurrentStudioProject, getStudioRevision, saveStudioProject } from '../project/storage';
import { suggestConversionPlan, analyzeConversion, compileConversion, updateConversion, compareConversion } from './engine';
import type { ConversionPlan, ConversionSection, ConversionItem, ConversionDestination, ConversionRecord } from './schema';
import WebsiteFrame from './WebsiteFrame';
import { businessConversionPlan } from './demo';
import AppearanceField from '../editor/AppearanceField';
import './conversion.css';

const steps = ['Page', 'Structure', 'Connections', 'Review'] as const;
const presets: LayoutPreset[] = ['stack', 'halves', 'thirds', 'quarters', 'one-two', 'two-one', 'one-three', 'three-one'];
const labels: Record<LayoutPreset, string> = { stack: 'Stack', halves: 'Two equal columns', thirds: 'Three equal columns', quarters: 'Four equal columns', 'one-two': 'Narrow / wide', 'two-one': 'Wide / narrow', 'one-three': 'Small / large', 'three-one': 'Large / small' };
type Proposal = { studio: StudioProject; revision: number; pageId: string };
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'This conversion could not be prepared.';
function move<T>(items: T[], index: number, offset: number): T[] {
  const next = [...items]; const target = index + offset;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
function Reorder({ index, count, label, change }: { index: number; count: number; label: string; change: (offset: number) => void }) {
  return <span className="conversion-order"><button aria-label={`Move ${label} up`} disabled={!index} onClick={() => change(-1)}><ArrowUp/></button><button aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => change(1)}><ArrowDown/></button></span>;
}
function Spacing({ label, value, change }: { label: string; value: Responsive<number>; change: (value: Responsive<number>) => void }) {
  return <fieldset className="conversion-spacing"><legend>{label}</legend>{(['mobile', 'tablet', 'desktop'] as const).map(device => <label key={device}>{device}<input aria-label={`${device} ${label}`} type="number" min={0} max={400} value={value[device] ?? ''} placeholder={String(device === 'desktop' ? value.tablet ?? value.mobile : value.mobile)} onChange={event => {
    const next = { ...value }; if (event.target.value === '' && device !== 'mobile') delete next[device]; else next[device] = Number(event.target.value); change(next);
  }}/></label>)}</fieldset>;
}
function Destination({ value, plan, website, change }: { value?: ConversionDestination; plan: ConversionPlan; website: Project; change: (value?: ConversionDestination) => void }) {
  const kind = value?.kind || '';
  return <div className="conversion-destination"><label>Action<select aria-label="Action type" value={kind} onChange={event => {
    const kind = event.target.value;
    change(kind === 'section' ? { kind, sectionId: plan.sections[0].id } : kind === 'page' ? { kind, pageId: website.pages[0].id, anchor: '#top' } : kind === 'url' || kind === 'email' || kind === 'phone' ? { kind, value: '' } : undefined);
  }}><option value="">Choose an action</option><option value="section">Go to a section</option><option value="page">Go to an existing page</option><option value="url">Open a website</option><option value="email">Send an email</option><option value="phone">Call a number</option></select></label>
    {value?.kind === 'section' && <label>Section<select aria-label="Section destination" value={value.sectionId} onChange={event => change({ ...value, sectionId: event.target.value })}>{plan.contact && <option value="contact">Contact form</option>}{plan.sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>}
    {value?.kind === 'page' && <label>Page and section<select aria-label="Page destination" value={JSON.stringify({ pageId: value.pageId, anchor: value.anchor })} onChange={event => change({ kind: 'page', ...JSON.parse(event.target.value) })}>{website.pages.flatMap(page => pageAnchors(page).map(anchor => <option key={page.id + anchor} value={JSON.stringify({ pageId: page.id, anchor })}>{page.name} · {anchor}</option>))}</select></label>}
    {value && 'value' in value && <label>{value.kind === 'url' ? 'Website URL' : value.kind === 'email' ? 'Email address' : 'Phone number'}<input aria-label="Action destination" value={value.value} placeholder={value.kind === 'url' ? 'https://example.com' : value.kind === 'email' ? 'hello@example.com' : '+923001234567'} onChange={event => change({ ...value, value: event.target.value })}/></label>}
  </div>;
}

export default function ConversionStudio({ project, artboardId, close, applied }: { project: Project; artboardId?: string; close: () => void; applied: (studio: StudioProject, pageId: string, saved: boolean, message?: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const comparisonView = useRef<HTMLDivElement>(null);
  const draftRevision = useRef(0);
  const [base, setBase] = useState<StudioProject>();
  const [plan, setPlan] = useState<ConversionPlan>();
  const [record, setRecord] = useState<ConversionRecord>();
  const [states, setStates] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [proposal, setProposal] = useState<Proposal>();
  const [width, setWidth] = useState(1280);
  const [designUrl, setDesignUrl] = useState('');
  const [conflict, setConflict] = useState<'copy' | 'replace'>('copy');
  const [approved, setApproved] = useState(false);
  const [reviewedWidths, setReviewedWidths] = useState<number[]>([]);
  const [replacePageSettings, setReplacePageSettings] = useState(false);
  useEffect(() => { if (proposal) comparisonView.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, [proposal]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    let active = true;
    void getCurrentStudioProject(project).then(async studio => {
      if (!active) return;
      setBase(studio);
      if (artboardId && studio.design.artboards.some(board => board.id === artboardId)) setPlan(artboardId === 'business-desktop' ? businessConversionPlan(studio.design, studio.website) : suggestConversionPlan(studio.design, artboardId, studio.website));
      const entries = await Promise.all(studio.conversions.map(async entry => [entry.id, await compareConversion(studio.design, studio.website, entry)] as const));
      if (active) setStates(Object.fromEntries(entries));
    }).catch(error => active && setError(messageOf(error)));
    return () => { active = false; previous?.focus(); };
  }, [project.id, artboardId]);
  useEffect(() => {
    let active = true, url = '';
    setDesignUrl('');
    if (base && plan) void import('../design/export').then(({ renderArtboardPNG }) => renderArtboardPNG(base.design, plan.artboardId)).then(blob => {
      url = URL.createObjectURL(blob); if (active) setDesignUrl(url); else URL.revokeObjectURL(url);
    }).catch(error => active && setError(messageOf(error)));
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [base, plan?.artboardId]);
  const analysis = base && plan ? analyzeConversion(base.design, base.website, plan, record && conflict === 'replace' ? { targetPageId: record.pageId } : undefined) : undefined;
  const warnings = analysis?.issues.filter(issue => issue.severity === 'warning') || [];
  const allAcknowledged = warnings.every(issue => acknowledged.includes(issue.id));
  const board = base?.design.artboards.find(board => board.id === plan?.artboardId);
  const updatePlan = (next: ConversionPlan) => { draftRevision.current += 1; setPlan(next); setProposal(undefined); setApproved(false); setReviewedWidths([]); setAcknowledged([]); setError(''); };
  function independentPlan(source: ConversionPlan): ConversionPlan {
    let path = source.page.path + '-copy', suffix = 2;
    while (base?.website.pages.some(page => page.path === path)) path = source.page.path + '-copy-' + suffix++;
    return { ...structuredClone(source), page: { ...source.page, name: (source.page.name.slice(0, 48) + ' (copy)'), path } };
  }
  function chooseRecord(entry: ConversionRecord) {
    const replace = states[entry.id] === 'current' || states[entry.id] === 'design-changed';
    setRecord(entry); setConflict(replace ? 'replace' : 'copy'); setReplacePageSettings(false);
    updatePlan(replace ? structuredClone(entry.plan) : independentPlan(entry.plan));
  }
  function updateSection(index: number, patch: Partial<ConversionSection>) {
    if (plan) updatePlan({ ...plan, sections: plan.sections.map((section, i) => i === index ? { ...section, ...patch } : section) });
  }
  function updateItem(sectionIndex: number, columnIndex: number, itemIndex: number, patch: Partial<ConversionItem>) {
    if (!plan) return;
    const columns = structuredClone(plan.sections[sectionIndex].columns);
    columns[columnIndex].items[itemIndex] = { ...columns[columnIndex].items[itemIndex], ...patch };
    updateSection(sectionIndex, { columns });
  }
  async function prepare() {
    if (!base || !plan) return;
    setBusy(true); setError(''); setProposal(undefined);
    const reviewedDraft = draftRevision.current;
    try {
      const current = await getCurrentStudioProject(project);
      const revision = getStudioRevision(project.id);
      if (JSON.stringify(current) !== JSON.stringify(base)) throw new Error('Your project changed after this review opened. Close this review and open it again to use the latest work.');
      const { renderDecorationPNG } = await import('../design/export');
      const options = { acknowledgedWarnings: acknowledged, rasterizeDecoration: renderDecorationPNG, overwriteTargetChanges: record && conflict === 'replace' ? true : undefined, replacePageSettings };
      const result = record && conflict === 'replace' ? await updateConversion(base.design, base.website, record, plan, options) : await compileConversion(base.design, base.website, plan, options);
      const conversions = record && conflict === 'replace' ? base.conversions.map(entry => entry.id === record.id ? result.record : entry) : [...base.conversions, result.record];
      const candidate = createStudioProject(result.website, base.design, conversions);
      if (draftRevision.current !== reviewedDraft) throw new Error('The review choices changed while preparing. Prepare the comparison again to use your latest choices.');
      setProposal({ studio: candidate, revision, pageId: result.record.pageId });
      setApproved(false); setReviewedWidths([width]);
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!proposal || busy || !allAcknowledged || !analysis?.canCompile || !approved || reviewedWidths.length < 3) return;
    setBusy(true); setError('');
    try {
      await saveStudioProject(proposal.studio, { revision: proposal.revision });
      applied(proposal.studio, proposal.pageId, true);
    } catch (error) {
      const current = await getCurrentStudioProject(project).catch(() => undefined);
      if (current && JSON.stringify(current) === JSON.stringify(proposal.studio)) applied(proposal.studio, proposal.pageId, false, messageOf(error));
      else setError(messageOf(error));
    } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="conversion-studio" aria-labelledby="conversion-title" onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <header className="conversion-header"><div><p className="studio-eyebrow">APL / Design → Build</p><h1 id="conversion-title">Give your design a working life.</h1></div><button disabled={busy} aria-label="Close conversion" onClick={close}><X size={20}/></button></header>
    {!base ? <p role="status">{error || 'Opening your Design and Build work…'}</p> : !plan ? <div className="conversion-start"><h2>Choose what to build.</h2><p>Select an artboard for a new page, or compare a previous conversion.</p><div className="conversion-board-list">{base.design.artboards.map(board => <button key={board.id} onClick={() => updatePlan(board.id === 'business-desktop' ? businessConversionPlan(base.design, base.website) : suggestConversionPlan(base.design, board.id, base.website))}><Monitor size={24}/><strong>{board.name}</strong><span>{board.width} × {board.height}</span></button>)}</div>{!base.design.artboards.length && <p>Create an artboard in Design first.</p>}{base.conversions.length > 0 && <><h2>Your connected pages</h2>{base.conversions.map(entry => <button className="conversion-history" key={entry.id} disabled={states[entry.id] === 'detached'} onClick={() => { chooseRecord(entry); }}><strong>{entry.plan.page.name}</strong><span>{(states[entry.id] || 'Checking…').replaceAll('-', ' ')}</span></button>)}</>}</div> : <>
      <nav className="conversion-steps" aria-label="Conversion steps">{steps.map((name, index) => <button key={name} aria-current={step === index ? 'step' : undefined} disabled={busy} onClick={() => setStep(index)}><span>{index + 1}</span>{name}</button>)}</nav>
      <div className="conversion-body">
        <aside className="conversion-context"><span className="conversion-tag">Selected design</span><h2>{board?.name}</h2><p>{board?.width} × {board?.height}</p>{designUrl && <img src={designUrl} alt={`Original ${board?.name} artboard`}/>}<p>Your design stays editable. This review creates real website elements from the choices you confirm.</p><button disabled={busy} onClick={() => { setPlan(undefined); setRecord(undefined); setProposal(undefined); setAcknowledged([]); }}>Choose another design or conversion</button></aside>
        <main className="conversion-main">
          {step === 0 && <><p className="conversion-tag">01 / A home for your idea</p><h2>Make a page.</h2><p className="conversion-intro">Set its address and the details visitors see. Your existing website pages stay in the same project.</p><div className="conversion-fields"><label>Page name<input maxLength={60} value={plan.page.name} onChange={event => updatePlan({ ...plan, page: { ...plan.page, name: event.target.value } })}/></label><label>Page address<input value={plan.page.path} onChange={event => updatePlan({ ...plan, page: { ...plan.page, path: event.target.value } })}/></label><label className="conversion-wide">Search title<input maxLength={120} value={plan.page.title} onChange={event => updatePlan({ ...plan, page: { ...plan.page, title: event.target.value } })}/></label><label className="conversion-wide">Search description<textarea maxLength={320} value={plan.page.description} onChange={event => updatePlan({ ...plan, page: { ...plan.page, description: event.target.value } })}/></label></div>{(['inNavigation', 'showHeader', 'showFooter'] as const).map(key => <label key={key} className="conversion-check"><input type="checkbox" checked={plan.page[key]} onChange={event => updatePlan({ ...plan, page: { ...plan.page, [key]: event.target.checked } })}/>{key === 'inNavigation' ? 'Include in website navigation' : key === 'showHeader' ? 'Use the shared website header' : 'Use the shared website footer'}</label>)}</>}
          {step === 1 && <><p className="conversion-tag">02 / Shape the reading order</p><h2>A layout for every screen.</h2><p className="conversion-intro">Sections follow the order below. Columns read from left to right and stack in that order on mobile. Use the arrows and column controls to arrange content.</p>{plan.sections.map((section, si) => <article key={section.id} className="conversion-section"><div className="conversion-section-title"><label>Section name<input value={section.name} onChange={event => updateSection(si, { name: event.target.value })}/></label><Reorder index={si} count={plan.sections.length} label={section.name} change={offset => updatePlan({ ...plan, sections: move(plan.sections, si, offset) })}/></div><div className="conversion-layout-rules">{(['mobile', 'tablet', 'desktop'] as const).map(device => <label key={device}>{device}<select aria-label={`${section.name} ${device} layout`} value={section.layout[device] || 'inherit'} onChange={event => { const layout = { ...section.layout }; if (event.target.value === 'inherit') delete layout[device as 'tablet' | 'desktop']; else layout[device] = event.target.value as LayoutPreset; updateSection(si, { layout }); }}>{device !== 'mobile' && <option value="inherit">Inherit</option>}{presets.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>)}</div><details><summary>Spacing at each screen size</summary><Spacing label="Side padding" value={section.paddingX} change={paddingX => updateSection(si, { paddingX })}/><Spacing label="Top and bottom padding" value={section.paddingY} change={paddingY => updateSection(si, { paddingY })}/><Spacing label="Column spacing" value={section.gap} change={gap => updateSection(si, { gap })}/><Spacing label="Content spacing" value={section.contentGap} change={contentGap => updateSection(si, { contentGap })}/></details>{section.columns.map((column, ci) => <div key={column.id} className="conversion-column"><div className="conversion-column-title"><strong>Column {ci + 1}</strong><Reorder index={ci} count={section.columns.length} label={`column ${ci + 1} in ${section.name}`} change={offset => updateSection(si, { columns: move(section.columns, ci, offset) })}/></div>{column.items.map((item, ii) => {
            const layer = base.design.layers.find(layer => layer.id === item.layerId);
            return <div key={item.layerId} className="conversion-item"><div><strong>{layer?.name || 'Missing layer'}</strong><small>{layer?.type} {layer?.type === 'text' ? `· ${layer.text.slice(0, 70)}` : ''}</small></div><label>Website element<select aria-label={`Role for ${layer?.name}`} value={item.role} onChange={event => updateItem(si, ci, ii, { role: event.target.value as ConversionItem['role'] })}>{(['heading', 'paragraph', 'image', 'button', 'decoration', 'ignore'] as const).map(role => <option key={role} value={role}>{role === 'ignore' ? 'Leave out' : role === 'decoration' ? 'Decorative artwork' : role[0].toUpperCase() + role.slice(1)}</option>)}</select></label><Reorder index={ii} count={column.items.length} label={layer?.name || item.layerId} change={offset => { const columns = structuredClone(section.columns); columns[ci].items = move(column.items, ii, offset); updateSection(si, { columns }); }}/>{section.columns.length > 1 && <label>Move to column<select aria-label={`Column for ${layer?.name}`} value={ci} onChange={event => { const columns = structuredClone(section.columns); columns[ci].items.splice(ii, 1); columns[Number(event.target.value)].items.push(item); updateSection(si, { columns }); }}>{section.columns.map((column, index) => <option key={column.id} value={index}>Column {index + 1}</option>)}</select></label>}</div>;
          })}</div>)}{section.columns.length < 4 && <button onClick={() => updateSection(si, { columns: [...section.columns, { id: crypto.randomUUID(), items: [] }] })}>Add a column</button>}</article>)}</>}
          {step === 2 && <><p className="conversion-tag">03 / Make it useful</p><h2>Words, actions, and a real inbox.</h2><p className="conversion-intro">Confirm headings, image descriptions, and what each button does. A contact form includes a backend and an admin inbox in your downloaded website.</p>{plan.sections.flatMap((section, si) => section.columns.flatMap((column, ci) => column.items.filter(item => ['heading', 'paragraph', 'image', 'button'].includes(item.role)).map(item => {
            const ii = column.items.indexOf(item), layer = base.design.layers.find(layer => layer.id === item.layerId);
            return <article className="conversion-connection" key={item.layerId}><h3>{layer?.name}</h3><p>{layer?.text.slice(0, 100)}</p>{item.role === 'heading' && <label>Heading level<select aria-label={`Heading level for ${layer?.name}`} value={item.level || 'h2'} onChange={event => updateItem(si, ci, ii, { level: event.target.value as ConversionItem['level'] })}>{['h1', 'h2', 'h3', 'h4'].map(level => <option key={level} value={level}>{level.toUpperCase()}{level === 'h1' ? ' · Page title (one per page)' : ''}</option>)}</select></label>}{item.role === 'image' && <label>Image description<input aria-label={`Image description for ${layer?.name}`} value={item.alt || ''} onChange={event => updateItem(si, ci, ii, { alt: event.target.value })}/><small>Describe useful information. Leave empty only for decoration.</small></label>}{item.role === 'button' && <Destination value={item.destination} plan={plan} website={base.website} change={destination => updateItem(si, ci, ii, { destination })}/>}<AppearanceField label="Responsive appearance" value={item.appearance} onChange={appearance => updateItem(si, ci, ii, { appearance })}/></article>;
          })))}<article className="conversion-contact"><label className="conversion-check"><input type="checkbox" checked={Boolean(plan.contact)} onChange={event => updatePlan({ ...plan, contact: event.target.checked ? { sourceLayerIds: [], title: 'Let’s talk about your project.', description: 'Tell us a little about what you have in mind.', button: 'Send inquiry' } : null })}/>Add a working contact form</label>{plan.contact && <><p>Name, email, and message fields connect to your website’s own private submissions inbox.</p>{(['title', 'description', 'button'] as const).map(key => <label key={key}>Contact {key}<input value={plan.contact![key]} onChange={event => updatePlan({ ...plan, contact: { ...plan.contact!, [key]: event.target.value } })}/></label>)}<details><summary>Replace contact mockup layers</summary><p>Select the visual form layers to replace with the real form. Other mapped items using these layers must be set to Leave out.</p>{base.design.layers.filter(layer => layer.artboardId === plan.artboardId && layer.visible).map(layer => <label className="conversion-check" key={layer.id}><input type="checkbox" checked={plan.contact!.sourceLayerIds.includes(layer.id)} onChange={event => updatePlan({ ...plan, contact: { ...plan.contact!, sourceLayerIds: event.target.checked ? [...plan.contact!.sourceLayerIds, layer.id] : plan.contact!.sourceLayerIds.filter(id => id !== layer.id) } })}/>{layer.name}</label>)}</details><small>Preview simulates a submission. The exported website saves it after you configure your own services.</small></>}</article></>}
          {step === 3 && <><p className="conversion-tag">04 / Look closely, then build</p><h2>Approve what becomes a website.</h2><p className="conversion-intro">Review every warning, prepare the comparison, and check all three sizes before applying.</p>{record && <div className="conversion-conflict"><strong>Previous conversion: {(states[record.id] || '').replaceAll('-', ' ')}</strong><label>How to apply<select aria-label="Conversion update choice" value={conflict} onChange={event => { const choice = event.target.value as 'copy' | 'replace'; setConflict(choice); updatePlan(choice === 'copy' ? independentPlan(plan) : { ...plan, page: { ...plan.page, path: base.website.pages.find(page => page.id === record.pageId)?.path || plan.page.path } }); }}><option value="copy">Create a separate page</option><option value="replace">Replace only the previously converted sections</option></select></label><p>Replacing those sections overwrites edits inside them. Other sections and pages are preserved.</p>{conflict === 'replace' && <label className="conversion-check"><input type="checkbox" checked={replacePageSettings} onChange={event => { draftRevision.current += 1; setReplacePageSettings(event.target.checked); setProposal(undefined); setApproved(false); setReviewedWidths([]); }}/>Also apply the page address, search details, and header/footer choices from this review</label>}</div>}{analysis?.issues.length === 0 && <p className="conversion-clear"><CheckCircle/> No conversion warnings.</p>}{analysis?.issues.map(issue => <div key={issue.id} className={`conversion-issue ${issue.severity}`}>{issue.severity === 'warning' ? <label className="conversion-check"><input type="checkbox" checked={acknowledged.includes(issue.id)} onChange={event => { draftRevision.current += 1; setApproved(false); setReviewedWidths([]); setAcknowledged(values => event.target.checked ? [...values, issue.id] : values.filter(id => id !== issue.id)); setProposal(undefined); }}/><span>{issue.message}</span></label> : <p role="alert">{issue.message}</p>}</div>)}<button className="primary" disabled={busy || !analysis?.canCompile || !allAcknowledged} onClick={() => void prepare()}>{busy ? 'Preparing…' : 'Prepare comparison'}</button>{proposal && <div ref={comparisonView} className="conversion-comparison"><div className="conversion-comparison-toolbar"><strong>Original design / Website</strong><div role="group" aria-label="Comparison screen size">{[390, 768, 1280].map(size => <button key={size} aria-pressed={width === size} onClick={() => { setWidth(size); setReviewedWidths(values => [...new Set([...values, size])]); }}>{size === 390 ? <DeviceMobile/> : <Monitor/>}{size === 390 ? 'Mobile' : size === 768 ? 'Tablet' : 'Desktop'} · {size}</button>)}</div></div>{record && <details className="conversion-current-build"><summary>Compare with the current Build page before replacing it</summary><WebsiteFrame project={base.website} pageId={record.pageId} width={width} title="Current Build comparison"/></details>}<div className="conversion-comparison-grid"><div><h3>Original artboard · {board?.width}px</h3>{designUrl && <img src={designUrl} alt="Approved source design"/>}</div><div><h3>Responsive website · {width}px</h3><WebsiteFrame project={proposal.studio.website} pageId={proposal.pageId} width={width} title="Conversion website comparison"/></div></div><p>The original is a fixed artboard. The website follows your responsive rules. Test its links and sample form here. Visit all three sizes to enable approval.</p><label className="conversion-check"><input type="checkbox" aria-label="Approve responsive comparison" checked={approved} disabled={reviewedWidths.length < 3} onChange={event => setApproved(event.target.checked)}/><span>I reviewed the layout and actions at mobile, tablet, and desktop sizes.</span></label></div>}</>}
          {error && <p className="conversion-error" role="alert">{error}</p>}
        </main>
      </div>
      <footer className="conversion-footer"><span>{busy ? <><SpinnerGap className="conversion-spin"/>Working…</> : 'Your Design and Build work stay in one editable backup.'}</span><div><button disabled={busy} onClick={() => step ? setStep(step - 1) : close()}>{step ? 'Back' : 'Cancel'}</button>{step < 3 ? <button className="primary" onClick={() => setStep(step + 1)}>Next: {steps[step + 1]}</button> : <button className="primary" disabled={busy || !proposal || !approved || reviewedWidths.length < 3} onClick={() => { if (!approved) { setError('Review all three sizes and approve the comparison before applying.'); return; } void apply(); }}>Apply to Build</button>}</div></footer>
    </>}
  </dialog>;
}
