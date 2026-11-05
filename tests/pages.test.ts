import { describe, expect, it } from 'vitest';
import legacy from './fixtures/project-v1.json';
import { readProject } from '../src/project/migrate';
import { newProject } from '../src/project/templates';
import { projectSchema, routeSchema } from '../src/project/schema';
import { addPage, editPage, movePage, removePage, headerHref, navigationLinks } from '../src/project/pages';
import { toEditor, fromEditor } from '../src/editor/config';

describe('project migration and page integrity', () => {
  it('migrates a real v1 backup without mutating or discarding authored data', () => {
    const before = structuredClone(legacy), project = readProject(legacy);
    expect(legacy).toEqual(before); expect(project.schemaVersion).toBe(9);
    expect(project.components).toEqual([]);
    expect(project.id).toBe(legacy.id); expect(project.theme).toMatchObject(legacy.theme);
    expect(project.pages[0].nodes).toEqual(legacy.page.nodes.filter(node => !['Header','Footer'].includes(node.type)));
    expect(project.pages[0].title).toBe(legacy.page.title);
    expect(project.pages[0].description).toBe(legacy.page.description);
    const oldHeader = legacy.page.nodes.find(node => node.type === 'Header')!;
    expect(project.shared.header.id).toBe(oldHeader.id);
    expect(project.shared.header.props.brand).toBe(oldHeader.props.brand);
    expect(headerHref(project)).toBe('/#contact');
    expect(project.shared.footer.props).toEqual(legacy.page.nodes.find(node => node.type === 'Footer')!.props);
    expect(readProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });
  it('preserves absent shared sections and rejects unknown formats', () => {
    const old = structuredClone(legacy); old.page.nodes = old.page.nodes.filter(node => !['Header','Footer'].includes(node.type));
    const p = readProject(old); expect(p.shared.header.enabled).toBe(false); expect(p.shared.footer.enabled).toBe(false);
    expect(() => readProject({ ...legacy, schemaVersion: 900 })).toThrow();
  });
  it('keeps page content isolated and shared settings intact when editing and restoring a page', () => {
    const p = addPage(newProject(), 'About', '/about'); const id = p.pages[1].id;
    const data = toEditor(p, id); data.root.props!.title = 'About us';
    data.root.props!.accent = '#123456';
    const changed = fromEditor(data, p, id);
    expect(changed.pages[0]).toEqual(p.pages[0]); expect(changed.pages[1].title).toBe('About us');
    expect(changed.theme.accent).toBe('#123456'); expect(changed.shared).toEqual(p.shared);
  });
  it('rejects conflicting URLs, missing homepages and unsafe export paths', () => {
    for (const path of ['/api','/admin/settings','/assets/image','//external.test','/../escape','/about%2fteam','/about?x=1','/about#x','/[slug]','/_next','/con','/about/aux','/About','https://example.com']) expect(routeSchema.safeParse(path).success, path).toBe(false);
    expect(routeSchema.parse('/about/team')).toBe('/about/team');
    expect(() => addPage(newProject(), 'Another home', '/')).toThrow();
    const p = newProject(); p.pages[0].path = '/lost-home'; expect(projectSchema.safeParse(p).success).toBe(false);
  });
  it('keeps links correct through rename, reorder, visibility changes and page deletion', () => {
    let p = addPage(newProject(), 'About', '/about'); const id = p.pages[1].id;
    p.shared.header.props.target = { pageId: id, anchor: '#top' };
    p = editPage(p, id, { name: 'Our story', path: '/our-story', inNavigation: true });
    expect(headerHref(p)).toBe('/our-story');
    p = movePage(p, id, -1); expect(navigationLinks(p)[0].label).toBe('Our story');
    p = editPage(p, id, { name: 'Our story', path: '/our-story', inNavigation: false });
    expect(navigationLinks(p).some(link => link.id === id)).toBe(false);
    expect(headerHref(p)).toBe('/our-story');
    p = removePage(p, id); expect(headerHref(p)).toBe('/'); expect(p.pages).toHaveLength(1);
    expect(() => removePage(p, p.pages[0].id)).toThrow('homepage');
    expect(() => editPage(p, p.pages[0].id, { name: 'Home', path: '/other', inNavigation: true })).toThrow('homepage');
  });
  it('does not save backups too large for the import limit', () => {
    let p = newProject();
    for(let i=0;i<3;i++) p=addPage(p,'Page '+i,'/page-'+i);
    for(const page of p.pages) page.nodes.find(node=>node.type==='Hero')!.props.image='data:image/png;base64,'+'A'.repeat(2_600_000);
    const result=projectSchema.safeParse(p);
    expect(result.success).toBe(false);
    if(!result.success) expect(result.error.issues.some(issue=>issue.message.includes('10 MB'))).toBe(true);
  });
});
