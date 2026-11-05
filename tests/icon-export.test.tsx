import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { newProject } from '../src/project/templates';
import { addPage, editPage, iconHref, buttonHref } from '../src/project/pages';
import { createPhase4Website } from '../src/studio/phase4-templates';
import { definitions, type BodyNode } from '../src/project/schema';
import { toEditor, fromEditor } from '../src/editor/config';
import { saveReusableComponent } from '../src/project/reusable';
import { createStudioProject } from '../src/project/studio-document';
import { generateProject, type Sources } from '../src/export/generate';
import Icon from '../src/site/Icon';
import Button from '../src/site/Button';

const readSources = (): Sources => {
  const sources: Sources = {};
  const read = (dir: string) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) read(file);
      else sources[file.replaceAll('\\', '/')] = readFileSync(file, 'utf8');
    }
  };
  read('templates'); read('src/site');
  for (const file of ['schema.ts', 'service-schema.ts', 'portfolio-schema.ts', 'article-schema.ts', 'link-schema.ts', 'icon-schema.ts', 'appearance-schema.ts', 'theme.ts']) sources['src/project/' + file] = readFileSync('src/project/' + file, 'utf8');
  return sources;
};
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const linkedIcon = (pageId: string): Extract<BodyNode, { type: 'Section' }> => ({
  id: 'icon-section', type: 'Section', props: { padding: { mobile: 24 }, width: 'content', tone: 'plain' }, children: [{
    id: 'linked-icon', type: 'Icon', props: { name: 'briefcase', label: 'See our work', decorative: false, size: { mobile: 24, tablet: 32, desktop: 40 }, target: { pageId, anchor: '#top' } },
  }],
});

describe('linked website icons', () => {
  it('binds exported CMS actions to stable records and rejects an omitted backend', async () => {
    const project = createPhase4Website('meridian');
    const entry = project.content.services[0];
    const props = { label: 'Read this service', target: { pageId: 'home', anchor: '#top' }, destination: { kind: 'service' as const, entryId: entry.id }, variant: 'solid' as const, shape: 'rounded' as const, motion: 'none' as const };
    project.pages[0].nodes.push({ id: 'bound-section', type: 'Section', props: { padding: { mobile: 24 }, width: 'content', tone: 'plain' }, children: [{ id: 'bound-service', type: 'Button', props }] });
    expect(buttonHref(project, props)).toBe('/services/' + entry.published!.slug);
    const { files } = await generateProject(project, readSources());
    const navigation = JSON.parse(decode(files['site-navigation.json']));
    expect(navigation.buttons['bound-service']).toBe('/api/services/' + entry.id + '/link');
    expect(files['app/api/services/[id]/link/route.ts']).toBeDefined();
    expect(files['app/api/portfolio/[id]/link/route.ts']).toBeUndefined();
    for (const page of project.pages) page.nodes = page.nodes.filter(node => node.type !== 'ServiceCollection');
    expect(buttonHref(project, props)).toBe(null);
    await expect(generateProject(project, readSources())).rejects.toThrow('Choose a valid button destination');
  }, 15_000);
  it('renders semantic linked and decorative symbols without executable content', () => {
    const link = renderToStaticMarkup(createElement(Icon, { id: 'icon', name: 'github', label: 'GitHub profile', decorative: false, size: { mobile: 24 }, href: 'https://example.com', destination: { kind: 'url', value: 'https://example.com' } }));
    expect(link).toContain('aria-label="GitHub profile"');
    expect(link).toContain('target="_blank" rel="noopener noreferrer"');
    expect(link).toContain('<svg');
    expect(link).toContain('--apl-icon-size-mobile:24px');
    const decorative = renderToStaticMarkup(createElement(Icon, { id: 'decoration', name: 'check', label: '', decorative: true, size: { mobile: 20 } }));
    expect(decorative).not.toContain('<a ');
    expect(decorative).not.toContain('role="img"');
    expect(definitions.Icon.safeParse({ name: 'github', label: '', decorative: false, size: { mobile: 24 }, destination: { kind: 'url', value: 'https://example.com' } }).success).toBe(false);
    expect(definitions.Icon.safeParse({ name: 'github', label: 'Unsafe', decorative: false, size: { mobile: 24 }, destination: { kind: 'url', value: 'javascript:alert(1)' } }).success).toBe(false);
  });

  it('places a selected symbol on a button without changing its accessible label', () => {
    const markup = renderToStaticMarkup(createElement(Button, { id: 'button', label: 'View work', target: { pageId: 'home', anchor: '#top' }, variant: 'solid', shape: 'rounded', motion: 'none', icon: 'arrow-up-right', iconPosition: 'end', href: '/work' }));
    expect(markup).toMatch(/<span>View work<\/span><svg/);
    expect(markup).toContain('aria-hidden="true"');
  });

  it('resolves page links after renaming and packages only selected components', async () => {
    let project = addPage(newProject(), 'Work', '/work');
    const pageId = project.pages[1].id;
    project.pages[0].nodes = [linkedIcon(pageId)];
    project.shared.header.props.target = { pageId: project.pages[0].id, anchor: '#top' };
    project = editPage(project, pageId, { name: 'Selected work', path: '/selected-work', inNavigation: true });
    const icon = (project.pages[0].nodes[0] as Extract<BodyNode, { type: 'Section' }>).children[0];
    if (icon.type !== 'Icon') throw new Error('Fixture icon missing.');
    expect(iconHref(project, icon.props)).toBe('/selected-work');
    const { files } = await generateProject(project, readSources());
    const navigation = JSON.parse(decode(files['site-navigation.json']));
    expect(navigation.icons['linked-icon']).toBe('/selected-work');
    expect(decode(files['app/page.tsx'])).toContain('navigation.icons["linked-icon"] ?? undefined');
    expect(files['src/site/Icon.tsx']).toBeDefined();
    expect(files['src/site/IconGlyph.tsx']).toBeDefined();
    expect(files['src/project/icon-schema.ts']).toBeDefined();
    expect(files['src/project/link-schema.ts']).toBeDefined();
    expect(files['src/site/Button.tsx']).toBeUndefined();
    expect(files['app/api/contact/route.ts']).toBeUndefined();
    icon.props.target = { pageId: 'missing', anchor: '#top' };
    await expect(generateProject(project, readSources())).rejects.toThrow('Choose a valid icon destination');
  });

  it('preserves reusable link metadata when an existing section is edited', async () => {
    const project = newProject();
    const id = project.pages[0].nodes[0].id;
    const saved = await saveReusableComponent(project, project.pages[0].id, id, 'Reusable hero');
    const editor = toEditor(saved.project);
    const restored = fromEditor(editor, saved.project);
    expect(restored.pages[0].nodes[0].reusable).toEqual(saved.project.pages[0].nodes[0].reusable);
    const deleted = structuredClone(editor);
    if (!deleted.root.props) throw new Error('Editor fixture root settings missing.');
    deleted.root.props.body = deleted.root.props.body.filter(node => node.props.id !== id);
    expect(fromEditor(deleted, saved.project).pages[0].nodes.some(node => node.id === id)).toBe(false);
  });

  it('keeps the current Studio design document in an independent export backup', async () => {
    const project = newProject();
    const studio = createStudioProject(project);
    const { files } = await generateProject(studio, readSources());
    const backup = JSON.parse(decode(files['project.apl.json']));
    expect(backup.schemaVersion).toBe(10);
    expect(backup.website.id).toBe(project.id);
    expect(backup.design).toEqual(studio.design);
  });
});
