import { useState } from 'react';
import Dialog from './Dialog';
import { MAX_PAGES, filename, type Project } from '../project/schema';
import { addPage, editPage, movePage, removePage } from '../project/pages';

export default function PageManager({ project, activeId, change, select, close }: {
  project: Project; activeId: string; change: (project: Project, selected?: string) => void; select: (id: string) => void; close: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState(''); const [path, setPath] = useState('');
  const [inNavigation, setInNavigation] = useState(true); const [pathEdited, setPathEdited] = useState(false);
  const [showHeader, setShowHeader] = useState(true), [showFooter, setShowFooter] = useState(true);
  const [error, setError] = useState(''); const [deleting, setDeleting] = useState<string | null>(null);
  function open(id: string) {
    const page = project.pages.find(page => page.id === id);
    setEditing(id); setName(page?.name || ''); setPath(page?.path || ''); setInNavigation(page?.inNavigation ?? true);
    setShowHeader(page?.showHeader !== false); setShowFooter(page?.showFooter !== false);
    setPathEdited(Boolean(page)); setError(''); setDeleting(null);
  }
  function fail(error: unknown) {
    setError(error instanceof Error ? ('issues' in error ? String((error as { issues: { message: string }[] }).issues[0].message) : error.message) : 'Could not update this page.');
  }
  return <Dialog title="Pages" close={close} wide>
    <p>Each page has its own content and search settings. Page order controls the shared navigation.</p>
    <div className="page-manager-grid"><div>
      <ol className="page-list">{project.pages.map((page, index) => <li key={page.id}>
        <button className="page-open" onClick={() => { select(page.id); close(); }} aria-label={'Open ' + page.name + ' page'} aria-current={page.id === activeId ? 'page' : undefined}><strong>{page.name}</strong><small>{page.path}{!page.inNavigation ? ' · hidden from menu' : ''}</small></button>
        <div className="page-row-actions"><button onClick={() => open(page.id)} aria-label={'Edit ' + page.name + ' page'}>Edit</button>
          <button disabled={index === 0} onClick={() => change(movePage(project, page.id, -1))} aria-label={'Move ' + page.name + ' up'}>↑</button>
          <button disabled={index === project.pages.length - 1} onClick={() => change(movePage(project, page.id, 1))} aria-label={'Move ' + page.name + ' down'}>↓</button>
        </div>
      </li>)}</ol>
      <button onClick={() => open('new')} disabled={project.pages.length >= MAX_PAGES}>Add page</button>
      <p className="small-note">{project.pages.length} of {MAX_PAGES} pages. Hidden pages still have a public URL.</p>
    </div><div className="page-form-panel">
      {!editing ? <p>Select Edit to change a page’s name, URL or menu visibility, or add a new page.</p> : <form onSubmit={event => {
        event.preventDefault(); setError('');
        try {
          const base = editing === 'new' ? addPage(project, name, path) : project;
          const selected = editing === 'new' ? base.pages[base.pages.length - 1].id : editing;
          const previous = base.pages.find(page => page.id === selected)!;
          const next = editPage(base, selected, { name, path, inNavigation,
            ...(previous.showHeader !== undefined || !showHeader ? { showHeader } : {}),
            ...(previous.showFooter !== undefined || !showFooter ? { showFooter } : {}),
          });
          change(next, selected); close();
        } catch (error) { fail(error); }
      }}>
        <h3>{editing === 'new' ? 'New page' : 'Page settings'}</h3>
        <label>Page name<input autoFocus required maxLength={60} value={name} onChange={event => { setName(event.target.value); if (!pathEdited) setPath('/' + filename(event.target.value)); }}/></label>
        <label>Page URL<input required value={path} disabled={project.pages.find(page => page.id === editing)?.path === '/'} placeholder="/about" onChange={event => { setPath(event.target.value); setPathEdited(true); }}/></label>
        <p className="small-note">Use lowercase words and hyphens, such as /about. The homepage stays at /. Changing a deployed URL requires a new export; automatic redirects are not included yet.</p>
        <label className="checkbox-label"><input type="checkbox" checked={inNavigation} onChange={event => setInNavigation(event.target.checked)}/>Show in navigation</label>
        <label className="checkbox-label"><input type="checkbox" checked={showHeader} onChange={event => setShowHeader(event.target.checked)}/>Show site header on this page</label>
        <label className="checkbox-label"><input type="checkbox" checked={showFooter} onChange={event => setShowFooter(event.target.checked)}/>Show site footer on this page</label>
        <p className="small-note">Choose whether this page uses your shared site header and footer.</p>
        <p role="alert">{error}</p>
        <button className="primary" type="submit">{editing === 'new' ? 'Create page' : 'Save page'}</button>
        {editing !== 'new' && project.pages.find(page => page.id === editing)?.path !== '/' && <button className="danger-button" type="button" onClick={() => setDeleting(editing)}>Delete page</button>}
      </form>}
      {deleting && <div className="delete-confirmation" role="group" aria-label="Confirm page deletion"><p>Delete this page and its content? Its menu link will be removed. A header action pointing here will return to the homepage. Download a backup first if you need to keep it.</p>
        <button className="danger-button" onClick={() => { try { const next = removePage(project, deleting); change(next, deleting === activeId ? next.pages.find(page => page.path === '/')!.id : activeId); close(); } catch (error) { fail(error); } }}>Confirm delete</button>
        <button onClick={() => setDeleting(null)}>Keep page</button>
      </div>}
    </div></div>
  </Dialog>;
}
