import { useState } from 'react';
import Dialog from './Dialog';
import { ImageField } from './config';
import { hasPortfolio, type Project } from '../project/schema';
import { addPortfolioCollection, createPortfolioItem, mutatePortfolioItem, portfolioCollectionDefaults } from '../project/portfolio';
import type { PortfolioPayload } from '../project/portfolio-schema';
import { themeStyle } from '../project/theme';
import { targetHref } from '../project/pages';
import PortfolioCollection from '../site/PortfolioCollection';
import siteCss from '../site/site.css?inline';

export default function PortfolioManager({ project, pageId, save, close }: { project: Project; pageId: string; save: (value: Project) => void; close: () => void }) {
  const [selected, setSelected] = useState(project.content.portfolio[0]?.id || '');
  const entry = project.content.portfolio.find(item => item.id === selected);
  const [draft, setDraft] = useState<PortfolioPayload | null>(entry?.draft || null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const dirty = Boolean(entry && draft && JSON.stringify(entry.draft) !== JSON.stringify(draft));
  function leave() { return !dirty || window.confirm('Discard unsaved portfolio edits? Your last saved draft will be kept.'); }
  function run(action: () => void) { try { action(); setError(''); } catch (e) {
    setError(e instanceof Error ? 'issues' in e ? 'Check the title, destination and field lengths. Publishing requires a title and a valid page or website link.' : e.message : 'Could not save portfolio project.');
  } }
  function field(key: keyof PortfolioPayload, value: string) { setDraft(current => current ? { ...current, [key]: value } : null); }
  const collection = project.pages.flatMap(page => page.nodes).find(node => node.type === 'PortfolioCollection');
  return <Dialog title="Portfolio content" wide close={() => { if (leave()) close(); }}>
    <p>Each card opens a case-study page on this site or an external project website. Save privately, then publish the version visitors should see. After deployment, manage content in your exported website's admin.</p>
    {!hasPortfolio(project) && <p className="cms-notice">Add a collection to include portfolio cards and their independent backend in your export. <button onClick={() => run(() => save(addPortfolioCollection(project, pageId)))}>Add portfolio collection to this page</button></p>}
    <div className="cms-workspace"><aside className="cms-records">
      <button className="primary" disabled={project.content.portfolio.length >= 50} onClick={() => run(() => {
        if (!leave()) return; const next = createPortfolioItem(project); save(next.project); setSelected(next.id); setDraft(next.project.content.portfolio.at(-1)!.draft); setPreview(false);
      })}>New portfolio project</button>
      <p>{project.content.portfolio.length} / 50 local records</p>
      {project.content.portfolio.map(item => <button key={item.id} aria-pressed={selected === item.id} onClick={() => {
        if (!leave()) return; setSelected(item.id); setDraft(item.draft); setPreview(false); setError('');
      }}><strong>{item.draft.title || 'Untitled project'}</strong><small>{!item.published ? 'Draft' : JSON.stringify(item.draft) === JSON.stringify(item.published) ? 'Published for export' : 'Unpublished changes'}</small></button>)}
    </aside><div>
      {!entry || !draft ? <div className="cms-empty"><h3>Put your work on display.</h3><p>Add a project image, describe the work, and choose its case-study page or finished website.</p></div> : <>
        <div className="cms-state"><span>{entry.published ? 'Published snapshot available' : 'Private draft'}{dirty ? ' · Unsaved edits' : ''}</span>
          <button onClick={() => setPreview(value => !value)}>{preview ? 'Edit fields' : 'Preview draft'}</button></div>
        {preview ? <div className="cms-draft-preview"><p>Draft preview only · this version is not public.</p><style>{siteCss}</style>
          <div className="site" data-font={project.theme.font} style={themeStyle(project.theme)}>
            <PortfolioCollection {...(collection?.props || portfolioCollectionDefaults)} mobile={1} tablet={1} desktop={1} items={[{ id: entry.id, ...draft, href: draft.target ? targetHref(project, draft.target) ?? undefined : draft.externalUrl }]}/>
          </div>
        </div> : <div className="cms-fields">
          <label>Project title<input aria-label="Project title" value={draft.title} maxLength={120} onChange={e => field('title', e.target.value)}/></label>
          <label>Card destination<select aria-label="Card destination" value={draft.target ? 'page' : 'external'} onChange={e => setDraft(current => current ? e.target.value === 'page'
            ? { ...current, target: { pageId: project.pages.find(page => page.path !== '/')?.id ?? project.pages[0].id, anchor: '#top' }, externalUrl: '' }
            : { title: current.title, summary: current.summary, category: current.category, externalUrl: current.externalUrl, image: current.image, imageAlt: current.imageAlt } : null)}>
            <option value="page">Case-study page on this site</option><option value="external">External project website</option>
          </select></label>
          {draft.target ? <label>Case-study page<select aria-label="Case-study page" value={draft.target.pageId} onChange={e => setDraft(current => current ? { ...current, target: { pageId: e.target.value, anchor: '#top' } } : null)}>
            {project.pages.map(page => <option key={page.id} value={page.id}>{page.name} ({page.path})</option>)}
          </select><small>Opens in the same tab. The selected page is included in the export.</small></label> :
          <label>Website link<input aria-label="Website link" type="url" value={draft.externalUrl} maxLength={2048} placeholder="https://your-project.com" onChange={e => field('externalUrl', e.target.value)}/><small>Opens the actual project website in a new tab. A complete http:// or https:// address is required to publish.</small></label>}
          <label>Category<input aria-label="Category" value={draft.category} maxLength={80} placeholder="Web design" onChange={e => field('category', e.target.value)}/></label>
          <label>Summary<textarea aria-label="Summary" value={draft.summary} maxLength={320} rows={4} onChange={e => field('summary', e.target.value)}/></label>
          <ImageField value={draft.image} onChange={value => field('image', value)}/>
          {draft.image && <img className="cms-image" src={draft.image} alt={draft.imageAlt}/>}
          <label>Image description<input value={draft.imageAlt} maxLength={240} onChange={e => field('imageAlt', e.target.value)}/></label>
        </div>}
        <div className="cms-actions">
          <button className="primary" disabled={!dirty} onClick={() => run(() => save(mutatePortfolioItem(project, entry.id, 'save', entry.revision, draft)))}>Save draft</button>
          <button disabled={dirty} onClick={() => run(() => save(mutatePortfolioItem(project, entry.id, 'publish', entry.revision)))}>Publish for export</button>
          {entry.published && <button disabled={dirty} onClick={() => run(() => save(mutatePortfolioItem(project, entry.id, 'unpublish', entry.revision)))}>Unpublish</button>}
        </div><small>Saving a draft leaves the current published card unchanged.</small>
      </>}
      {error && <p role="alert" className="cms-error">{error}</p>}
    </div></div>
  </Dialog>;
}
