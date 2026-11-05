import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Render, type Slot } from '@puckeditor/core';
import { describe, expect, it } from 'vitest';
import { config, createConfig, fromEditor, toEditor, type EditorData } from '../src/editor/config';
import { DocumentHistory } from '../src/editor/history';
import { addPage } from '../src/project/pages';
import { newProject } from '../src/project/templates';
import { projectSchema, walkNodes, type Project } from '../src/project/schema';

// This view deliberately exposes the editor's serialized slot shape, rather than
// borrowing the canonical tree type: the adapter must move children in both directions.
type EditorNodeView = { type: string; props: Record<string, unknown> & { id: string; items?: EditorNodeView[] } };
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';

function fixture(): Project {
  const project = addPage(newProject(), 'About', '/about');
  project.pages[0].nodes.push({
    id: 'editor-section', type: 'Section', props: { width: 'wide', tone: 'soft', padding: { mobile: 24, tablet: 48, desktop: 80 } },
    children: [
      { id: 'editor-heading', type: 'Heading', props: { text: 'Built around your story', level: 'h2', size: 'large', align: 'left' } },
      {
        id: 'editor-columns', type: 'Columns', props: { layout: { mobile: 'stack', tablet: 'halves', desktop: 'two-one' }, gap: { mobile: 16, desktop: 32 }, align: 'center' },
        children: [
          {
            id: 'editor-column-copy', type: 'Column', props: { gap: { mobile: 12, tablet: 20 }, align: 'start' },
            children: [
              { id: 'editor-paragraph', type: 'Paragraph', props: { text: 'Thoughtful spaces for meaningful work.', align: 'left' } },
              { id: 'editor-button', type: 'Button', props: { label: 'Meet our team', target: { pageId: project.pages[1].id, anchor: '#top' }, variant: 'outline', shape: 'pill', motion: 'lift' } }
            ]
          },
          {
            id: 'editor-column-photo', type: 'Column', props: { gap: { mobile: 8 }, align: 'center' },
            children: [{ id: 'editor-image', type: 'Image', props: { image: photo, alt: 'A quiet studio workspace', ratio: 'portrait', radius: 'soft' } }]
          }
        ]
      }
    ]
  });
  return projectSchema.parse(project);
}

function body(data: EditorData): EditorNodeView[] {
  return data.root.props!.body as unknown as EditorNodeView[];
}

function find(data: EditorData, id: string): EditorNodeView {
  const visit = (nodes: EditorNodeView[]): EditorNodeView | undefined => {
    for (const node of nodes) {
      if (node.props.id === id) return node;
      const child = visit(['Section', 'Columns', 'Column'].includes(node.type) ? node.props.items ?? [] : []);
      if (child) return child;
    }
  };
  const node = visit(body(data));
  if (!node) throw new Error(`Editor fixture node ${id} is missing.`);
  return node;
}

describe('nested layout editor adapter', () => {
  it('targets imported custom homepage IDs in direct and nested starter buttons without mutating defaults', () => {
    const project = addPage(newProject(), 'About', '/about');
    project.pages[0].id = 'custom-home';
    project.shared.header.props.target.pageId = 'custom-home';
    projectSchema.parse(project);
    const originalProject = structuredClone(project);
    const originalDefaults = {
      Button: structuredClone(config.components.Button.defaultProps),
      Section: structuredClone(config.components.Section.defaultProps),
      Columns: structuredClone(config.components.Columns.defaultProps)
    };
    // Additions on a different active page should still resolve the real homepage.
    const scoped = createConfig(project, project.pages[1].id);
    const expectedTarget = { pageId: 'custom-home', anchor: '#top' };
    expect(scoped.components.Button.defaultProps!.target).toEqual(expectedTarget);
    const buttonTargets = (items: Slot): unknown[] => items.flatMap(node => {
      if (node.type === 'Button') return [node.props.target];
      return ['Section', 'Columns', 'Column'].includes(node.type) ? buttonTargets(node.props.items) : [];
    });
    for (const type of ['Section', 'Columns'] as const) {
      const targets = buttonTargets(scoped.components[type].defaultProps!.items);
      expect(targets.length).toBeGreaterThan(0);
      for (const target of targets) expect(target).toEqual(expectedTarget);
    }
    expect(config.components.Button.defaultProps).toEqual(originalDefaults.Button);
    expect(config.components.Section.defaultProps).toEqual(originalDefaults.Section);
    expect(config.components.Columns.defaultProps).toEqual(originalDefaults.Columns);
    expect(project).toEqual(originalProject);
  });

  it('round-trips every nested ID, property and child order without mutating the project', () => {
    const project = fixture(), original = structuredClone(project);
    const data = toEditor(project);
    expect(data.content).toEqual([]);
    expect(body(data).map(node => node.props.id)).toEqual(project.pages[0].nodes.map(node => node.id));
    expect(find(data, 'editor-section').props.items!.map(node => node.props.id)).toEqual(['editor-heading', 'editor-columns']);
    expect(find(data, 'editor-columns').props.items!.map(node => node.props.id)).toEqual(['editor-column-copy', 'editor-column-photo']);
    expect(find(data, 'editor-column-copy').props.items!.map(node => node.props.id)).toEqual(['editor-paragraph', 'editor-button']);
    expect(find(data, 'editor-heading').props).not.toHaveProperty('items');

    const restored = fromEditor(data, project);
    expect({ ...restored, updatedAt: project.updatedAt }).toEqual(project);
    expect(walkNodes(restored.pages[0].nodes).map(node => node.id)).toEqual(walkNodes(project.pages[0].nodes).map(node => node.id));
    expect(project).toEqual(original);
  });

  it('applies nested leaf and breakpoint edits only to the active page', () => {
    const project = fixture(), original = structuredClone(project), data = toEditor(project);
    find(data, 'editor-paragraph').props.text = 'A new story, on this page only.';
    find(data, 'editor-columns').props.layout = { mobile: 'stack', tablet: 'one-two', desktop: 'three-one' };
    find(data, 'editor-section').props.padding = { mobile: 16, tablet: 40, desktop: 96 };
    const changed = fromEditor(data, project);
    const nodes = walkNodes(changed.pages[0].nodes);
    expect(nodes.find(node => node.id === 'editor-paragraph')!.props).toHaveProperty('text', 'A new story, on this page only.');
    expect(nodes.find(node => node.id === 'editor-columns')!.props).toHaveProperty('layout', { mobile: 'stack', tablet: 'one-two', desktop: 'three-one' });
    expect(nodes.find(node => node.id === 'editor-section')!.props).toHaveProperty('padding', { mobile: 16, tablet: 40, desktop: 96 });
    expect(changed.pages[1]).toEqual(original.pages[1]);
    expect(changed.shared).toEqual(original.shared);
    expect(changed.theme).toEqual(original.theme);
    expect(project).toEqual(original);
  });

  it('preserves authored appearance, external actions, anchors and page chrome through editor edits', () => {
    const project = fixture();
    project.pages[0].showHeader = false; project.pages[0].showFooter = false;
    const data = toEditor(project);
    find(data, 'editor-section').props.anchor = '#c-our-story';
    find(data, 'editor-heading').props.level = 'h1';
    find(data, 'editor-heading').props.appearance = { fontSize: { mobile: 32.123456789, desktop: 64 }, color: { mobile: '#123456' } };
    find(data, 'editor-button').props.destination = { kind: 'url', value: 'https://example.com/work' };
    const changed = fromEditor(data, project);
    expect(changed.pages[0]).toMatchObject({ showHeader: false, showFooter: false });
    expect(changed.pages[1]).toEqual(project.pages[1]);
    expect(changed.shared).toEqual(project.shared);
    const restored = fromEditor(toEditor(changed), changed);
    expect({ ...restored, updatedAt: changed.updatedAt }).toEqual(changed);
    const markup = renderToStaticMarkup(createElement(Render, { config: createConfig(changed, changed.pages[0].id, false), data: toEditor(changed) }));
    expect(markup).toContain('id="c-our-story"');
    expect(markup).toMatch(/<h1\b/);
    expect(markup).toContain('--apl-authored-font-size-mobile:32.123456789px');
    expect(markup).toContain('href="https://example.com/work"');
    expect(markup).toContain('target="_blank" rel="noopener noreferrer"');
    expect(markup).not.toContain('class="site-header');
    expect(markup).not.toContain('class="site-footer');
  });

  it('keeps immutable deep history for typing, layout changes, undo and redo', () => {
    const project = fixture(), initial = toEditor(project), original = structuredClone(initial);
    const history = new DocumentHistory(initial);
    const edit = history.current;
    find(edit, 'editor-paragraph').props.text = 'New'; history.record(edit, 1000);
    find(edit, 'editor-paragraph').props.text = 'New words'; history.record(edit, 1100);
    const typed = structuredClone(edit);
    find(edit, 'editor-columns').props.layout = { mobile: 'stack', desktop: 'quarters' }; history.record(edit, 1200);
    const rearranged = structuredClone(edit);
    find(edit, 'editor-paragraph').props.text = 'External mutation must not enter history';
    find(initial, 'editor-columns').props.items!.reverse();

    expect(history.move(-1)).toEqual(typed);
    expect(history.move(-1)).toEqual(original);
    expect(history.move(1)).toEqual(typed);
    expect(history.move(1)).toEqual(rearranged);
    expect(fromEditor(history.current, project).pages[0].nodes).toEqual(fromEditor(rearranged, project).pages[0].nodes);
  });

  it('rejects unknown nested components and leaf components at the root', () => {
    const project = fixture(), unknown = toEditor(project), wrongRoot = toEditor(project);
    find(unknown, 'editor-column-copy').props.items!.push({ type: 'Script', props: { id: 'unknown-script', code: 'alert(1)' } });
    body(wrongRoot).push(structuredClone(find(wrongRoot, 'editor-heading')));
    // Give the misplaced leaf a fresh ID so failure must include the nesting rule.
    body(wrongRoot).at(-1)!.props.id = 'root-heading';
    expect(() => fromEditor(unknown, project)).toThrow();
    expect(() => fromEditor(wrongRoot, project)).toThrow();
  });

  it('rejects containers inside columns and duplicate IDs hidden deep in a slot', () => {
    const project = fixture(), wrongParent = toEditor(project), duplicate = toEditor(project);
    const nestedSection = structuredClone(find(wrongParent, 'editor-section'));
    nestedSection.props.id = 'illegal-nested-section'; nestedSection.props.items = [];
    find(wrongParent, 'editor-column-copy').props.items!.push(nestedSection);
    find(duplicate, 'editor-image').props.id = 'editor-paragraph';
    expect(() => fromEditor(wrongParent, project)).toThrow();
    expect(() => fromEditor(duplicate, project)).toThrow();
  });

  it('renders nested content and button destinations through the real preview configuration', () => {
    const project = fixture();
    const markup = renderToStaticMarkup(createElement(Render, { config: createConfig(project, project.pages[0].id, false), data: toEditor(project) }));
    expect(markup).toMatch(/<h2\b[^>]*>Built around your story<\/h2>/);
    expect(markup).toContain('Thoughtful spaces for meaningful work.');
    expect(markup).toMatch(/<a\b[^>]*href="\/about"[^>]*>\s*<span>Meet our team<\/span>/);
    expect(markup).toContain('data-design="outline"');
    expect(markup).toContain('data-shape="pill"');
    expect(markup).toContain('data-motion="lift"');
    expect(markup).toContain('alt="A quiet studio workspace"');
    expect(markup).toContain(`src="${photo}"`);
    expect(markup).toContain('data-ratio="portrait"');
    expect(markup).toContain('data-radius="soft"');
    expect(markup).toContain('data-layout-node="editor-columns"');
    expect(markup).not.toContain('[object Object]');
  });
});
