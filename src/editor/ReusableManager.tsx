import { useEffect, useState } from 'react';
import Dialog from './Dialog';
import { walkNodes, type BodyNode, type Project } from '../project/schema';
import { createStudioProject, type StudioProject } from '../project/studio-document';
import { getCurrentStudioProject, getStudioRevision, saveStudioProject } from '../project/storage';
import { saveReusableComponent, insertReusableComponent, publishReusableComponent, detachReusableInstance, removeReusableComponent, reusableInstanceChanged } from '../project/reusable';
import { Copy, LinkSimple, Plus, Stack, Trash } from '../design/icons';
import './release-tools.css';

function title(node: BodyNode) {
  if (node.type !== 'Section') return node.props.title || node.type;
  const text = walkNodes(node.children).flatMap(child => child.type === 'Heading' || child.type === 'Paragraph' ? [child.props.text] : []).find(Boolean);
  return text?.slice(0, 60) || 'Layout section';
}
function failure(error: unknown) { return error instanceof Error && 'issues' in error ? String((error as { issues: { message: string }[] }).issues[0]?.message || 'Check the component settings.') : error instanceof Error ? error.message : 'This component could not be changed.'; }

export default function ReusableManager({ project, pageId, close, applied }: { project: Project; pageId: string; close: () => void; applied: (studio: StudioProject, saved: boolean, message?: string) => void }) {
  const [base, setBase] = useState<Project>(project);
  const [selected, setSelected] = useState(project.components[0]?.id || '');
  const [rootId, setRootId] = useState(project.pages.find(page => page.id === pageId)?.nodes[0]?.id || '');
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [overwrite, setOverwrite] = useState(false), [approve, setApprove] = useState(false);
  const [changed, setChanged] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  const page = base.pages.find(page => page.id === pageId)!;
  const component = base.components.find(item => item.id === selected);
  const instances = base.pages.flatMap(page => page.nodes.flatMap(node => node.reusable?.componentId === selected ? [{ pageId: page.id, pageName: page.name, nodeId: node.id, node, key: page.id + ':' + node.id }] : []));
  useEffect(() => { let active = true; void getCurrentStudioProject(project).then(studio => { if (active) setBase(studio.website); }).catch(error => active && setError(failure(error))); return () => { active = false; }; }, [project.id]);
  useEffect(() => {
    setApprove(false); setOverwrite(false);
    const preferred = instances.find(item => item.pageId === pageId) || instances[0];
    setSource(preferred?.key || '');
    let active = true;
    void Promise.all(instances.map(async instance => [instance.key, await reusableInstanceChanged(base, instance.pageId, instance.nodeId)] as const)).then(values => active && setChanged(Object.fromEntries(values))).catch(error => active && setError(failure(error)));
    return () => { active = false; };
  }, [base, selected, pageId]);
  async function run(action: (value: Project) => Project | Promise<Project>, message: string) {
    setBusy(true); setError(''); setStatus('');
    let candidate: StudioProject | undefined;
    try {
      const current = await getCurrentStudioProject(project), revision = getStudioRevision(project.id);
      if (JSON.stringify(current.website) !== JSON.stringify(base)) { setBase(current.website); throw new Error('Your project changed. Review the current components, then try again.'); }
      const next = await action(current.website);
      candidate = createStudioProject(next, current.design, current.conversions);
      await saveStudioProject(candidate, { revision });
      setBase(candidate.website); setStatus(message); applied(candidate, true);
    } catch (error) {
      if (candidate) {
        const current = await getCurrentStudioProject(project).catch(() => undefined);
        if (current && JSON.stringify(current) === JSON.stringify(candidate)) { setBase(candidate.website); applied(candidate, false, failure(error)); setStatus('Your changes are available here. Download a recovery backup before closing.'); }
      }
      setError(failure(error));
    } finally { setBusy(false); }
  }
  return <Dialog title="Your reusable components." close={() => { if (!busy) close(); }} wide>
    <div className="release-tools">
      <p className="release-intro">Save a section once and reuse it across pages. Edit an instance in Build, then explicitly update its linked copies here. Detach a copy to make it independent.</p>
      <div className="release-grid">
        <aside className="release-list" aria-label="Saved component library">
          {base.components.map(item => <button key={item.id} disabled={busy} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setError(''); setStatus(''); }}><span><strong>{item.name}</strong><small>{base.pages.flatMap(page => page.nodes).filter(node => node.reusable?.componentId === item.id).length} linked copies / revision {item.revision}</small></span><Stack/></button>)}
          {!base.components.length && <div className="release-empty"><Stack size={28}/><h3>Keep your useful sections.</h3><p>Save a section from this page to start your component library.</p></div>}
          <div className="release-panel"><h3>Save from this page</h3><label>Section to save<select aria-label="Section to save as reusable" value={rootId} disabled={busy} onChange={event => setRootId(event.target.value)}>{page.nodes.map(node => <option key={node.id} value={node.id}>{title(node)}</option>)}</select></label><label>Component name<input aria-label="Reusable component name" maxLength={80} value={name} disabled={busy} placeholder="Project invitation" onChange={event => setName(event.target.value)}/></label><button className="primary" disabled={busy || !rootId || !name.trim()} onClick={() => void run(async current => { const result = await saveReusableComponent(current, pageId, rootId, name.trim()); setSelected(result.componentId); setName(''); return result.project; }, 'Component saved and linked to its source section.')}><Plus/>Save component</button></div>
        </aside>
        <section className="release-panel" aria-label="Selected reusable component">
          {!component ? <p>Select a saved component to add a copy, review its instances, or update them.</p> : <>
            <h3>{component.name}</h3><p>Linked copies render as normal website elements. Updates happen only when you approve them.</p>
            <button disabled={busy || page.nodes.length >= 60} onClick={() => void run(current => insertReusableComponent(current, selected, pageId), `Added ${component.name} to ${page.name}.`)}><Copy/>Add linked copy to {page.name}</button>
            <ul className="release-instance-list">{instances.map(instance => <li key={instance.key}><span><strong>{instance.pageName}</strong><small>{changed[instance.key] ? ' / edited in Build' : ' / linked copy'}</small></span><button disabled={busy} aria-label={`Detach ${component.name} from ${instance.pageName}`} onClick={() => void run(current => detachReusableInstance(current, instance.pageId, instance.nodeId), 'Copy detached. You can edit it independently.')}><LinkSimple/>Detach</button></li>)}</ul>
            {!instances.length && <p>No linked copies yet. Add one to this page to use the component.</p>}
            {instances.length > 0 && <details open><summary>Update linked copies</summary><label>Use this edited section as the source<select aria-label="Reusable update source" value={source} disabled={busy} onChange={event => { setSource(event.target.value); setApprove(false); }}>{instances.map(instance => <option key={instance.key} value={instance.key}>{instance.pageName} / {title(instance.node)}</option>)}</select></label>
              <label className="release-check"><input type="checkbox" checked={approve} disabled={busy} onChange={event => setApprove(event.target.checked)}/>I reviewed this section in Build and want to update all its linked copies.</label>
              {instances.some(instance => instance.key !== source && changed[instance.key]) && <label className="release-check"><input aria-label="Replace separately edited component copies" type="checkbox" checked={overwrite} disabled={busy} onChange={event => setOverwrite(event.target.checked)}/>Also replace copies that were edited separately. Their local changes will be overwritten.</label>}
              <button className="primary" disabled={busy || !approve || !source} onClick={() => { const instance = instances.find(item => item.key === source)!; void run(current => publishReusableComponent(current, selected, instance.pageId, instance.nodeId, component.revision, { overwriteChangedInstances: overwrite }), 'Component and its linked copies updated.'); }}><LinkSimple/>Update linked copies</button>
            </details>}
            <details><summary>Remove from the library</summary><p>Removing a component leaves its page content intact as independent copies.</p><button disabled={busy} onClick={() => { if (window.confirm(`Remove ${component.name} from the library and detach its ${instances.length} copies? The page content will remain.`)) void run(current => removeReusableComponent(current, selected, { detachInstances: true }), 'Component removed; its page content was kept.'); }}><Trash/>Remove component</button></details>
          </>}
        </section>
      </div>
      {status && <p role="status" className="release-success">{status}</p>}
      {error && <p role="alert" className="release-error">{error}</p>}
      {busy && <p role="status">Saving the complete project…</p>}
    </div>
  </Dialog>;
}
