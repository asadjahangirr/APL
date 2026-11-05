import { describe, expect, it } from 'vitest';
import { readProject } from '../src/project/migrate';
import { legacyV2ProjectSchema } from '../src/project/legacy-v2-schema';
import { newProject } from '../src/project/templates';
import { allNodes, definitions, projectSchema, walkNodes, type BodyNode, type LeafNode } from '../src/project/schema';

const paragraph = (id: string): LeafNode => ({ id, type: 'Paragraph', props: { text: 'A useful paragraph.', align: 'left' } });
function section(): Extract<BodyNode, { type: 'Section' }> {
  return {
    id: 'section', type: 'Section', props: { padding: { mobile: 24, desktop: 64 }, width: 'content', tone: 'soft' },
    children: [
      { id: 'heading', type: 'Heading', props: { text: 'A considered layout', level: 'h2', size: 'large', align: 'left' } },
      { id: 'columns', type: 'Columns', props: { layout: { mobile: 'stack', tablet: 'halves', desktop: 'one-two' }, gap: { mobile: 16, desktop: 32 }, align: 'center' }, children: [
        { id: 'column-a', type: 'Column', props: { gap: { mobile: 16 }, align: 'start' }, children: [
          paragraph('paragraph'),
          { id: 'button', type: 'Button', props: { label: 'Read more', target: { pageId: 'home', anchor: '#top' }, variant: 'outline', shape: 'pill', motion: 'lift' } }
        ] },
        { id: 'column-b', type: 'Column', props: { gap: { mobile: 16 }, align: 'center' }, children: [
          { id: 'image', type: 'Image', props: { image: '', alt: 'Our studio', ratio: 'landscape', radius: 'soft' } }
        ] }
      ] }
    ]
  };
}
function withNodes(nodes: unknown[]) {
  const project = newProject();
  return { ...project, pages: [{ ...project.pages[0], nodes }] };
}

describe('nested layout migration', () => {
  it('preserves every v2 field and node without wrapping or changing the stored original', () => {
    const { content: _content, components: _components, ...legacy } = newProject();
    const v2 = legacyV2ProjectSchema.parse({ ...legacy, schemaVersion: 2, theme: { accent: legacy.theme.accent, font: legacy.theme.font } });
    const before = structuredClone(v2);
    const current = readProject(v2);
    expect(v2).toEqual(before);
    expect(current).toEqual({ ...before, schemaVersion: 9, components: [], content: { services: [], portfolio: [], articles: [] }, theme: { ...before.theme, background: '#f9faf7', surface: '#e9eee7', ink: '#202824', muted: '#56605a', line: '#dce1d9' } });
    expect(readProject(JSON.parse(JSON.stringify(current)))).toEqual(current);
  });
  it('uses the frozen v2 contract instead of accepting newer nodes in a legacy backup', () => {
    const forged = { ...withNodes([section()]), schemaVersion: 2 };
    expect(() => readProject(forged)).toThrow();
    expect(() => readProject({ ...newProject(), schemaVersion: 999 })).toThrow();
  });
});

describe('controlled nested layout document', () => {
  it('round-trips containers, settings and primitive content in exact document order', () => {
    const project = projectSchema.parse(withNodes([section()]));
    expect(readProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
    expect(walkNodes(project.pages[0].nodes).map(node => node.id)).toEqual([
      'section', 'heading', 'columns', 'column-a', 'paragraph', 'button', 'column-b', 'image'
    ]);
    expect(allNodes(project).map(node => node.type)).toEqual([
      'Header', 'Section', 'Heading', 'Columns', 'Column', 'Paragraph', 'Button', 'Column', 'Image', 'Footer'
    ]);
    const settings = project.pages[0].nodes[0];
    expect(settings.type === 'Section' && settings.props.padding).toEqual({ mobile: 24, desktop: 64 });
    // Inheritance is represented by an omitted breakpoint, not a duplicated saved value.
    expect(settings.type === 'Section' && 'tablet' in settings.props.padding).toBe(false);
  });
  it('allows empty containers as temporary editor states', () => {
    const empty = section(); empty.children = [];
    expect(projectSchema.safeParse(withNodes([empty])).success).toBe(true);
    const columns = section().children[1];
    if (columns.type !== 'Columns') throw new Error('Test fixture is invalid.');
    columns.children = [];
    empty.children = [columns];
    expect(projectSchema.safeParse(withNodes([empty])).success).toBe(true);
  });
  it('rejects unsupported placement, recursive containers and cyclic input without a stack overflow', () => {
    const root = section(), columns = root.children[1];
    if (columns.type !== 'Columns') throw new Error('Test fixture is invalid.');
    const badNodes = [
      paragraph('root-paragraph'), // primitives require an enclosing section or column
      columns, // columns require a section
      { ...root, children: [root] },
      { ...root, children: [{ ...columns, children: [paragraph('not-a-column')] }] },
      { ...root, children: [{ ...columns, children: [{ ...columns.children[0], children: [columns] }] }] },
      { ...root, children: [{ ...newProject().pages[0].nodes[0] }] }
    ];
    for (const badNode of badNodes) expect(projectSchema.safeParse(withNodes([badNode])).success).toBe(false);
    const cyclic: Record<string, unknown> = { ...root };
    cyclic.children = [cyclic];
    expect(projectSchema.safeParse(withNodes([cyclic])).success).toBe(false);
  });
  it('enforces section, column and leaf limits and unique IDs at every nesting level', () => {
    const root = section(), columns = root.children[1];
    if (columns.type !== 'Columns') throw new Error('Test fixture is invalid.');
    const tooManySectionChildren = { ...root, children: Array.from({ length: 21 }, (_, i) => paragraph('leaf-' + i)) };
    expect(projectSchema.safeParse(withNodes([tooManySectionChildren])).success).toBe(false);
    const tooManyColumns = { ...root, children: [{ ...columns, children: Array.from({ length: 5 }, (_, i) => ({ ...columns.children[0], id: 'col-' + i, children: [] })) }] };
    expect(projectSchema.safeParse(withNodes([tooManyColumns])).success).toBe(false);
    const tooManyColumnChildren = { ...root, children: [{ ...columns, children: [{ ...columns.children[0], children: Array.from({ length: 21 }, (_, i) => paragraph('leaf-' + i)) }] }] };
    expect(projectSchema.safeParse(withNodes([tooManyColumnChildren])).success).toBe(false);
    const duplicates = section(); duplicates.children.push(paragraph('image'));
    expect(projectSchema.safeParse(withNodes([duplicates])).success).toBe(false);
    const repeatedContainer = section(); repeatedContainer.children.push(paragraph('column-a'));
    expect(projectSchema.safeParse(withNodes([repeatedContainer])).success).toBe(false);
  });
  it('bounds the whole project at 1,000 components including its two shared sections', () => {
    const nodes = Array.from({ length: 50 }, (_, sectionIndex) => ({
      ...section(), id: 'section-' + sectionIndex,
      children: Array.from({ length: sectionIndex < 48 ? 19 : 18 }, (_, leafIndex) => paragraph('leaf-' + sectionIndex + '-' + leafIndex))
    }));
    const atLimit = projectSchema.parse(withNodes(nodes));
    expect(allNodes(atLimit)).toHaveLength(1000);
    nodes[48].children.push(paragraph('one-too-many'));
    const result = projectSchema.safeParse(withNodes(nodes));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some(issue => issue.message.includes('1,000'))).toBe(true);
  });
  it('validates responsive units and named designs instead of arbitrary styles or code', () => {
    const valid = section();
    for (const padding of [{ mobile: -1 }, { mobile: 161 }, { mobile: 0.5 }, { desktop: 32 }, { mobile: 24, tablet: '24px' }]) {
      expect(definitions.Section.safeParse({ ...valid.props, padding }).success).toBe(false);
    }
    const columns = valid.children[1];
    if (columns.type !== 'Columns') throw new Error('Test fixture is invalid.');
    expect(definitions.Columns.safeParse({ ...columns.props, layout: { mobile: 'repeat(auto-fill, 100px)' } }).success).toBe(false);
    expect(definitions.Columns.safeParse({ ...columns.props, gap: { mobile: 97 } }).success).toBe(false);
    expect(definitions.Section.safeParse({ ...valid.props, style: { position: 'fixed' } }).success).toBe(false);
    const button = columns.children[0].children[1];
    if (button.type !== 'Button') throw new Error('Test fixture is invalid.');
    for (const override of [{ variant: 'unregistered' }, { motion: 'javascript:alert(1)' }, { shape: 'custom' }, { onClick: 'alert(1)' }, { target: { pageId: 'home', anchor: 'javascript:alert(1)' } }, { target: { pageId: 'https://example.com', anchor: '#top' } }]) {
      expect(definitions.Button.safeParse({ ...button.props, ...override }).success).toBe(false);
    }
    expect(definitions.Button.safeParse({ ...button.props, target: { pageId: 'deleted-page', anchor: '#top' } }).success).toBe(true);
  });
  it('accepts uploaded image data but rejects remote, executable and SVG source addresses', () => {
    const imageProps = { image: 'data:image/png;base64,iVBORw0KGgo=', alt: 'Studio', ratio: 'square', radius: 'none' };
    expect(definitions.Image.safeParse(imageProps).success).toBe(true);
    for (const image of ['https://builder.example/private/file', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=']) {
      expect(definitions.Image.safeParse({ ...imageProps, image }).success).toBe(false);
    }
  });
});
