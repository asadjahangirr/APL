import { describe, expect, it } from 'vitest';
import { createPhase4Template, createPhase4Website, preparePhase4Template, phase4TemplateDetails } from '../src/studio/phase4-templates';
import { designSchema } from '../src/design/schema';
import { sourceFingerprint } from '../src/conversion/fingerprint';
import { buttonHref, pageAnchors, targetHref } from '../src/project/pages';
import { projectSchema, walkNodes, type SiteNode } from '../src/project/schema';
import { MAX_STUDIO_BACKUP_BYTES, readStudioProject, studioProjectSchema } from '../src/project/studio-document';
import { contrastRatio } from '../src/project/theme';

describe('complete original paired Phase 4 templates', () => {
  it.each(phase4TemplateDetails)('$name has complete native pages, actual CMS publications and resolvable actions', details => {
    const website = createPhase4Website(details.id);
    expect(projectSchema.parse(website)).toEqual(website);
    expect(website.pages).toHaveLength(details.pages);
    expect(website.pages.filter(page => page.path === '/')).toHaveLength(1);
    expect(targetHref(website, website.shared.header.props.target)).toBe('/contact#contact');
    for (const page of website.pages) {
      const nodes = walkNodes(page.nodes);
      expect(nodes.filter(node => node.type === 'Heading' && node.props.level === 'h1')).toHaveLength(1);
      for (const node of nodes) {
        if (node.type === 'Button') expect(buttonHref(website, node.props), page.name + ': ' + node.props.label).toBeTruthy();
        if (node.type === 'Image') expect(node.props.alt.trim()).not.toBe('');
      }
    }
    const kinds = website.pages.flatMap(page => page.nodes.map(node => node.type));
    expect(kinds).toContain('Contact');
    expect(kinds).toContain('ArticleCollection');
    expect(kinds).toContain(details.id === 'meridian' ? 'ServiceCollection' : 'PortfolioCollection');
    expect(website.content.articles).toHaveLength(2);
    for (const entry of [...website.content.services, ...website.content.articles, ...website.content.portfolio]) {
      expect(entry.published).toEqual(entry.draft);
      expect(entry.published).not.toBe(entry.draft);
      expect(entry.publishedRevision).toBe(entry.revision);
    }
    if (details.id === 'mira') {
      expect(website.content.portfolio).toHaveLength(2);
      for (const entry of website.content.portfolio) {
        const target = entry.published!.target!;
        const page = website.pages.find(page => page.id === target.pageId)!;
        expect(pageAnchors(page)).toContain(target.anchor);
        expect(targetHref(website, target)).toBe(page.path);
        expect(entry.published!.externalUrl).toBe('');
      }
    }
  });

  it.each(['meridian', 'mira'] as const)('%s makes independent Website, CMS and Design objects without creating conversion history', kind => {
    const first = createPhase4Template(kind), second = createPhase4Template(kind);
    expect(first.id).not.toBe(second.id);
    expect(first.website.shared.header.id).not.toBe(second.website.shared.header.id);
    expect(first.website.content.articles[0].id).not.toBe(second.website.content.articles[0].id);
    first.website.content.articles[0].draft.title = 'Private change in the first project';
    first.design.layers.find(layer => layer.type === 'text')!.text = 'Only this Design changes';
    expect(second.website.content.articles[0].draft.title).not.toBe('Private change in the first project');
    expect(second.design.layers.some(layer => layer.text === 'Only this Design changes')).toBe(false);
    expect(first.conversions).toEqual([]);
    expect(second.conversions).toEqual([]);
  });

  it.each(['meridian', 'mira'] as const)('%s keeps editable desktop/mobile artwork within visual and portable backup bounds', kind => {
    const studio = createPhase4Template(kind);
    expect(designSchema.parse(studio.design)).toEqual(studio.design);
    expect(studioProjectSchema.parse(studio)).toEqual(studio);
    expect(readStudioProject(JSON.parse(JSON.stringify(studio)))).toEqual(studio);
    expect(new TextEncoder().encode(JSON.stringify(studio, null, 2)).byteLength).toBeLessThan(MAX_STUDIO_BACKUP_BYTES / 10);
    expect(studio.design.artboards.map(board => board.width)).toEqual([1440, 390]);
    expect(studio.design.artboards.every(board => board.width * board.height * 4 <= 16_000_000)).toBe(true);
    expect(studio.design.layers.some(layer => layer.typeStyleId !== null)).toBe(true);
    expect(studio.design.layers.some(layer => layer.colorStyleId !== null)).toBe(true);
    for (const board of studio.design.artboards) {
      const mainHeading = studio.design.layers.find(layer => layer.artboardId === board.id && layer.name === 'Page heading / H1')!;
      expect(mainHeading.text).toBe(studio.website.pages[0].nodes.flatMap(node => walkNodes([node])).find((node): node is Extract<SiteNode, { type: 'Heading' }> => node.type === 'Heading' && node.props.level === 'h1')?.props.text);
      for (const layer of studio.design.layers.filter(layer => layer.artboardId === board.id)) {
        expect(layer.x).toBeGreaterThanOrEqual(0);
        expect(layer.y).toBeGreaterThanOrEqual(0);
        expect(layer.x + layer.width).toBeLessThanOrEqual(board.width);
        expect(layer.y + layer.height).toBeLessThanOrEqual(board.height);
      }
    }
    const theme = studio.website.theme;
    expect(contrastRatio(theme.ink, theme.background)).toBeGreaterThan(7);
    expect(contrastRatio(theme.muted, theme.background)).toBeGreaterThan(4.5);
    expect(contrastRatio('#ffffff', theme.accent)).toBeGreaterThan(4.5);
  });

  it('fingerprints meaningful editable Design changes independently of the complete Website', async () => {
    const studio = createPhase4Template('mira');
    const beforeWebsite = JSON.stringify(studio.website);
    const original = await sourceFingerprint(studio.design, 'mira-desktop');
    studio.design.layers.find(layer => layer.id === 'mira-desktop-heading')!.text = 'A different idea.';
    expect(await sourceFingerprint(studio.design, 'mira-desktop')).not.toBe(original);
    expect(JSON.stringify(studio.website)).toBe(beforeWebsite);
  });

  it.each(['meridian', 'mira'] as const)('%s actual creation seeds one private reusable invitation with unique public node IDs', async kind => {
    const studio = await preparePhase4Template(kind);
    expect(studioProjectSchema.parse(studio)).toEqual(studio);
    expect(studio.website.components).toHaveLength(1);
    const allIds = studio.website.pages.flatMap(page => walkNodes(page.nodes).map(node => node.id));
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(studio.design.artboards).toHaveLength(2);
    expect(studio.conversions).toEqual([]);
    const linkedPages = kind === 'meridian' ? ['home', 'studio', 'approach'] : ['home', 'about', 'lumen-press', 'tide-atlas'];
    for (const pageId of linkedPages) {
      const page = studio.website.pages.find(page => page.id === pageId)!;
      expect(walkNodes(page.nodes).filter(node => node.type === 'Button' && node.props.label === 'Start project').length).toBeGreaterThan(0);
    }
  });
});
