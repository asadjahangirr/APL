import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { newProject } from '../src/project/templates';
import { addPage } from '../src/project/pages';
import { createPhase4Website } from '../src/studio/phase4-templates';
import { generateComponentBundle } from '../src/export/component';
import type { Sources } from '../src/export/generate';

const sources: Sources = {};
function read(directory: string) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) read(file);
    else sources[file.replaceAll('\\', '/')] = readFileSync(file, 'utf8');
  }
}
read('templates');
read('src/site');
for (const file of ['schema.ts', 'service-schema.ts', 'portfolio-schema.ts', 'article-schema.ts', 'link-schema.ts', 'icon-schema.ts', 'appearance-schema.ts', 'theme.ts']) {
  sources['src/project/' + file] = readFileSync('src/project/' + file, 'utf8');
}
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe('copy component bundle', () => {
  it('includes the selected renderer, scoped styles, and no unrelated backend', async () => {
    const project = newProject();
    const hero = project.pages[0].nodes.find(node => node.type === 'Hero')!;
    const bundle = await generateComponentBundle(project, 'home', hero.id, sources);
    expect(bundle.entryPath).toBe('src/site/Hero.tsx');
    expect(bundle.files['src/site/Hero.tsx']).toBeDefined();
    expect(bundle.files['src/site/Contact.tsx']).toBeUndefined();
    expect(bundle.files['app/api/contact/route.ts']).toBeUndefined();
    expect(bundle.modules).toEqual([]);
    expect(decode(bundle.files['README.md'])).toContain('npm ci');
    expect(decode(bundle.files['app/globals.css'])).toContain('hero');
    expect(decode(bundle.files['app/globals.css'])).not.toContain('.contact-section');
    expect(JSON.parse(decode(bundle.files['export-manifest.json'])).components).toEqual(['Hero']);
  });

  it('includes real contact handlers and admin setup only for a selected contact', async () => {
    const project = newProject();
    const contact = project.pages[0].nodes.find(node => node.type === 'Contact')!;
    const bundle = await generateComponentBundle(project, 'home', contact.id, sources);
    expect(bundle.files['app/api/contact/route.ts']).toBeDefined();
    expect(bundle.files['app/admin/page.tsx']).toBeDefined();
    expect(bundle.files['src/site/Hero.tsx']).toBeUndefined();
    expect(bundle.modules).toContain('contact');
    expect(bundle.warnings.join(' ')).toContain('Supabase');
  });

  it('wraps a nested heading in the minimum valid layout', async () => {
    const project = newProject();
    project.pages[0].nodes = [{
      id: 'section-example', type: 'Section',
      props: { padding: { mobile: 40 }, width: 'content', tone: 'plain' },
      children: [{ id: 'heading-example', type: 'Heading', props: { text: 'Example', level: 'h2', size: 'medium', align: 'left' } }],
    }];
    const bundle = await generateComponentBundle(project, 'home', 'heading-example', sources);
    expect(bundle.files['src/site/Heading.tsx']).toBeDefined();
    expect(bundle.files['src/site/Section.tsx']).toBeDefined();
    expect(JSON.parse(decode(bundle.files['export-manifest.json'])).components).toEqual(['Section', 'Heading']);
  });

  it('copies a shared header without unrelated page sections or their modules', async () => {
    const project = newProject();
    const bundle = await generateComponentBundle(project, 'home', '@shared/header', sources);
    expect(bundle.entryPath).toBe('src/site/Header.tsx');
    expect(bundle.files['src/site/Header.tsx']).toBeDefined();
    expect(bundle.files['src/site/Contact.tsx']).toBeUndefined();
    expect(bundle.modules).toEqual([]);
    expect(bundle.warnings.join(' ')).toContain('header action');
  });

  it('rejects stale selections and unvalidated project content', async () => {
    const project = newProject();
    await expect(generateComponentBundle(project, 'home', 'missing', sources)).rejects.toThrow('no longer exists');
    const invalid = structuredClone(project);
    Object.assign(invalid.pages[0].nodes[0].props, { onClick: 'alert(1)' });
    await expect(generateComponentBundle(invalid, 'home', invalid.pages[0].nodes[0].id, sources)).rejects.toThrow();
  });

  it('keeps a copied portfolio independent of excluded case-study pages and explains reconnection', async () => {
    const project = createPhase4Website('mira');
    const collection = project.pages[0].nodes.find(node => node.type === 'PortfolioCollection')!;
    const bundle = await generateComponentBundle(project, 'home', collection.id, sources);
    const backup = JSON.parse(decode(bundle.files['project.apl.json']));
    expect(backup.pages).toHaveLength(1);
    expect(backup.content.portfolio.every((entry: { published: { target: { pageId: string } } }) => entry.published.target.pageId === 'home')).toBe(true);
    expect(bundle.warnings.join(' ')).toContain('case-study page outside this bundle');
    expect(bundle.modules).toEqual(['portfolio-cms', 'admin-portfolio']);
    expect(bundle.files['lib/articles.ts']).toBeUndefined();
    expect(bundle.files['lib/portfolio-target.ts']).toBeDefined();
  });

  it('packages a linked icon and reports destinations that must be reconnected', async () => {
    const project = addPage(newProject(), 'About', '/about');
    project.pages[0].nodes = [{ id: 'icon-section', type: 'Section', props: { padding: { mobile: 24 }, width: 'content', tone: 'plain' }, children: [{
      id: 'linked-symbol', type: 'Icon', props: { name: 'briefcase', label: 'About our work', decorative: false, size: { mobile: 24 }, target: { pageId: project.pages[1].id, anchor: '#top' } },
    }] }];
    const bundle = await generateComponentBundle(project, 'home', 'linked-symbol', sources);
    expect(bundle.files['src/site/IconGlyph.tsx']).toBeDefined();
    expect(bundle.warnings.join(' ')).toContain('icon destination pointed outside this bundle');
    expect(bundle.modules).toEqual([]);
  });
});

