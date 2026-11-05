import { describe, it, expect } from 'vitest';
import { newProject } from '../src/project/templates';
import { readProject } from '../src/project/migrate';
import { projectSchema } from '../src/project/schema';
import { addPortfolioCollection, createPortfolioItem, mutatePortfolioItem, publicPortfolio } from '../src/project/portfolio';
import { emptyPortfolio, safeProjectUrl } from '../src/project/portfolio-schema';
import { createService, mutateService } from '../src/project/services';
import { emptyService } from '../src/project/service-schema';
import { toEditor, fromEditor } from '../src/editor/config';
import { themePresets, contrastRatio, themeStyle } from '../src/project/theme';
import legacy from './fixtures/project-v4.json';

describe('external-link portfolio records', () => {
  it('migrates an actual v4 backup while preserving Services drafts, publications and all page content', () => {
    const before = structuredClone(legacy), migrated = readProject(legacy);
    expect(legacy).toEqual(before);
    expect(migrated.schemaVersion).toBe(9);
    expect(migrated.components).toEqual([]);
    expect(migrated.content.services).toEqual(legacy.content.services);
    expect(migrated.content.portfolio).toEqual([]);
    expect(migrated.theme).toMatchObject(legacy.theme);
    expect(migrated.pages.map(page => ({ ...page, nodes: page.nodes.map(node => {
      if (node.type !== 'ServiceCollection') return node;
      const { design, motion, ...props } = node.props;
      expect(design).toBe('classic'); expect(motion).toBe('none');
      return { ...node, props };
    }) }))).toEqual(legacy.pages);
    expect(migrated.theme.background).toBe('#f9faf7');
  });
  it('keeps draft changes private until explicitly published and rejects stale edits', () => {
    const created = createPortfolioItem(newProject());
    let project = mutatePortfolioItem(created.project, created.id, 'save', 1, { ...emptyPortfolio(), title: 'Website', externalUrl: 'https://example.com/work?ref=portfolio' });
    expect(publicPortfolio(project)).toEqual([]);
    project = mutatePortfolioItem(project, created.id, 'publish', 2);
    const published = structuredClone(project);
    project = mutatePortfolioItem(project, created.id, 'save', 3, { ...project.content.portfolio[0].draft, title: 'Private title', externalUrl: 'https://example.org/new' });
    expect(publicPortfolio(project)[0].title).toBe('Website');
    expect(publicPortfolio(project)[0].externalUrl).toBe('https://example.com/work?ref=portfolio');
    expect(published.content.portfolio[0].draft.title).toBe('Website');
    expect(() => mutatePortfolioItem(project, created.id, 'publish', 3)).toThrow(/changed/);
    project = mutatePortfolioItem(project, created.id, 'publish', 4);
    expect(publicPortfolio(project)[0].title).toBe('Private title');
    project = mutatePortfolioItem(project, created.id, 'unpublish', 5);
    expect(publicPortfolio(project)).toEqual([]);
    expect(project.content.portfolio[0].draft.title).toBe('Private title');
  });
  it('preserves both collections through edits and creation in either manager', () => {
    const first = createPortfolioItem(newProject());
    let project = mutatePortfolioItem(first.project, first.id, 'save', 1, { ...emptyPortfolio(), title: 'Kept project', externalUrl: 'https://example.com' });
    const service = createService(project);
    project = mutateService(service.project, service.id, 'save', 1, { ...emptyService(), title: 'Kept service', slug: 'kept' });
    project = mutateService(project, service.id, 'publish', 2);
    expect(project.content.portfolio).toEqual(service.project.content.portfolio);
    const another = createPortfolioItem(project);
    project = mutatePortfolioItem(another.project, first.id, 'publish', 2);
    expect(project.content.services).toEqual(another.project.content.services);
    expect(project.content.portfolio).toHaveLength(2);
  });
  it('refuses publication without a title and real website destination', () => {
    const first = createPortfolioItem(newProject());
    expect(() => mutatePortfolioItem(first.project, first.id, 'publish', 1)).toThrow(/Publishing/);
    const draft = mutatePortfolioItem(first.project, first.id, 'save', 1, { ...emptyPortfolio(), title: 'No destination' });
    expect(() => mutatePortfolioItem(draft, first.id, 'publish', 2)).toThrow(/Publishing/);
  });
  it('preserves theme, content and design through canvas edits; rejects unknown recipes', () => {
    let project = addPortfolioCollection(newProject(), 'home');
    project.theme = { ...themePresets.find(theme => theme.id === 'ink')!.theme };
    const collection = project.pages[0].nodes.find(node => node.type === 'PortfolioCollection')!;
    collection.props.design = 'poster'; collection.props.motion = 'reveal';
    const editor = toEditor(project);
    editor.root.props!.title = 'New page title';
    const changed = fromEditor(editor, project);
    expect(changed.theme).toEqual(project.theme);
    expect(changed.content).toEqual(project.content);
    expect(changed.pages[0].nodes.find(node => node.type === 'PortfolioCollection')!.props).toEqual(collection.props);
    const invalid = structuredClone(changed);
    Object.assign(invalid.pages[0].nodes.find(node => node.type === 'PortfolioCollection')!.props, { design: '<script>' });
    expect(projectSchema.safeParse(invalid).success).toBe(false);
  });
  it.each(['javascript:alert(1)', 'data:text/html,bad', '//example.com', 'https://user:password@example.com', 'https://@example.com', 'https://%65xample.com', 'https://example.com:', 'https://example.com:99999', 'https://example.com/with space', 'https://example.com\\bad', 'https://example.com\n'])('rejects unsafe or ambiguous destination %j', url => {
    expect(safeProjectUrl(url)).toBe(false);
  });
  it.each(['https://example.com/work?ref=a%20b#top', 'http://localhost:3000/', 'https://example.com:443/path'])('accepts navigable destination %s', url => {
    expect(safeProjectUrl(url)).toBe(true);
  });
});
describe('usable theme presets', () => {
  it('provides six palettes with readable normal text and legible accent buttons', () => {
    expect(new Set(themePresets.map(preset => preset.id)).size).toBe(6);
    for (const { theme } of [...themePresets, { theme: { ...themePresets[0].theme, accent: '#777777' } }]) {
      expect(contrastRatio(theme.ink, theme.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.muted, theme.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.muted, theme.surface)).toBeGreaterThanOrEqual(4.5);
      const vars = themeStyle(theme) as Record<string, string>;
      expect(contrastRatio(theme.accent, vars['--accent-on'])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(vars['--contrast-background'], vars['--contrast-foreground'])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
