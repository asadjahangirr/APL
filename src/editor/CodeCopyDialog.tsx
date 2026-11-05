import { useEffect, useMemo, useState } from 'react';
import Dialog from './Dialog';
import { walkNodes, type Project } from '../project/schema';
import { getCurrentStudioProject } from '../project/storage';
import { prepareComponentBundle, downloadComponentBundle } from '../export/component-browser';
import { copyCode, decodeCodeFile } from '../export/code-copy';
import { Code, Copy, DownloadSimple } from '../design/icons';
import './release-tools.css';

type Bundle = Awaited<ReturnType<typeof prepareComponentBundle>>;
const readable = (name: string) => /\.(tsx?|css|md|json|mjs|yml|yaml|txt|sql|toml)$/.test(name) || /(?:^|\/)(?:Dockerfile[^/]*|\.env\.example)$/.test(name);

export default function CodeCopyDialog({ project, pageId, nodeId, close }: { project: Project; pageId: string; nodeId?: string; close: () => void }) {
  const selections = useMemo(() => {
    const page = project.pages.find(item => item.id === pageId)!;
    return [
      ...walkNodes(page.nodes).map(node => ({ id: node.id, label: `${node.type} / ${'text' in node.props ? node.props.text.slice(0, 48) : 'title' in node.props ? node.props.title.slice(0, 48) : node.id}` })),
      ...(project.shared.header.enabled ? [{ id: '@shared/header', label: 'Shared header' }] : []),
      ...(project.shared.footer.enabled ? [{ id: '@shared/footer', label: 'Shared footer' }] : []),
    ];
  }, [project, pageId]);
  const [selected, setSelected] = useState(selections.some(item => item.id === nodeId) ? nodeId! : selections[0]?.id || '');
  const [bundle, setBundle] = useState<Bundle>();
  const [file, setFile] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('');
  useEffect(() => {
    let active = true;
    setBundle(undefined); setBusy(true); setError(''); setStatus('');
    if (!selected) { setBusy(false); return; }
    void getCurrentStudioProject(project).then(studio => prepareComponentBundle(studio.website, pageId, selected)).then(result => {
      if (!active) return;
      setBundle(result); setFile(result.entryPath); setBusy(false);
    }).catch(error => { if (active) { setError(error instanceof Error ? error.message : 'This component could not be prepared.'); setBusy(false); } });
    return () => { active = false; };
  }, [project, pageId, selected]);
  const files = bundle ? Object.keys(bundle.files).filter(readable).sort() : [];
  const code = bundle?.files[file] ? decodeCodeFile(bundle.files[file]) : '';
  async function copy(value: string, label: string) {
    setError('');
    try { await copyCode(value); setStatus(`${label} copied.`); }
    catch { setError('Clipboard access was unavailable. Select the code below to copy it, or download the complete bundle.'); }
  }
  return <Dialog title="Take a component with you." close={close} wide>
    <div className="release-tools code-copy-dialog">
      <p className="release-intro">Choose a component and keep its source, styles, images, and setup instructions. The downloaded bundle uses the same renderer as your website.</p>
      <label>Component<select aria-label="Component to copy" value={selected} onChange={event => setSelected(event.target.value)}>{selections.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      {busy && <p role="status">Preparing the component files…</p>}
      {!selected && <p>Add a section to this page first, then return to copy its code.</p>}
      {bundle && <>
        <div className="release-summary"><Code size={22}/><div><strong>{bundle.componentName}</strong><span>{Object.keys(bundle.files).length} files{bundle.modules.length ? ` / ${bundle.modules.join(', ')}` : ' / frontend component'}</span></div></div>
        {bundle.warnings.map((warning, index) => <p className="release-note" key={index}>{warning}</p>)}
        <div className="release-actions"><button onClick={() => void copy(code, 'File')}><Copy/>Copy file</button><button onClick={() => void copy(bundle.usage, 'Usage example')}><Copy/>Copy usage</button><button className="primary" onClick={() => downloadComponentBundle(bundle, project.name)}><DownloadSimple/>Download bundle</button></div>
        <label>Source file<select aria-label="Source file" value={file} onChange={event => { setFile(event.target.value); setStatus(''); }}>{files.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <textarea className="release-code" aria-label="Component source code" readOnly spellCheck={false} value={code}/>
        <details><summary>How to use these files</summary><p>Run the bundle in a new folder first and read its README. To add it to an existing project, copy the component and its support files, add its styles, and merge the dependency requirements. Contact and CMS components also require their included server, database, and admin setup.</p><pre>{bundle.usage}</pre></details>
      </>}
      {status && <p role="status" className="release-success">{status}</p>}
      {error && <p role="alert" className="release-error">{error}</p>}
    </div>
  </Dialog>;
}
