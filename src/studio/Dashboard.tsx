import { useEffect, useState } from 'react';
import type { Project } from '../project/schema';
import { hasArticles, hasContact, hasPortfolio, hasServices } from '../project/schema';
import ProjectCover from './ProjectCover';
import { getDesign } from '../project/storage';
import type { DesignDocument } from '../design/schema';

export function moduleLabel(p: Project) {
  return [hasPortfolio(p) && 'Portfolio', hasServices(p) && 'Services', hasArticles(p) && 'Articles', hasContact(p) && 'Contact'].filter(Boolean).join(' · ') || 'Frontend';
}
export default function Dashboard({ projects, open, openDesign, start, rename, duplicate, backup, backupAll, recoveryAvailable, recover, migrateRecoverAvailable, recoverOriginals, conversionRecoveryAvailable, recoverConversionOriginals, importBackup }: {
  projects: Project[]; open: (project: Project) => void; start: () => void;
  rename: (project: Project) => void; duplicate: (project: Project) => void;
  backup: (project: Project) => void; importBackup: () => void;
  backupAll: () => void;
  recoveryAvailable: boolean; recover: () => void;
  migrateRecoverAvailable: boolean; recoverOriginals: () => void;
  conversionRecoveryAvailable?: boolean; recoverConversionOriginals?: () => void;
  openDesign?: (project: Project) => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [designs, setDesigns] = useState<Record<string, DesignDocument>>({});
  useEffect(() => {
    let active = true;
    void Promise.all(projects.map(async project => {
      try { return [project.id, await getDesign(project)] as const; }
      catch { return null; }
    })).then(values => {
      if (active) setDesigns(Object.fromEntries(values.filter((value): value is readonly [string, DesignDocument] => value !== null)));
    });
    return () => { active = false; };
  }, [projects]);
  const visible = projects.filter(p => p.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt));
  return <main id="main" className="studio-dashboard"><div className="dashboard-heading"><div><p className="studio-eyebrow">Your studio / Local workspace</p><h1>Room for your ideas.</h1><p>Pick up where you left off, or begin something new.</p></div><button className="studio-primary" onClick={start}>New project ↗</button></div><div className="dashboard-tools"><label className="project-search">Find a project<input type="search" placeholder="Search by name" value={search} onChange={e => setSearch(e.target.value)}/></label><label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Recently edited</option><option value="name">Project name</option></select></label><span>{projects.length} {projects.length === 1 ? 'project' : 'projects'} on this device</span>{projects.length > 0 && <button className="studio-text-button" onClick={backupAll}>Back up all ↓</button>}<button className="studio-text-button" onClick={importBackup}>Import backup ↗</button></div>
    {!projects.length ? <div className="dashboard-empty"><span className="empty-index">01 / Begin here</span><h2>A space with<br/>your name on it.</h2><p>Your saved projects will live here. Start with an original example or a simple website starter.</p><button className="studio-primary" onClick={start}>Create your first project ↗</button></div> : !visible.length ? <div className="dashboard-empty"><h2>No matching projects.</h2><p>Try a different name, or clear your search to see your work.</p><button className="studio-secondary" onClick={() => setSearch('')}>Clear search</button></div> : <div className="project-grid">{visible.map(p => { const design = designs[p.id]; return <article className="project-card" key={p.id}><button className="cover-button" onClick={() => open(p)} aria-label={'Open ' + p.name}><ProjectCover project={p} design={design}/><span className="cover-preview">Continue editing ↗</span></button><div className="project-card-copy"><h2><button onClick={() => open(p)}>{p.name}</button></h2><p>{design?.artboards.length ? `${design.artboards.length} ${design.artboards.length === 1 ? 'artboard' : 'artboards'} · ${p.pages.length} website ${p.pages.length === 1 ? 'page' : 'pages'}` : `${p.pages.length} ${p.pages.length === 1 ? 'page' : 'pages'} · ${moduleLabel(p)}`}</p><time dateTime={p.updatedAt}>Edited {new Date(p.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' })}</time><div className="project-card-actions">{design?.artboards.length && openDesign ? <button onClick={() => openDesign(p)} aria-label={'Design ' + p.name}>Design ↗</button> : null}<button onClick={() => rename(p)} aria-label={'Rename ' + p.name}>Rename</button><button onClick={() => duplicate(p)} aria-label={'Duplicate ' + p.name}>Duplicate</button><button onClick={() => backup(p)} aria-label={'Back up ' + p.name}>Back up</button></div></div></article>; })}</div>}
    <aside className="local-note"><strong>Local by design.</strong><div><p>Projects are saved in this browser on this device. Download APL backups before clearing browser data or moving to another computer. Cloud accounts and sync arrive in a later phase.</p>{recoveryAvailable && <><p>A separate recovery snapshot preserves the first saved workspace opened by this studio update. It stays in this browser until you download it.</p><button className="studio-text-button" onClick={recover}>Download recovery snapshot ↓</button></>}{migrateRecoverAvailable && <><p>Original websites are also preserved before their first canvas-format save. Download them to restore independent copies through Import backup. Current projects stay unchanged.</p><button className="studio-text-button" onClick={recoverOriginals}>Download original websites ↓</button></>}{conversionRecoveryAvailable && <><p>Your pre-conversion Design and Website originals are preserved separately in their original backup format.</p><button className="studio-text-button" onClick={recoverConversionOriginals}>Download pre-conversion originals</button></>}</div></aside>
  </main>;
}
