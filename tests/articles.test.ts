import { describe, expect, it } from 'vitest';
import { newProject } from '../src/project/templates';
import { readProject } from '../src/project/migrate';
import { projectSchema } from '../src/project/schema';
import { addArticleCollection, createArticle, mutateArticle, publicArticles } from '../src/project/articles';
import { emptyArticle } from '../src/project/article-schema';
import { projectSchema as legacyV6ProjectSchema } from '../src/project/legacy-v6-schema';
import { fromEditor, toEditor } from '../src/editor/config';

describe('Articles draft and publication workflow', () => {
  it('upgrades a real v6 document without changing its authored content', () => {
    const project = newProject();
    const { articles: _articles, ...content } = project.content;
    const { components: _components, ...historical } = project;
    const old = legacyV6ProjectSchema.parse({ ...historical, schemaVersion: 6, content });
    const before = structuredClone(old);
    const upgraded = readProject(old);
    expect(old).toEqual(before);
    expect(upgraded.schemaVersion).toBe(9);
    expect(upgraded.components).toEqual([]);
    expect(upgraded.content).toEqual({ ...content, articles: [] });
    expect(upgraded.pages).toEqual(project.pages);
  });

  it('keeps saved edits private until publication and rejects stale edits', () => {
    const created = createArticle(newProject());
    const payload = { ...emptyArticle(), title: 'A good idea', slug: 'good-idea', body: 'First edition.' };
    let project = mutateArticle(created.project, created.id, 'save', 1, payload);
    expect(publicArticles(project)).toEqual([]);
    project = mutateArticle(project, created.id, 'publish', 2);
    project = mutateArticle(project, created.id, 'save', 3, { ...payload, title: 'Private rewrite' });
    expect(publicArticles(project)[0].title).toBe('A good idea');
    expect(() => mutateArticle(project, created.id, 'publish', 3)).toThrow(/changed/);
    project = mutateArticle(project, created.id, 'publish', 4);
    expect(publicArticles(project)[0].title).toBe('Private rewrite');
    project = mutateArticle(project, created.id, 'unpublish', 5);
    expect(publicArticles(project)).toEqual([]);
    expect(project.content.articles[0].draft.title).toBe('Private rewrite');
  });

  it('reserves article URLs only when selected and retains records through visual edits', () => {
    const created = createArticle(newProject());
    let project = addArticleCollection(created.project, 'home');
    project = mutateArticle(project, created.id, 'save', 1, { ...emptyArticle(), title: 'Kept draft' });
    expect(fromEditor(toEditor(project), project).content).toEqual(project.content);
    expect(() => projectSchema.parse({ ...project, pages: [...project.pages, { ...project.pages[0], id: 'new-page', path: '/articles', nodes: [] }] })).toThrow(/articles/);
    const withoutCollection = { ...project, pages: project.pages.map(page => ({ ...page, nodes: page.nodes.filter(node => node.type !== 'ArticleCollection') })) };
    expect(projectSchema.safeParse(withoutCollection).success).toBe(true);
  });

  it('rejects duplicate public slugs and unsafe extra settings', () => {
    const first = createArticle(newProject());
    expect(() => mutateArticle(first.project, first.id, 'publish', 1)).toThrow();
    let project = mutateArticle(first.project, first.id, 'save', 1, { ...emptyArticle(), title: 'First', slug: 'shared' });
    project = mutateArticle(project, first.id, 'publish', 2);
    const second = createArticle(project);
    project = mutateArticle(second.project, second.id, 'save', 1, { ...emptyArticle(), title: 'Second', slug: 'shared' });
    expect(() => mutateArticle(project, second.id, 'publish', 2)).toThrow(/unique/);
    expect(projectSchema.safeParse({ ...project, pages: project.pages.map(page => ({ ...page, nodes: [...page.nodes, { id: 'bad', type: 'ArticleCollection', props: { ...project.pages[0].nodes[0].props, onClick: 'alert(1)' } }] })) }).success).toBe(false);
  });
});
