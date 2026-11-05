import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { responsiveAppearanceSchema } from '../src/project/appearance-schema';
import { projectSchema as frozenV7Schema } from '../src/project/legacy-v7-schema';
import { readWebsiteProject } from '../src/project/legacy-migrate';
import { buttonDestinationSchema, definitions, projectSchema, type ComponentProps } from '../src/project/schema';
import { addPage, buttonHref, editPage, pageAnchors, targetHref } from '../src/project/pages';
import { newProject } from '../src/project/templates';
import Section from '../src/site/Section';
import Columns from '../src/site/Columns';
import Column from '../src/site/Column';
import Heading from '../src/site/Heading';
import Paragraph from '../src/site/Paragraph';
import Image from '../src/site/Image';
import Button from '../src/site/Button';
import Contact from '../src/site/Contact';
import { appearanceStyle } from '../src/site/authored-style';
import { changeAppearanceValue } from '../src/editor/AppearanceField';

const button: ComponentProps['Button'] = {
  label: 'Visit our partner', target: { pageId: 'removed-page', anchor: '#top' },
  variant: 'solid', shape: 'rounded', motion: 'none',
};
const section: ComponentProps['Section'] = { padding: { mobile: 24 }, width: 'content', tone: 'plain' };

describe('authored Website contract and frozen migration', () => {
  it('migrates v7 without adding appearance or chrome settings and never mutates its input', () => {
    const { components: _components, ...historical } = addPage(newProject(), 'About', '/about');
    const old = frozenV7Schema.parse({ ...historical, schemaVersion: 7 });
    const before = structuredClone(old), migrated = readWebsiteProject(old);
    expect(old).toEqual(before);
    expect(migrated).toEqual({ ...before, schemaVersion: 9, components: [] });
    expect(migrated.pages.every(page => !('showHeader' in page) && !('showFooter' in page))).toBe(true);
    expect(readWebsiteProject(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
  });

  it('rejects forged authored fields and H1 in a v7 backup before migration', () => {
    const old = { ...newProject(), schemaVersion: 7 };
    const heading = { id: 'authored-heading', type: 'Heading', props: { text: 'Our story', level: 'h1', size: 'large', align: 'left' } };
    const nodes = [{ id: 'authored-section', type: 'Section', props: section, children: [heading] }];
    expect(() => readWebsiteProject({ ...old, pages: [{ ...old.pages[0], nodes }] })).toThrow();
    expect(() => readWebsiteProject({ ...old, pages: [{ ...old.pages[0], showHeader: false }] })).toThrow();
    expect(() => readWebsiteProject({ ...old, pages: [{ ...old.pages[0], nodes: [{
      id: 'authored-section', type: 'Section', props: { ...section, appearance: { color: { mobile: '#123456' } } }, children: [],
    }] }] })).toThrow();
  });

  it('bounds authored units on every breakpoint and rejects arbitrary CSS and unsafe colors', () => {
    const valid = { fontSize: { mobile: 32, desktop: 64 }, fontWeight: { mobile: 700 }, color: { mobile: '#10203080' }, background: { mobile: 'transparent' } };
    expect(responsiveAppearanceSchema.parse(valid)).toEqual(valid);
    for (const invalid of [
      { fontSize: { desktop: 32 } }, { fontSize: { mobile: 32, tablet: 1001 } },
      { fontSize: { mobile: Number.NaN } }, { fontWeight: { mobile: 550 } },
      { fontFamily: { mobile: 'remote-font' } }, { color: { mobile: 'url(https://example.com)' } },
      { paddingX: { mobile: -1 } }, { aspectRatio: { mobile: 0 } },
      { position: { mobile: 'fixed' } }, { fontSize: { mobile: 32, hover: 40 } },
    ]) expect(responsiveAppearanceSchema.safeParse(invalid).success).toBe(false);
    expect(definitions.Heading.parse({ text: 'Our studio', level: 'h1', size: 'large', align: 'left', appearance: valid }).level).toBe('h1');
  });

  it('keeps page chrome choices isolated and rejects duplicate generated section anchors', () => {
    const project = addPage(newProject(), 'Converted', '/converted'), originalPage = structuredClone(project.pages[0]);
    project.pages[1].showHeader = false; project.pages[1].showFooter = false;
    project.pages[1].nodes = [{ id: 'converted-section', type: 'Section', props: { ...section, anchor: '#c-our-story' }, children: [] }];
    const saved = projectSchema.parse(project);
    expect(saved.pages[0]).toEqual(originalPage);
    expect(saved.pages[1]).toMatchObject({ showHeader: false, showFooter: false });
    saved.pages[1].nodes.push({ id: 'different-section', type: 'Section', props: { ...section, anchor: '#c-our-story' }, children: [] });
    expect(projectSchema.safeParse(saved).success).toBe(false);
    expect(definitions.Section.safeParse({ ...section, anchor: '#contact' }).success).toBe(false);
  });
});

describe('authored links', () => {
  it('keeps generated section links stable after a page rename and detects removed destinations', () => {
    let project = addPage(newProject(), 'Converted', '/converted');
    const pageId = project.pages[1].id;
    project.pages[1].nodes = [{ id: 'converted-section', type: 'Section', props: { ...section, anchor: '#c-our-story' }, children: [] }];
    const target = { pageId, anchor: '#c-our-story' };
    expect(pageAnchors(project.pages[1])).toContain(target.anchor);
    expect(targetHref(project, target)).toBe('/converted#c-our-story');
    project = editPage(project, pageId, { name: 'Our story', path: '/our-story', inNavigation: true });
    expect(targetHref(project, target)).toBe('/our-story#c-our-story');
    project.pages[1].nodes = [];
    expect(targetHref(project, target)).toBeNull();
  });

  it('resolves URL, email and phone destinations even when their unused legacy target is absent', () => {
    const project = newProject();
    expect(buttonHref(project, button)).toBeNull();
    expect(buttonHref(project, { ...button, destination: { kind: 'url', value: 'https://example.com/work?filter=brand#latest' } })).toBe('https://example.com/work?filter=brand#latest');
    expect(buttonHref(project, { ...button, destination: { kind: 'email', value: 'hello+studio@example.com' } })).toBe('mailto:hello+studio@example.com');
    expect(buttonHref(project, { ...button, destination: { kind: 'phone', value: '+92 (300) 123-4567' } })).toBe('tel:+923001234567');
  });

  it('rejects executable protocols, credentials, control characters and mail/phone header injection', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,test', '//example.com', 'https://user:secret@example.com', 'https://example.com\n', 'https://example.com\\evil']) {
      expect(buttonDestinationSchema.safeParse({ kind: 'url', value }).success).toBe(false);
    }
    for (const value of ['hello@example.com?subject=Injected', 'hello@example.com\r\nBcc:evil@example.com']) {
      expect(buttonDestinationSchema.safeParse({ kind: 'email', value }).success).toBe(false);
    }
    for (const value of ['+123?call=now', '+123;ext=4', '+123\r\nInjected', '+12']) {
      expect(buttonDestinationSchema.safeParse({ kind: 'phone', value }).success).toBe(false);
    }
  });
});

describe('semantic authored rendering', () => {
  it('edits one breakpoint while preserving other fields, then removes overrides deliberately', () => {
    const original = { fontSize: { mobile: 32.123456789, tablet: 40, desktop: 64 }, color: { mobile: '#123456' } };
    const changed = changeAppearanceValue(original, 'fontSize', 'desktop', 72)!;
    expect(changed).toEqual({ ...original, fontSize: { mobile: 32.123456789, tablet: 40, desktop: 72 } });
    expect(original.fontSize.desktop).toBe(64);
    const inherited = changeAppearanceValue(changed, 'fontSize', 'desktop', undefined)!;
    expect(inherited.fontSize).toEqual({ mobile: 32.123456789, tablet: 40 });
    expect(changeAppearanceValue(inherited, 'fontSize', 'mobile', undefined)).toEqual({ color: original.color });
    expect(() => changeAppearanceValue(undefined, 'fontSize', 'desktop', 48)).toThrow();
  });
  it('renders real escaped H1/text, accessible images and safe external actions with responsive style values', () => {
    const markup = renderToStaticMarkup(createElement(Section, {
      id: 'section', ...section, anchor: '#c-our-story', appearance: { paddingX: { mobile: 20, desktop: 64 }, maxWidth: { mobile: 600, desktop: 1200 }, gap: { mobile: 16 } },
    },
    createElement(Heading, { id: 'heading', text: '<script>Our words</script>', level: 'h1', size: 'large', align: 'left', appearance: { fontSize: { mobile: 32, tablet: 44 }, color: { mobile: '#203040' } } }),
    createElement(Paragraph, { id: 'paragraph', text: 'A real paragraph.', align: 'left' }),
    createElement(Image, { id: 'image', image: 'data:image/png;base64,iVBORw0KGgo=', alt: 'Our studio at sunrise', ratio: 'landscape', radius: 'soft', appearance: { aspectRatio: { mobile: 1.5, desktop: 2 }, radius: { mobile: 18 } } }),
    createElement(Button, { id: 'button', ...button, href: 'https://example.com', destination: { kind: 'url', value: 'https://example.com' }, appearance: { minHeight: { mobile: 48 } } })));
    expect(markup).toContain('id="c-our-story"');
    expect(markup).toMatch(/<h1\b[^>]*>&lt;script&gt;Our words&lt;\/script&gt;<\/h1>/);
    expect(markup).toContain('<p data-layout-node="paragraph"');
    expect(markup).toContain('alt="Our studio at sunrise"');
    expect(markup).toContain('--apl-authored-font-size-desktop:44px');
    expect(markup).toContain('--apl-authored-aspect-ratio-desktop:2');
    expect(markup).toContain('target="_blank" rel="noopener noreferrer"');
    expect(markup).not.toContain('<script>');
  });

  it('overrides authored grid/content spacing while preserving existing preset tracks and alignment', () => {
    const markup = renderToStaticMarkup(createElement(Columns, {
      id: 'columns', layout: { mobile: 'stack', desktop: 'one-two' }, gap: { mobile: 16 }, align: 'stretch',
      appearance: { gap: { mobile: 24, desktop: 48 }, minHeight: { mobile: 200 } },
    }, createElement(Column, {
      id: 'column', gap: { mobile: 8 }, align: 'center',
      appearance: { paddingY: { mobile: 12 }, background: { mobile: '#eeeeee' } },
    }, createElement(Paragraph, { id: 'paragraph', text: 'Column content', align: 'left' }))));
    expect(markup).toContain('--tracks-desktop:minmax(0,1fr) minmax(0,2fr)');
    expect(markup).toContain('gap:var(--apl-authored-gap)');
    expect(markup).toContain('align-items:stretch');
    expect(markup).toContain('justify-content:center');
    expect(markup).toContain('background-color:var(--apl-authored-background)');
    expect(markup).toContain('Column content');
  });

  it('preserves preset rendering when appearance is absent and keeps email actions in the current context', () => {
    expect(appearanceStyle()).toEqual({});
    expect(appearanceStyle({ color: { mobile: '#123456' } })).not.toHaveProperty('letterSpacing');
    expect(appearanceStyle({ fontSize: { mobile: 32 } })).toHaveProperty('letterSpacing', 'normal');
    expect(appearanceStyle({ fontSize: { mobile: 32 } }, ['color'])).not.toHaveProperty('letterSpacing');
    const markup = renderToStaticMarkup(createElement(Button, {
      id: 'mail', ...button, href: 'mailto:hello@example.com', destination: { kind: 'email', value: 'hello@example.com' },
    }));
    expect(markup).toContain('class="apl-link-button"');
    expect(markup).not.toContain('apl-authored');
    expect(markup).not.toContain('target=');
    expect(markup).not.toContain('style=');
  });

  it('styles contact fields and submit controls without changing labels, constraints or sample behavior', () => {
    const markup = renderToStaticMarkup(createElement(Contact, {
      title: 'Start a\nconversation', description: 'Tell us\nyour idea.', button: 'Send your message', preview: true,
      appearance: { fontFamily: { mobile: 'Arial' }, background: { mobile: '#f7f4ee' }, gap: { mobile: 32 } },
      buttonAppearance: { background: { mobile: '#264f40' }, minHeight: { mobile: 48 } },
      fieldAppearance: { radius: { mobile: 8 }, borderWidth: { mobile: 2 } },
    }));
    expect(markup).toContain('Your name<input');
    expect(markup).toMatch(/<input\b(?=[^>]*\bname="email")(?=[^>]*\btype="email")[^>]*>/);
    expect(markup).toContain('minLength="10" maxLength="4000"');
    expect(markup).toContain('no messages sent');
    expect(markup).toMatch(/<input\b(?=[^>]*\bname="website")(?=[^>]*\btabindex="-1")[^>]*>/);
    expect(markup).toContain('--apl-authored-border-width-mobile:2px');
    expect(markup).toContain('white-space:pre-line');
    expect(markup).toContain('letter-spacing:normal');
    expect(markup).toContain('Send your message');
  });
});
