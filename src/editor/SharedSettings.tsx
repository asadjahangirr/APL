import { useState } from 'react';
import CompositionPicker from './CompositionPicker';
import CommonDesignPicker from './CommonDesignPicker';
import Dialog from './Dialog';
import { projectSchema, type Project } from '../project/schema';
import { pageAnchors } from '../project/pages';

export default function SharedSettings({ project, save, close }: { project: Project; save: (project: Project) => void; close: () => void }) {
  const [shared, setShared] = useState(() => structuredClone(project.shared)); const [error, setError] = useState('');
  const header = shared.header; const footer = shared.footer;
  const targets = project.pages.flatMap(page => pageAnchors(page).map(anchor => ({ value: JSON.stringify({ pageId: page.id, anchor }), label: page.name + (anchor === '#top' ? ' · top of page' : ' · ' + anchor.slice(1)) })));
  const value = JSON.stringify(header.props.target);
  return <Dialog title="Site header & footer" close={close}>
    <p>These settings apply to every page. Manage page names and menu order in Pages.</p>
    <form onSubmit={event => { event.preventDefault(); try { save(projectSchema.parse({ ...project, shared, updatedAt: new Date().toISOString() })); close(); } catch { setError('Check the header and footer settings.'); } }}>
      <fieldset><legend>Shared header</legend>
        <CompositionPicker family="header" value={header.props.design ?? "classic"} onChange={design => setShared({ ...shared, header: { ...header, props: { ...header.props, design } } })}/>
        <label className="checkbox-label"><input type="checkbox" checked={header.enabled} onChange={event => setShared({ ...shared, header: { ...header, enabled: event.target.checked } })}/>Show header on all pages</label>
        <label>Header brand<input maxLength={4000} value={header.props.brand} onChange={event => setShared({ ...shared, header: { ...header, props: { ...header.props, brand: event.target.value } } })}/></label>
        <label>Header action label<input maxLength={4000} value={header.props.linkLabel} onChange={event => setShared({ ...shared, header: { ...header, props: { ...header.props, linkLabel: event.target.value } } })}/></label>
        <label>Header action destination<select value={value} onChange={event => setShared({ ...shared, header: { ...header, props: { ...header.props, target: JSON.parse(event.target.value) } } })}>
          {!targets.some(target => target.value === value) && <option value={value} disabled>Destination missing — choose a page or section</option>}
          {targets.map(target => <option key={target.value} value={target.value}>{target.label}</option>)}
        </select></label><p className="small-note">Leave the action label empty to hide this extra link.</p>
      </fieldset>
      <fieldset><legend>Shared footer</legend>
        <CommonDesignPicker family="footer" value={footer.props.design ?? 'classic'} onChange={design => setShared({ ...shared, footer: { ...footer, props: { ...footer.props, design } } })}/>
        <label className="checkbox-label"><input type="checkbox" checked={footer.enabled} onChange={event => setShared({ ...shared, footer: { ...footer, enabled: event.target.checked } })}/>Show footer on all pages</label>
        <label>Footer brand<input maxLength={4000} value={footer.props.brand} onChange={event => setShared({ ...shared, footer: { ...footer, props: { ...footer.props, brand: event.target.value } } })}/></label>
        <label>Footer note<input maxLength={4000} value={footer.props.note} onChange={event => setShared({ ...shared, footer: { ...footer, props: { ...footer.props, note: event.target.value } } })}/></label>
      </fieldset>
      <p role="alert">{error}</p><footer><button type="button" onClick={close}>Cancel</button><button className="primary" type="submit">Save shared settings</button></footer>
    </form>
  </Dialog>;
}
