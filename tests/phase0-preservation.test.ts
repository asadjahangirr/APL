import { describe, expect, it } from 'vitest';
import { newProject } from '../src/project/templates';
import { readProject } from '../src/project/migrate';
import { fromEditor, toEditor } from '../src/editor/config';
import legacy from './fixtures/project-v4.json';
describe('phase-0 preservation of authored website documents', () => {
  it('reopens a frozen v4 backup without rewriting authored pages, links, theme or publication state', () => {
    const p = readProject(legacy);
    expect(p.schemaVersion).toBe(9);
    expect(p.components).toEqual([]);
    const homepage = p.pages.find(page => page.path === '/')!;
    p.theme = { ...newProject().theme, accent: '#665544', font: 'serif' };
    p.pages.push({ ...structuredClone(homepage), id: 'hidden-story', name: 'Private route', path: '/story', inNavigation: false, nodes: [] });
    const original = structuredClone(p);
    const reopened = readProject(JSON.parse(JSON.stringify(p)));
    expect(reopened).toEqual(original);
    expect(p).toEqual(original);
    expect(fromEditor(toEditor(reopened, homepage.id), reopened, homepage.id).pages).toEqual(original.pages);
    expect(reopened.content).toEqual(original.content);
  });
  it('rejects unknown future formats without changing the original project', () => {
    const p = newProject(), original = structuredClone(p);
    expect(() => readProject({ ...p, schemaVersion: 900, design: { artboards: [] } })).toThrow();
    expect(p).toEqual(original);
  });
});
