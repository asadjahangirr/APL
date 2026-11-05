import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createArtboard, createLayer, emptyDesign, type DesignDocument } from '../src/design/schema';
import { newProject } from '../src/project/templates';
import { projectSchema, walkNodes, type Project, type SiteNode } from '../src/project/schema';
import { targetHref } from '../src/project/pages';
import { analyzeConversion, compareConversion, compileConversion, decorationBounds, suggestConversionPlan, updateConversion, type ConversionOptions } from '../src/conversion/engine';
import { conversionPlanSchema, conversionRecordSchema, type ConversionPlan } from '../src/conversion/schema';
import { canonicalJSON, fingerprint, sourceFingerprint } from '../src/conversion/fingerprint';
import { businessDesign, businessConversionPlan } from '../src/conversion/demo';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const now = '2026-10-03T12:00:00.000Z';
function fixture() {
  const design = emptyDesign();
  design.artboards = [createArtboard({ id: 'board', name: 'Business page', width: 1200, height: 800 })];
  design.layers = [createLayer('text', 'board', { id: 'headline', name: 'Headline', text: 'A useful business', x: 40, y: 40, width: 600, height: 80, fontSize: 48 })];
  const website = newProject();
  return { design, website, plan: suggestConversionPlan(design, 'board', website) };
}
function approved(design: DesignDocument, website: Project, plan: ConversionPlan, extra: ConversionOptions = {}): ConversionOptions {
  let id = 0;
  return { now, idFactory: () => ++id === 1 ? 'record-one' : 'converted-page', acknowledgedWarnings: analyzeConversion(design, website, plan).issues.filter(issue => issue.severity === 'warning').map(issue => issue.id), ...extra };
}
function generated(website: Project, pageId: string): SiteNode[] { return walkNodes(website.pages.find(page => page.id === pageId)!.nodes); }

describe('guided conversion boundaries', () => {
  it('creates native content on a new page without changing existing pages, content, theme or shared sections', async () => {
    const { design, website, plan } = fixture();
    design.layers[0].text = '<script>alert("authored text")</script>\nA useful business';
    const before = structuredClone({ design, website });
    const result = await compileConversion(design, website, plan, approved(design, website, plan));
    expect(result.website.schemaVersion).toBe(9);
    expect(result.website.pages.slice(0, -1)).toEqual(website.pages);
    for (const key of ['content', 'theme', 'shared'] as const) expect(result.website[key]).toEqual(website[key]);
    const heading = generated(result.website, result.record.pageId).find(node => node.type === 'Heading')!;
    expect(heading).toMatchObject({ type: 'Heading', props: { level: 'h1', text: design.layers[0].text } });
    expect(result.website.pages.at(-1)).toMatchObject({ path: '/designed-page', showHeader: false, showFooter: false });
    expect({ design, website }).toEqual(before);
    expect(conversionRecordSchema.parse(result.record)).toEqual(result.record);
    expect(await compareConversion(design, result.website, result.record)).toBe('current');
  });

  it('resolves linked typography and color while storing explicit responsive values', async () => {
    const { design, website } = fixture();
    design.colors = [{ id: 'ink', name: 'Ink', value: '#123456' }];
    design.typeStyles = [{ id: 'display', name: 'Display', fontFamily: 'Georgia', fontSize: 76, fontWeight: 700, lineHeight: 1.1 }];
    Object.assign(design.layers[0], { colorStyleId: 'ink', typeStyleId: 'display', opacity: 0.5 });
    const plan = suggestConversionPlan(design, 'board', website);
    const result = await compileConversion(design, website, plan, approved(design, website, plan));
    const heading = generated(result.website, result.record.pageId).find(node => node.type === 'Heading')!;
    expect(heading.props).toMatchObject({ appearance: { fontFamily: { mobile: 'Georgia' }, fontSize: { mobile: 40, tablet: 64, desktop: 76 }, fontWeight: { mobile: 700 }, lineHeight: { mobile: 1.1 }, color: { mobile: '#12345680' } } });
  });

  it('honors explicit column and item reading order with distinct three-breakpoint layout rules', async () => {
    const { design, website } = fixture();
    design.layers.push(createLayer('text', 'board', { id: 'body', text: 'The explanation follows the title.', x: 700, y: 40, width: 300, height: 120, fontSize: 18 }));
    const plan = suggestConversionPlan(design, 'board', website), section = plan.sections[0];
    const [title, body] = section.columns[0].items;
    section.columns = [{ id: 'right-first', items: [body] }, { id: 'title-second', items: [title] }];
    section.layout = { mobile: 'stack', tablet: 'halves', desktop: 'one-two' };
    const result = await compileConversion(design, website, plan, approved(design, website, plan));
    const columns = generated(result.website, result.record.pageId).find(node => node.type === 'Columns')!;
    expect(columns.props).toMatchObject({ layout: section.layout });
    expect('children' in columns && columns.children.map(column => 'children' in column ? column.children[0].type : '')).toEqual(['Paragraph', 'Heading']);
  });

  it('reports invalid partial drafts and path conflicts without throwing or overwriting pages', () => {
    const { design, website, plan } = fixture();
    plan.page.name = '';
    expect(analyzeConversion(design, website, plan)).toMatchObject({ canCompile: false, issues: [{ severity: 'error', code: 'invalid-document' }] });
    plan.page.name = 'Business'; plan.page.path = '/';
    expect(analyzeConversion(design, website, plan).issues.some(issue => issue.code === 'path-conflict')).toBe(true);
    plan.page.path = '/api';
    expect(analyzeConversion(design, website, plan).issues.some(issue => issue.code === 'invalid-path')).toBe(true);
  });

  it('never truncates overlong meaningful text and requires one H1', async () => {
    const { design, website, plan } = fixture();
    design.layers[0].text = 'a'.repeat(4001);
    expect(analyzeConversion(design, website, plan).issues.some(issue => issue.code === 'text-too-long')).toBe(true);
    await expect(compileConversion(design, website, plan, approved(design, website, plan))).rejects.toThrow('4,000');
    expect(design.layers[0].text).toHaveLength(4001);
    design.layers[0].text = 'A title'; plan.sections[0].columns[0].items[0].level = 'h2';
    expect(analyzeConversion(design, website, plan).issues.some(issue => issue.code === 'page-heading')).toBe(true);
  });

  it('requires explicit warning approval for rotated and clipped meaningful content', async () => {
    const { design, website } = fixture();
    design.layers.unshift(createLayer('frame', 'board', { id: 'frame', x: 200, y: 100, width: 200, height: 100, rotation: 90 }));
    Object.assign(design.layers[1], { parentId: 'frame', x: 220, y: 100, width: 300, height: 80 });
    const plan = suggestConversionPlan(design, 'board', website), analysis = analyzeConversion(design, website, plan);
    expect(analysis.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['meaningful-rotation', 'meaningful-clipping', 'responsive-flow']));
    await expect(compileConversion(design, website, plan)).rejects.toThrow('acknowledge');
    const result = await compileConversion(design, website, plan, approved(design, website, plan));
    expect(generated(result.website, result.record.pageId).find(node => node.type === 'Heading')).toMatchObject({ props: { text: design.layers[1].text } });
  });

  it('blocks missing/unsafe destinations and resolves real converted section links', async () => {
    const { design, website } = fixture();
    design.layers.push(createLayer('text', 'board', { id: 'action', name: 'Button label', text: 'Talk to us', x: 40, y: 160, width: 200, height: 30, fontSize: 16 }));
    const plan = suggestConversionPlan(design, 'board', website), action = plan.sections[0].columns[0].items.find(item => item.layerId === 'action')!;
    expect(action.role).toBe('button');
    expect(analyzeConversion(design, website, plan).issues.some(issue => issue.code === 'missing-destination')).toBe(true);
    action.destination = { kind: 'url', value: 'javascript:alert(1)' };
    expect(analyzeConversion(design, website, plan).issues.some(issue => issue.code === 'invalid-destination')).toBe(true);
    action.destination = { kind: 'section', sectionId: plan.sections[0].id };
    const result = await compileConversion(design, website, plan, approved(design, website, plan));
    const button = generated(result.website, result.record.pageId).find(node => node.type === 'Button')!;
    expect(button.type === 'Button' && targetHref(result.website, button.props.target)).toMatch(/^\/designed-page#c-/);
  });

  it.each([{ kind: 'url', value: 'https://example.test/work' }, { kind: 'email', value: 'owner@example.test' }, { kind: 'phone', value: '+1 (555) 123-4567' }] as const)('preserves an explicit $kind destination', async destination => {
    const { design, website } = fixture();
    design.layers.push(createLayer('text', 'board', { id: 'action', name: 'Button', text: 'Get in touch', x: 40, y: 150, width: 220, height: 30, fontSize: 16 }));
    const plan = suggestConversionPlan(design, 'board', website);
    plan.sections[0].columns[0].items.find(item => item.layerId === 'action')!.destination = destination;
    const result = await compileConversion(design, website, plan, approved(design, website, plan));
    expect(generated(result.website, result.record.pageId).find(node => node.type === 'Button')).toMatchObject({ props: { destination } });
  });

  it('keeps meaningful images native and rejects missing alt text or lying encoded dimensions', async () => {
    const { design, website } = fixture();
    design.assets = [{ id: 'photo', name: 'Photo', dataUrl: png, width: 1, height: 1 }];
    design.layers.push(createLayer('image', 'board', { id: 'image', name: 'The team at work', assetId: 'photo', x: 40, y: 180, width: 300, height: 200 }));
    const plan = suggestConversionPlan(design, 'board', website), image = plan.sections[0].columns[0].items.find(item => item.layerId === 'image')!;
    image.alt = '';
    expect(analyzeConversion(design, website, plan).issues.some(issue => issue.code === 'missing-image-alt')).toBe(true);
    image.alt = 'Our team working together';
    const result = await compileConversion(design, website, plan, approved(design, website, plan));
    expect(generated(result.website, result.record.pageId).find(node => node.type === 'Image')).toMatchObject({ props: { image: png, alt: image.alt } });
    design.assets[0].width = 2;
    expect(analyzeConversion(design, website, plan).issues.some(issue => issue.code === 'invalid-image')).toBe(true);
    expect(JSON.stringify(result.record)).not.toContain(png);
  });

  it('rasterizes decorative-only subtrees through the injected callback and rejects text-containing artwork', async () => {
    const { design, website } = fixture();
    design.layers.push(createLayer('frame', 'board', { id: 'art', x: 800, y: 80, width: 100, height: 100, fill: '#e0a000' }));
    design.layers.push(createLayer('ellipse', 'board', { id: 'circle', parentId: 'art', x: 810, y: 90, width: 60, height: 60 }));
    const plan = suggestConversionPlan(design, 'board', website);
    const calls: string[][] = [];
    const result = await compileConversion(design, website, plan, approved(design, website, plan, { rasterizeDecoration: async (_design, _board, ids) => { calls.push(ids); return png; } }));
    expect(calls).toEqual([['art']]);
    expect(generated(result.website, result.record.pageId).find(node => node.type === 'Image')).toMatchObject({ props: { alt: '' } });
    design.layers.push(createLayer('text', 'board', { id: 'art-words', parentId: 'art', text: 'Never rasterize this', x: 800, y: 100 }));
    expect(analyzeConversion(design, website, plan).issues.some(issue => issue.code === 'rasterized-text')).toBe(true);
    await expect(compileConversion(design, website, plan, approved(design, website, plan, { rasterizeDecoration: async () => { throw new Error('Must never be reached'); } }))).rejects.toThrow('meaningful text');
    expect(() => decorationBounds(design, 'board', ['art'])).toThrow('Meaningful text');
  });

  it('allows explicitly ignored contact source layers and emits one top-level functional Contact', async () => {
    const { design, website } = fixture();
    design.layers.push(createLayer('frame', 'board', { id: 'contact-frame', name: 'Contact', x: 0, y: 300, width: 1200, height: 300 }));
    design.layers.push(createLayer('text', 'board', { id: 'contact-copy', parentId: 'contact-frame', text: 'Let us talk', x: 40, y: 330, width: 500, height: 60, fontSize: 32 }));
    const plan = suggestConversionPlan(design, 'board', website);
    plan.contact = { sourceLayerIds: ['contact-frame'], title: 'Let us talk', description: 'Send a real inquiry.', button: 'Send message' };
    for (const section of plan.sections) for (const column of section.columns) for (const item of column.items) if (item.layerId === 'contact-copy') item.role = 'ignore';
    const analysis = analyzeConversion(design, website, plan);
    expect(analysis.canCompile).toBe(true);
    expect(analysis.issues.some(issue => issue.code === 'duplicate-contact-mapping')).toBe(false);
    const result = await compileConversion(design, website, plan, approved(design, website, plan));
    expect(result.website.pages.at(-1)!.nodes.filter(node => node.type === 'Contact')).toHaveLength(1);
    expect(generated(result.website, result.record.pageId).filter(node => node.type === 'Section')).toHaveLength(1);
  });

  it('keeps plans bounded and reports unconverted layers instead of silently claiming complete conversion', () => {
    const { design, website } = fixture();
    for (let index = 0; index < 230; index++) design.layers.push(createLayer('text', 'board', { id: 'body-' + index, text: 'Words ' + index, x: 40, y: index * 3, fontSize: 16 }));
    const plan = suggestConversionPlan(design, 'board', website);
    expect(plan.sections.flatMap(section => section.columns.flatMap(column => column.items))).toHaveLength(200);
    expect(analyzeConversion(design, website, plan).issues.some(issue => issue.code === 'unmapped-content')).toBe(true);
    const invalid = structuredClone(plan); invalid.sections[0].columns[0].items.push(invalid.sections[0].columns[0].items[0]);
    expect(conversionPlanSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('conversion provenance and explicit updates', () => {
  it('uses canonical SHA-256 fingerprints and scopes source changes to the selected artboard/references', async () => {
    expect(canonicalJSON({ z: 2, a: { y: 1, x: 0 } })).toBe('{"a":{"x":0,"y":1},"z":2}');
    expect(await fingerprint({ b: 2, a: 1 })).toBe(createHash('sha256').update('{"a":1,"b":2}').digest('hex'));
    const { design } = fixture();
    const before = await sourceFingerprint(design, 'board');
    design.artboards.push(createArtboard({ id: 'other' }));
    design.layers.push(createLayer('text', 'other', { id: 'other-words', text: 'Unrelated' }));
    design.colors.push({ id: 'unused', name: 'Unused', value: '#abcdef' });
    expect(await sourceFingerprint(design, 'board')).toBe(before);
    design.layers[0].colorStyleId = 'unused';
    expect(await sourceFingerprint(design, 'board')).not.toBe(before);
  });

  it('distinguishes design edits, owned website edits, simultaneous edits and detached references', async () => {
    const { design, website, plan } = fixture();
    const result = await compileConversion(design, website, plan, approved(design, website, plan));
    const changedDesign = structuredClone(design); changedDesign.layers[0].text = 'New source words';
    const changedWebsite = structuredClone(result.website);
    const heading = generated(changedWebsite, result.record.pageId).find(node => node.type === 'Heading')!;
    if (heading.type === 'Heading') heading.props.text = 'An independent Build edit';
    expect(await compareConversion(changedDesign, result.website, result.record)).toBe('design-changed');
    expect(await compareConversion(design, changedWebsite, result.record)).toBe('website-changed');
    expect(await compareConversion(changedDesign, changedWebsite, result.record)).toBe('both-changed');
    const detached = structuredClone(design); detached.layers = [];
    expect(await compareConversion(detached, result.website, result.record)).toBe('detached');
    expect(conversionRecordSchema.safeParse(result.record).success).toBe(true);
  });

  it('updates only converted roots after explicit conflict approval and preserves unrelated content/chrome/metadata', async () => {
    const { design, website, plan } = fixture();
    const result = await compileConversion(design, website, plan, approved(design, website, plan));
    const edited = structuredClone(result.website), page = edited.pages.at(-1)!;
    page.name = 'Owner name'; page.path = '/owner-edited-path'; page.showHeader = true; page.showFooter = true;
    const note = { id: 'owner-note', type: 'Text' as const, props: { title: 'Keep this note', body: 'Unrelated owner content.', align: 'left' as const } };
    page.nodes.unshift(note);
    design.layers[0].text = 'A confirmed source update';
    await expect(updateConversion(design, edited, result.record, plan, approved(design, edited, plan))).rejects.toThrow('explicitly confirm');
    const updated = await updateConversion(design, edited, result.record, plan, approved(design, edited, plan, { overwriteTargetChanges: true, now: '2026-10-03T13:00:00.000Z' }));
    expect(updated.website.pages.slice(0, -1)).toEqual(edited.pages.slice(0, -1));
    expect(updated.website.pages.at(-1)).toMatchObject({ name: 'Owner name', path: '/owner-edited-path', showHeader: true, showFooter: true });
    expect(updated.website.pages.at(-1)!.nodes[0]).toEqual(note);
    expect(updated.record.targetRootIds).toEqual(result.record.targetRootIds);
    expect(updated.record.createdAt).toBe(result.record.createdAt);
    expect(updated.record.updatedAt).not.toBe(result.record.updatedAt);
    expect(generated(updated.website, updated.record.pageId).find(node => node.type === 'Heading')).toMatchObject({ props: { text: design.layers[0].text } });
    expect(await compareConversion(design, updated.website, updated.record)).toBe('current');
    expect(projectSchema.safeParse(updated.website).success).toBe(true);
  });
});

it('composes ancestor rotation and frame clipping for decorative crop bounds', () => {
  const design = emptyDesign(); design.artboards = [createArtboard({ id: 'board', width: 600, height: 600 })];
  design.layers = [createLayer('frame', 'board', { id: 'parent', x: 300, y: 100, width: 100, height: 80, rotation: 90 }), createLayer('rectangle', 'board', { id: 'child', parentId: 'parent', x: 350, y: 110, width: 100, height: 20 })];
  expect(decorationBounds(design, 'board', ['child'])).toEqual({ x: 270, y: 150, width: 20, height: 50 });
});

it('converts the business demonstration into native text, linked action and a real Contact with separate title typography', async () => {
  const design = businessDesign(), website = newProject(), plan = businessConversionPlan(design, website);
  const analysis = analyzeConversion(design, website, plan);
  expect(analysis.canCompile, JSON.stringify(analysis.issues)).toBe(true);
  const rasterized: string[][] = [];
  const result = await compileConversion(design, website, plan, approved(design, website, plan, { rasterizeDecoration: async (_design, _board, ids) => { rasterized.push(ids); return png; } }));
  const nodes = generated(result.website, result.record.pageId);
  expect(rasterized).toEqual([['desktop-artwork']]);
  expect(nodes.filter(node => node.type === 'Heading' && node.props.level === 'h1')).toHaveLength(1);
  expect(nodes.find(node => node.type === 'Button')).toMatchObject({ props: { label: 'Start a conversation', target: { pageId: result.record.pageId, anchor: '#contact' } } });
  const contact = nodes.find(node => node.type === 'Contact');
  expect(contact).toMatchObject({ props: { title: "Let's make\nsomething useful.", appearance: { fontFamily: { mobile: 'Arial' } }, buttonAppearance: { fontSize: { mobile: 16 } } } });
  if (contact?.type === 'Contact') expect(contact.props.appearance?.fontSize).toBeUndefined();
  expect(result.website.pages.slice(0, -1)).toEqual(website.pages);
});
