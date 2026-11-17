import { useCallback, useEffect, useState } from 'react';
import { IconButton } from './controls';
import { ClockCounterClockwise, Trash, X } from './icons';
import { deleteVersion, listVersions, loadVersion, saveVersion, type Version } from './storage';
import { useEditor, type EditorStore } from './store';
import { pruneAssets } from './actions';

/**
 * Version history: save named versions, see automatic ones (taken every 30
 * minutes of editing) and restore any of them. Restoring first saves the
 * current design as a version, so nothing is ever lost.
 */
export function VersionsDialog({ store, onClose }: { store: EditorStore; onClose: () => void }) {
  const siteId = useEditor(store, state => state.real.id);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => listVersions(siteId).then(setVersions, () => setVersions([])), [siteId]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    try { await saveVersion(pruneAssets(store.getState().real), name || 'Version ' + new Date().toLocaleString()); setName(''); await refresh(); store.notify('Version saved.'); }
    catch { store.notify('The version could not be saved in this browser.'); }
    finally { setBusy(false); }
  };
  const restore = async (version: Version) => {
    setBusy(true);
    try {
      const doc = await loadVersion(version.id);
      if (!doc) { store.notify('That version could not be opened.'); return; }
      await saveVersion(pruneAssets(store.getState().real), 'Before restoring “' + version.name + '”');
      store.load(doc);
      store.notify(`Restored “${version.name}”. Your previous design was saved as a version.`);
      onClose();
    } catch { store.notify('That version could not be restored.'); }
    finally { setBusy(false); }
  };
  const remove = async (version: Version) => { await deleteVersion(version.id).catch(() => undefined); await refresh(); };

  return (
    <div className="code-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="code ver" role="dialog" aria-modal="true" aria-label="Version history">
        <header className="code-head">
          <div className="code-title"><h2>Version history</h2><span>Saved in this browser. A version is also taken automatically every 30 minutes while you edit.</span></div>
          <IconButton label="Close version history" shortcut="Esc" onClick={onClose}><X size={16} /></IconButton>
        </header>
        <form className="ver-save" onSubmit={event => { event.preventDefault(); void save(); }}>
          <input aria-label="Version name" placeholder="Name this version, e.g. “Before new homepage”" value={name} maxLength={80} onChange={event => setName(event.target.value)} />
          <button type="submit" className="ed-btn ed-btn-primary" disabled={busy}>Save version</button>
        </form>
        <ul className="ver-list" aria-label="Versions">
          {versions === null && <li className="ver-empty">Loading…</li>}
          {versions?.length === 0 && <li className="ver-empty">No versions yet. Save one before a big change.</li>}
          {versions?.map(version => (
            <li key={version.id}>
              <ClockCounterClockwise size={16} />
              <div><strong>{version.name}</strong><small>{new Date(version.createdAt).toLocaleString()}{version.auto ? ' · automatic' : ''} · {version.doc.pages.length} page{version.doc.pages.length > 1 ? 's' : ''}</small></div>
              <button type="button" className="ed-btn" disabled={busy} onClick={() => void restore(version)}>Restore</button>
              <IconButton label={'Delete ' + version.name} onClick={() => void remove(version)}><Trash size={14} /></IconButton>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
