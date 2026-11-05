import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPhase4Website } from '../src/studio/phase4-templates';
import { publicPortfolio } from '../src/project/portfolio';
import { projectSchema } from '../src/project/schema';
import PortfolioCollection from '../src/site/PortfolioCollection';

describe('portfolio case-study destinations', () => {
  it('renders the sample portfolio cards as same-site routes and keeps external links in new tabs', () => {
    const project = createPhase4Website('mira');
    const items = publicPortfolio(project);
    expect(items.map(item => item.href).sort()).toEqual(['/work/lumen-press', '/work/tide-atlas']);
    const markup = renderToStaticMarkup(createElement(PortfolioCollection, {
      title: 'Work', description: '', mobile: 1, tablet: 2, desktop: 2, gap: 24, items,
    }));
    expect(markup).toContain('href="/work/lumen-press"');
    expect(markup).toContain('href="/work/tide-atlas"');
    expect(markup).not.toContain('target="_blank"');

    const external = renderToStaticMarkup(createElement(PortfolioCollection, {
      title: 'Work', description: '', mobile: 1, gap: 24,
      items: [{ id: 'external', title: 'Project', summary: '', externalUrl: 'https://example.com/work' }],
    }));
    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noopener noreferrer"');
  });

  it('rejects a portfolio destination when its case-study page is missing', () => {
    const project = createPhase4Website('mira');
    project.pages = project.pages.filter(page => page.id !== 'lumen-press');
    expect(projectSchema.safeParse(project).success).toBe(false);
  });
});
