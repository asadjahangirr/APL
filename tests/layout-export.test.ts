import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { newProject } from '../src/project/templates';
import { addPage, editPage } from '../src/project/pages';
import type { BodyNode } from '../src/project/schema';
import { generateProject, type Sources } from '../src/export/generate';

const sources: Sources = {};
function read(dir: string) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.name === 'node_modules' || item.name === '.next') continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) read(file);
    else sources[file.replaceAll('\\', '/')] = readFileSync(file, 'utf8');
  }
}
read('templates'); read('src/site');
sources['src/project/schema.ts'] = readFileSync('src/project/schema.ts', 'utf8');
sources['src/project/service-schema.ts'] = readFileSync('src/project/service-schema.ts', 'utf8');
for (const helper of ['portfolio-schema.ts', 'article-schema.ts', 'link-schema.ts', 'icon-schema.ts', 'appearance-schema.ts', 'theme.ts']) sources['src/project/' + helper] = readFileSync('src/project/' + helper, 'utf8');
const decode = (data: Uint8Array) => new TextDecoder().decode(data);
type Section = Extract<BodyNode, { type: 'Section' }>;
function layout(pageId = 'home'): Section {
  return {
    id: 'nested-section', type: 'Section', props: { padding: { mobile: 24, desktop: 64 }, width: 'wide', tone: 'soft' }, children: [{
      id: 'nested-columns', type: 'Columns', props: { layout: { mobile: 'stack', tablet: 'halves', desktop: 'one-two' }, gap: { mobile: 12, desktop: 32 }, align: 'stretch' }, children: [
        { id: 'nested-left', type: 'Column', props: { gap: { mobile: 16 }, align: 'start' }, children: [
          { id: 'nested-heading', type: 'Heading', props: { text: 'Selected heading', level: 'h2', size: 'large', align: 'left' } },
          { id: 'nested-button', type: 'Button', props: { label: 'Read our approach', target: { pageId, anchor: '#top' }, variant: 'outline', shape: 'pill', motion: 'arrow' } }
        ] },
        { id: 'nested-right', type: 'Column', props: { gap: { mobile: 20 }, align: 'center' }, children: [
          { id: 'nested-image', type: 'Image', props: { image: 'data:image/png;base64,iVBORw0KGgo=', alt: 'Local test asset', ratio: 'landscape', radius: 'soft' } }
        ] }
      ]
    }]
  };
}
function staticProject() {
  const project = newProject();
  project.pages[0].nodes = [layout()];
  project.shared.header.props.target = { pageId: 'home', anchor: '#top' };
  return project;
}
describe('independent nested-layout export', () => {
  it('generates readable nested JSX, bundles deep assets, and omits unselected modules and leaves', async () => {
    const { files, modules } = await generateProject(staticProject(), sources);
    const page = decode(files['app/page.tsx']);
    expect(page).toContain('nodes[0].children![0].children![0].children![0].props');
    expect(page).toContain('<Section'); expect(page).toContain('</Column>');
    expect(page).toContain('navigation.buttons["nested-button"]');
    expect(page).not.toContain('@puckeditor');
    for (const kind of ['Section', 'Columns', 'Column', 'Heading', 'Button', 'Image']) expect(files['src/site/' + kind + '.tsx']).toBeDefined();
    for (const kind of ['Hero', 'Services', 'Paragraph', 'Contact']) expect(files['src/site/' + kind + '.tsx']).toBeUndefined();
    expect(files['src/site/layout-utils.ts']).toBeDefined();
    expect(modules).toEqual([]);
    expect(files['app/api/contact/route.ts']).toBeUndefined();
    expect(Array.from(files['public/assets/nested-image.png'])).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const data = JSON.parse(decode(files['site-data.json']));
    expect(data.pages[0].nodes[0].children[0].children[1].children[0].props.image).toBe('/assets/nested-image.png');
    expect(data.pages[0].nodes[0].children[0].props.layout).toEqual({ mobile: 'stack', tablet: 'halves', desktop: 'one-two' });
    const backup = JSON.parse(decode(files['project.apl.json']));
    expect(backup.pages[0].nodes[0].children[0].children[1].children[0].props.image).toMatch(/^data:image\/png/);
  });
  it('resolves nested button destinations from stable page IDs after a URL change', async () => {
    let project = addPage(staticProject(), 'Approach', '/approach');
    project.pages[0].nodes = [layout(project.pages[1].id)];
    project = editPage(project, project.pages[1].id, { name: 'Our approach', path: '/about/approach', inNavigation: false });
    const { files } = await generateProject(project, sources);
    expect(JSON.parse(decode(files['site-navigation.json'])).buttons['nested-button']).toBe('/about/approach');
    expect(files['app/about/approach/page.tsx']).toBeDefined();
  });
  it('keeps malicious nested content as escaped renderer data, never JSX source', async () => {
    const project = staticProject();
    const section = project.pages[0].nodes[0] as Section;
    const columns = section.children[0];
    if (columns.type !== 'Columns') throw new Error('Fixture columns missing.');
    const heading = columns.children[0].children[0];
    if (heading.type !== 'Heading') throw new Error('Fixture heading missing.');
    const payload = '</script><script>alert(1)</script> {process.exit()}';
    heading.props.text = payload;
    const { files } = await generateProject(project, sources);
    expect(decode(files['app/page.tsx'])).not.toContain(payload);
    expect(JSON.parse(decode(files['site-data.json'])).pages[0].nodes[0].children[0].children[0].children[0].props.text).toBe(payload);
  });
  it('blocks a broken nested button even if its label is blank', async () => {
    const project = staticProject();
    const section = layout('missing-page');
    const columns = section.children[0];
    if (columns.type !== 'Columns') throw new Error('Fixture columns missing.');
    const button = columns.children[0].children[1];
    if (button.type !== 'Button') throw new Error('Fixture button missing.');
    button.props.label = '';
    project.pages[0].nodes = [section];
    await expect(generateProject(project, sources)).rejects.toThrow('Choose a valid button destination');
  });
  it.each(['section', 'columns', 'column'])('blocks an empty %s instead of exporting invisible draft containers', async kind => {
    const project = staticProject();
    const section = project.pages[0].nodes[0] as Section;
    const columns = section.children[0];
    if (columns.type !== 'Columns') throw new Error('Fixture columns missing.');
    if (kind === 'section') section.children = [];
    else if (kind === 'columns') columns.children = [];
    else columns.children[0].children = [];
    await expect(generateProject(project, sources)).rejects.toThrow('empty ' + kind);
  });
  it('retains the existing contact backend when adding nested presentation layouts', async () => {
    const project = newProject(); project.pages[0].nodes.push(layout());
    const { files, modules } = await generateProject(project, sources);
    expect(modules).toEqual(['contact', 'admin-inbox']);
    expect(files['app/admin/page.tsx']).toBeDefined();
    expect(files['app/api/contact/route.ts']).toBeDefined();
  });
  it('does not package layout helper code for a project without nested components', async () => {
    const { files } = await generateProject(newProject(), sources);
    expect(files['src/site/layout-utils.ts']).toBeUndefined();
  });
});
