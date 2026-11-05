import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import Dialog from './editor/Dialog';
import WorkspaceBoundary from './editor/WorkspaceBoundary';
import type { EditorData, fromEditor } from './editor/config';
import { hasContact, hasServices, hasPortfolio, hasArticles, projectSchema, type Project } from './project/schema';
import { MAX_STUDIO_BACKUP_BYTES, readStudioProject } from './project/studio-document';
import { emptyDesign } from './design/schema';
import { newProject } from './project/templates';
import { headerHref } from './project/pages';
import { listProjects, saveProject, attachDesign, attachStudioProject, getCurrentStudioProject, hasPendingSaves, validateWebsiteForProject } from './project/storage';
import type { StudioProject } from './project/studio-document';
import { protectProjects, readProtection, readMigrationProtection, readConversionProtection } from './project/protection';
import { downloadBackup, downloadWorkspace } from './export/download';
import Welcome from './studio/Welcome';
import Dashboard, { moduleLabel } from './studio/Dashboard';
import NewProject from './studio/NewProject';

const EditorSurface = lazy(() => import('./editor/EditorSurface'));
const DesignCanvas = lazy(() => import('./design/DesignCanvas'));
const ConversionStudio = lazy(() => import('./conversion/ConversionStudio'));
const Preview = lazy(() => import('./editor/Preview'));
const PageManager = lazy(() => import('./editor/PageManager'));
const SharedSettings = lazy(() => import('./editor/SharedSettings'));
const ThemeManager = lazy(() => import('./editor/ThemeManager'));
const ServicesManager = lazy(() => import('./editor/ServicesManager'));
const PortfolioManager = lazy(() => import('./editor/PortfolioManager'));
const ArticlesManager = lazy(() => import('./editor/ArticlesManager'));
const ReusableManager = lazy(() => import('./editor/ReusableManager'));
const CodeCopyDialog = lazy(() => import('./editor/CodeCopyDialog'));
type Screen = 'welcome' | 'projects' | 'new' | 'build' | 'design';
type Panel = 'pages' | 'shared' | 'theme' | 'services' | 'portfolio' | 'articles' | 'components' | null;
const loadingView = <div className="studio-loading" role="status">Opening your workspace…</div>;

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const projectsRef = useRef<Project[]>([]);
  const [current, setCurrent] = useState<Project | null>(null);
  const [screen, setScreen] = useState<Screen>('welcome');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [migrateRecoverAvailable, setMigrateRecoverAvailable] = useState(false);
  const [conversionRecoveryAvailable, setConversionRecoveryAvailable] = useState(false);
  const [preview, setPreview] = useState<Project | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [codeNodeId, setCodeNodeId] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  const [notice, setNotice] = useState('');
  const [status, setStatus] = useState('Saved on this device');
  const [invalid, setInvalid] = useState(false);
  const [failedProjects, setFailedProjects] = useState<Project[]>([]);
  const saveError = failedProjects.length > 0;
  const [rename, setRename] = useState<Project | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [pageId, setPageId] = useState('home');
  const [editorRevision, setEditorRevision] = useState(0);
  const [conversion, setConversion] = useState<{ artboardId?: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const activePage = current?.pages.find(p => p.id === pageId) || current?.pages.find(p => p.path === '/');

  useEffect(() => {
    let active = true;
    listProjects().then(items => {
      if (!active) return;
      projectsRef.current = items; setProjects(items);
      void protectProjects(items).then(() => readProtection()).then(saved => { if (active) setRecoveryAvailable(saved.length > 0); }).catch(error => { if (active) setNotice(error.message); });
      const hash = window.location.hash;
      const mode = hash.startsWith('#/design/') ? 'design' : 'build';
      const selected = hash.startsWith('#/build/') || hash.startsWith('#/design/') ? items.find(p => p.id === hash.slice(mode === 'design' ? 9 : 8)) : undefined;
      if (selected) { setCurrent(selected); setScreen(mode); }
      else setScreen(hash === '#/new' ? 'new' : hash === '#/welcome' || !items.length ? 'welcome' : 'projects');
    }).catch(error => { if (active) setLoadError(error instanceof Error ? error.message : 'Could not open local projects.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const navigate = () => {
      if (loading) return;
      if (!window.location.hash.startsWith('#/')) return;
      if (invalid) { window.history.replaceState(null, '', '#/build/' + current!.id); setNotice('Fix the current settings before leaving this page.'); return; }
      const hash = window.location.hash;
      if (hash.startsWith('#/build/') || hash.startsWith('#/design/')) {
        const mode = hash.startsWith('#/design/') ? 'design' : 'build';
        const p = projectsRef.current.find(p => p.id === hash.slice(mode === 'design' ? 9 : 8));
        if (p) { setCurrent(p); setPageId('home'); setScreen(mode); }
        else { setScreen('projects'); setNotice('That project is not available in this browser. Choose a saved project or import its backup.'); }
      } else setScreen(hash === '#/projects' ? 'projects' : hash === '#/new' ? 'new' : 'welcome');
      setPanel(null); setPreview(null); setCodeNodeId(null);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [projects, loading, invalid, current]);
  useEffect(() => { document.title = (screen === 'build' || screen === 'design') && current ? current.name + ' · APL Studio' : screen === 'projects' ? 'Your projects · APL Studio' : 'APL Studio · Make it yours'; }, [screen, current]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (hasPendingSaves() || failedProjects.length) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [failedProjects]);
  useEffect(() => {
    if (screen !== 'projects') return;
    let active = true;
    void readMigrationProtection().then(items => { if (active) setMigrateRecoverAvailable(items.length > 0); }).catch(() => {});
    void readConversionProtection().then(items => { if (active) setConversionRecoveryAvailable(items.length > 0); }).catch(() => {});
    return () => { active = false; };
  }, [screen, projects.length]);

  function go(next: Screen, project?: Project) {
    if (invalid) return;
    setPanel(null); setCodeNodeId(null); setNotice(''); setScreen(next);
    if (project) { setCurrent(project); setPageId('home'); }
    window.location.hash = next === 'build' || next === 'design' ? '/' + next + '/' + (project || current)!.id : '/' + next;
    window.scrollTo({ top: 0 });
  }
  async function persist(project: Project) {
    let p: Project;
    try { p = validateWebsiteForProject(project); }
    catch (error) {
      const message = error instanceof Error ? error.message : 'This change exceeds the supported project limits.';
      setStatus(message); setNotice(message + ' Your previous project is preserved.');
      setEditorRevision(value => value + 1);
      return;
    }
    const r = ++revision.current;
    if (current?.id === p.id) setCurrent(p);
    projectsRef.current = [p, ...projectsRef.current.filter(item => item.id !== p.id)];
    setProjects(projectsRef.current);
    setStatus('Saving on this device…');
    setFailedProjects(prev => prev.map(item => item.id === p.id ? p : item));
    // Stage immediately; storage serializes writes from both Design and Build.
    const queued = saveProject(p);
    try { await queued; setFailedProjects(prev => prev.filter(item => item.id !== p.id)); if (r === revision.current) setStatus('Saved on this device'); }
    catch(error) { setFailedProjects(prev => [projectsRef.current.find(item => item.id === p.id) || p, ...prev.filter(item => item.id !== p.id)]); if (r === revision.current) setStatus(error instanceof Error ? error.message : 'Save failed. Download a backup before closing.'); }
  }
  function create(p: Project, mode: Screen = 'build') { setInvalid(false); setCurrent(p); void persist(p); go(mode, p); }
  function createStudio(studio: StudioProject, mode: 'design' | 'build') {
    attachStudioProject(studio);
    create(studio.website, mode);
  }
  function createDesign() { const p = { ...newProject(), name: 'Untitled design' }; attachDesign(p.id, emptyDesign()); create(p, 'design'); }
  function backup(p: Project) { void downloadBackup(p).catch(error => setNotice(error instanceof Error ? error.message : 'Could not prepare this backup. Your project is preserved.')); }
  function designSaved(p: Project) {
    projectsRef.current = projectsRef.current.map(item => item.id === p.id ? { ...item, updatedAt: p.updatedAt > item.updatedAt ? p.updatedAt : item.updatedAt } : item);
    setProjects(projectsRef.current);
    setCurrent(item => item?.id === p.id ? projectsRef.current.find(project => project.id === p.id) || item : item);
    setFailedProjects(items => items.filter(item => item.id !== p.id));
  }
  function designFailed(p: Project, message: string) { setFailedProjects(items => [projectsRef.current.find(item => item.id === p.id) || p, ...items.filter(item => item.id !== p.id)]); setStatus(message); }

  function updateStructure(p: Project, selected?: string) { if (selected) setPageId(selected); setEditorRevision(value => value + 1); setInvalid(false); void persist(p); }
  function changed(data: EditorData, convert: typeof fromEditor) {
    if (!current) return;
    try { const p = convert(data, current, activePage!.id); setInvalid(false); void persist(p); }
    catch(error) { setInvalid(true); setStatus('Fix the current settings before saving or exporting. ' + (error instanceof Error && 'issues' in error && Array.isArray(error.issues) ? String(error.issues[0]?.message || '') : '')); }
  }
  function duplicate(p: Project) { void getCurrentStudioProject(p).then(studio => { const copy = { ...structuredClone(studio.website), id: crypto.randomUUID(), name: p.name.slice(0, 71) + ' (copy)', updatedAt: new Date().toISOString() }; attachStudioProject({ ...studio, id: copy.id, name: copy.name, updatedAt: copy.updatedAt, website: copy }); void persist(copy); setNotice('Created an independent copy of ' + p.name + ', including Design, Build, and conversion history.'); }).catch(error => setNotice(error.message)); }
  function conversionApplied(studio: StudioProject, selectedPageId: string, saved: boolean, message?: string) {
    const p = studio.website;
    projectsRef.current = [p, ...projectsRef.current.filter(item => item.id !== p.id)];
    setProjects(projectsRef.current); setCurrent(p); setPageId(selectedPageId); setEditorRevision(value => value + 1);
    setConversion(null); setScreen('build'); window.history.replaceState(null, '', '#/build/' + p.id);
    setFailedProjects(items => saved ? items.filter(item => item.id !== p.id) : [p, ...items.filter(item => item.id !== p.id)]);
    setStatus(saved ? 'Conversion saved on this device' : message || 'Download a recovery backup before closing.');
    setNotice(saved ? 'Your converted page is ready to edit in Build. Preview its links and form, then download your website source.' : 'The conversion is available in this session, but local saving failed. Download a recovery backup before closing.');
  }
  if (loading) return <main className="studio-loading"><p className="studio-eyebrow">APL / Your local studio</p><h1>Making room<br/>for your ideas.</h1><p role="status">Opening your saved projects…</p></main>;
  if (preview) return <Suspense fallback={loadingView}><Preview project={preview} initialPageId={preview.id === current?.id ? activePage!.id : preview.pages.find(p => p.path === '/')!.id} close={() => setPreview(null)} closeLabel={screen === 'build' ? 'Back to editor' : 'Back to studio'}/></Suspense>;

  return <>
    <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); const main = document.getElementById('main'); if (main) { main.tabIndex = -1; main.focus(); main.scrollIntoView(); } }}>Skip to content</a>
    <header className={'studio-bar studio-header' + (screen === 'build' ? ' build-header' : screen === 'design' ? ' build-header design-header' : '')}>
      <button className="studio-brand" aria-label="APL Studio home" disabled={invalid} onClick={() => go('welcome')}><span className="apl-wordmark">apl<span className="brand-period">.</span></span><span className="brand-studio">STUDIO</span></button>
      {(screen === 'build' || screen === 'design') && current ? <><div className="build-project"><label>Project<select aria-label="Choose project" value={current.id} disabled={invalid} onChange={e => go(screen === 'design' ? 'design' : 'build', projects.find(p => p.id === e.target.value)!)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><nav className="editor-modes" aria-label="Studio modes"><button disabled={invalid} aria-current={screen === 'design' ? 'page' : undefined} onClick={() => go('design')}>Design</button><button disabled={invalid} aria-current={screen === 'build' ? 'page' : undefined} onClick={() => go('build')}>Build</button></nav><div className="studio-actions"><button disabled={invalid} onClick={() => go('projects')}>Projects</button><button disabled={invalid} onClick={() => go('new')}>New project</button><button disabled={invalid} onClick={() => backup(current)}>Back up</button><button disabled={invalid} onClick={() => setPreview(current)}>Preview ↗</button><button className="primary" disabled={invalid} onClick={() => { setExportError(''); setExportOpen(true); }}>Download code ↓</button></div></> : <><nav className="studio-navigation" aria-label="Studio navigation"><button aria-current={screen === 'welcome' ? 'page' : undefined} onClick={() => go('welcome')}>The studio</button><button aria-current={screen === 'projects' ? 'page' : undefined} onClick={() => go('projects')}>Your projects <small>{projects.length}</small></button><button onClick={() => setGuide(true)}>Quick guide</button></nav><div className="studio-actions"><button onClick={() => input.current?.click()}>Import backup</button><button className="primary" onClick={() => go('new')}>New project ↗</button></div></>}
    </header>
    <input ref={input} aria-label="Import APL backup" type="file" accept=".json,.apl.json" hidden onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
      try { if (file.size > MAX_STUDIO_BACKUP_BYTES) throw new Error('Backup exceeds 30 MB.'); const studio = readStudioProject(JSON.parse(await file.text())); const p = { ...studio.website, id: crypto.randomUUID(), name: studio.name.slice(0, 65) + ' (imported)', updatedAt: new Date().toISOString() }; attachStudioProject({ ...studio, id: p.id, name: p.name, updatedAt: p.updatedAt, website: p }); create(p, studio.design.artboards.length ? 'design' : 'build'); }
      catch(error) { setNotice('Could not import this backup. ' + (error instanceof Error && file.size > MAX_STUDIO_BACKUP_BYTES ? error.message + ' ' : '') + 'Existing projects were not changed.'); }
    }}/>
    {loadError && <div className="studio-notice error" role="alert"><strong>Local projects could not be opened.</strong><p>{loadError} Originals are preserved. You can import a downloaded backup as a new project.</p><button onClick={() => window.location.reload()}>Retry opening projects</button></div>}
    {notice && <div className="studio-notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notice">Dismiss</button></div>}
    {(screen === 'build' || saveError) && <div className={'status-strip' + (invalid || saveError ? ' error' : '')}><span role={saveError || invalid ? 'alert' : 'status'}>{saveError && !invalid ? 'Some project changes could not be saved. Download a recovery backup before closing.' : status}</span>{saveError ? <button onClick={() => { void downloadWorkspace(failedProjects).catch(() => setNotice('Could not prepare recovery backups. Open each unsaved project and use Back up.')); }}>Download recovery backup</button> : current && <span>Local workspace · {moduleLabel(current)} · APL backup available</span>}</div>}
    {screen === 'welcome' && <Welcome start={() => go('new')} projects={() => go('projects')} preview={setPreview} guide={() => setGuide(true)} create={create}/>}
    {screen === 'projects' && !loadError && <Dashboard projects={projects} open={p => go('build', p)} start={() => go('new')} rename={p => { setRename(p); setRenameValue(p.name); setRenameError(''); }} duplicate={duplicate} backup={backup} backupAll={() => { void downloadWorkspace(projects).catch(() => setNotice('Could not prepare the workspace ZIP. Back up each project separately.')); }} migrateRecoverAvailable={migrateRecoverAvailable} recoverOriginals={() => { void readMigrationProtection().then(items => { if (!items.length) { setNotice('No original website snapshots are available yet.'); return; } return downloadWorkspace(items); }).catch(error => setNotice(error.message)); }} conversionRecoveryAvailable={conversionRecoveryAvailable} recoverConversionOriginals={() => { void readConversionProtection().then(downloadWorkspace).catch(error => setNotice(error.message)); }} openDesign={p => go('design', p)} recoveryAvailable={recoveryAvailable} recover={() => { void readProtection().then(downloadWorkspace).catch(error => setNotice(error.message)); }} importBackup={() => input.current?.click()}/>}
    {screen === 'new' && <NewProject create={create} createStudio={createStudio} createDesign={createDesign} close={() => go('projects')} preview={setPreview}/>}
    {screen === 'design' && current && <WorkspaceBoundary key={current.id} backup={() => backup(current)}><Suspense fallback={loadingView}><DesignCanvas key={current.id} project={current} saved={designSaved} failed={designFailed} convert={artboardId => setConversion({ artboardId })}/></Suspense></WorkspaceBoundary>}
    {screen === 'build' && current && <main id="main" className="build-workspace"><div className="page-toolbar"><label>Editing page<select aria-label="Editing page" value={activePage!.id} disabled={invalid} onChange={e => setPageId(e.target.value)}>{current.pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><code>{activePage!.path}</code><button disabled={invalid} onClick={() => setPanel('pages')}>Pages ({current.pages.length})</button><button disabled={invalid} onClick={() => setPanel('shared')}>Site header & footer</button><button disabled={invalid} onClick={() => setPanel('theme')}>Site theme</button><details className="content-menu"><summary>Content collections</summary><div><button disabled={invalid} onClick={() => setPanel('services')}>Services content</button><button disabled={invalid} onClick={() => setPanel('portfolio')}>Portfolio content</button><button disabled={invalid} onClick={() => setPanel('articles')}>Articles content</button></div></details><button disabled={invalid} onClick={() => setConversion({})}>Compare conversions</button><button className="toolbar-guide" onClick={() => setGuide(true)}>Guide</button></div>
      {current.shared.header.enabled && current.shared.header.props.linkLabel && !headerHref(current) && <div role="alert" className="link-warning">The header action points to a missing section. Choose a new destination in Site header & footer before exporting.</div>}
      <div className="editor-wrap"><Suspense fallback={loadingView}><EditorSurface key={current.id + ':' + activePage!.id + ':' + editorRevision} project={current} pageId={activePage!.id} onChange={changed} openComponents={() => setPanel('components')} copyCode={nodeId => setCodeNodeId(nodeId || '')}/></Suspense></div>
    </main>}
    {screen !== 'build' && screen !== 'design' && <footer className="studio-footer"><span>apl. / A place to make it your own.</span><p>Local-first · Independent exports · Your code to keep</p><button onClick={() => setGuide(true)}>How it works ↗</button></footer>}
    <Suspense fallback={loadingView}>
      {panel === 'pages' && current && <PageManager project={current} activeId={activePage!.id} change={updateStructure} select={setPageId} close={() => setPanel(null)}/>}
      {panel === 'shared' && current && <SharedSettings project={current} save={updateStructure} close={() => setPanel(null)}/>}
      {panel === 'theme' && current && <ThemeManager project={current} save={updateStructure} close={() => setPanel(null)}/>}
      {panel === 'services' && current && <ServicesManager project={current} pageId={activePage!.id} save={updateStructure} close={() => setPanel(null)}/>}
      {panel === 'portfolio' && current && <PortfolioManager project={current} pageId={activePage!.id} save={updateStructure} close={() => setPanel(null)}/>}
      {panel === 'articles' && current && <ArticlesManager project={current} pageId={activePage!.id} save={updateStructure} close={() => setPanel(null)}/>}
      {panel === 'components' && current && <ReusableManager project={current} pageId={activePage!.id} close={() => setPanel(null)} applied={(studio, saved, message) => { const p = studio.website; projectsRef.current = [p, ...projectsRef.current.filter(item => item.id !== p.id)]; setProjects(projectsRef.current); setCurrent(p); setEditorRevision(value => value + 1); setFailedProjects(items => saved ? items.filter(item => item.id !== p.id) : [p, ...items.filter(item => item.id !== p.id)]); setStatus(saved ? 'Reusable components saved on this device' : message || 'Download a recovery backup before closing.'); }}/>} 
    </Suspense>
    {codeNodeId !== null && current && <Suspense fallback={loadingView}><CodeCopyDialog project={current} pageId={activePage!.id} nodeId={codeNodeId || undefined} close={() => setCodeNodeId(null)}/></Suspense>}
    {conversion && current && <Suspense fallback={loadingView}><ConversionStudio project={current} artboardId={conversion.artboardId} close={() => setConversion(null)} applied={conversionApplied}/></Suspense>}
    {rename && <Dialog title="Name your project" close={() => setRename(null)}><form onSubmit={e => { e.preventDefault(); const name = renameValue.trim(); if (!name || name.length > 80) { setRenameError('Use a project name between 1 and 80 characters.'); return; } void persist({ ...rename, name, updatedAt: new Date().toISOString() }); setRename(null); }}><label>Project name<input autoFocus value={renameValue} maxLength={80} onChange={e => setRenameValue(e.target.value)}/></label>{renameError && <p role="alert">{renameError}</p>}<footer><button type="button" onClick={() => setRename(null)}>Cancel</button><button className="primary" type="submit">Save name</button></footer></form></Dialog>}
    {guide && <Dialog title="Your first website, step by step" close={() => setGuide(false)} wide><ol className="quick-guide"><li><strong>Start with a project.</strong><p>Pick a complete example or a simple starter. Projects save automatically in this browser. Use Your projects to return, rename, or make an independent copy.</p></li><li><strong>Make it yours in Build.</strong><p>Select a section to edit its content and design. Use Blocks or Add layout to arrange content, Pages for navigation, and Site theme for a consistent look. Undo and Redo cover your current page-editing session.</p></li><li><strong>Try every screen.</strong><p>Preview at mobile, tablet, and desktop widths. Test navigation and the sample contact form. Preview never sends an inquiry or writes to an exported backend.</p></li><li><strong>Keep an editable backup.</strong><p>Back up downloads an APL JSON project. Import backup opens a separate copy. Save one before clearing browser data or changing computers. Design mode downloads artboard PNGs and a visual PDF.</p></li><li><strong>Download your website.</strong><p>Download code packages readable Next.js source, your images, selected backend modules, and setup guides. Read SETUP.md, configure your own services, run the verifier, and deploy on your own account. Use Convert to website in Design to review responsive sections, real links, and a contact form before adding a page to Build.</p></li></ol><p className="guide-note">The export owns its services and source. APL does not host your finished website. Design mode has freeform artboards and layers. Convert to website guides you through the layout, connections, warnings, and a visual comparison. Compare conversions lets you review later Design changes before updating Build.</p><footer><button className="primary" onClick={() => setGuide(false)}>Got it</button></footer></Dialog>}
    {exportOpen && current && <dialog ref={el => { if (el && !el.open) el.showModal(); }} className="dialog" aria-labelledby="export-title" onCancel={e => { if (busy) e.preventDefault(); else setExportOpen(false); }}>
      <span className="export-label">Generated · verification required</span><h2 id="export-title">Your website. Your source.</h2><p>Download a readable Next.js project and deploy it on your own account.</p>
      <ul><li>{current.pages.length} pages, shared layout, selected sections and required dependencies</li>{hasContact(current) && <li>Contact form, backend, secure administrator login, and submissions inbox</li>}{hasServices(current) && <li>Services CMS, private drafts, public pages, migrations, admin and initial importer</li>}{hasPortfolio(current) && <li>Portfolio CMS, linked project cards, private drafts, administrator editing and initial importer</li>}{hasArticles(current) && <li>Articles CMS, private drafts, public article pages, administrator editing and initial importer</li>}{!hasContact(current) && !hasServices(current) && !hasPortfolio(current) && !hasArticles(current) && <li>Frontend source; no backend or administrator module selected</li>}<li>Images, project backup, dependency lockfile, and setup guides</li><li>Isolated verification runner requiring Docker</li></ul>
      <p>The editor uses sample behavior. Downloading is not proof that the backend has passed testing. Follow SETUP.md and run the verifier before deployment.</p>{exportError && <p role="alert" className="export-error">{exportError}</p>}<footer><button disabled={busy} onClick={() => setExportOpen(false)}>Cancel</button><button className="primary" disabled={busy} onClick={async () => { setBusy(true); setExportError(''); try { const { downloadProject } = await import('./export/browser'); await downloadProject(current); setStatus('ZIP generated. Run its verifier before deployment.'); setExportOpen(false); } catch(e) { setExportError(e instanceof Error ? e.message : 'Export failed.'); } finally { setBusy(false); } }}>{busy ? 'Preparing source…' : 'Download ZIP'}</button></footer>
    </dialog>}
  </>;
}
