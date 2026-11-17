import { createNode, DEFAULT_LAYOUT, DEFAULT_TEXT_STYLE, validateDoc } from './ops';
import type { FrameNode, Layout, SiteDoc, SiteNode, TextNode, TextStyle } from './schema';

/**
 * Original sample site ("Lumen Studio") used by the v2 render demo and tests.
 * Exercises auto layout, hug/fill sizing, grid, constraints, effects,
 * gradients and tablet/mobile overrides.
 */

type Tree = { node: SiteNode; children?: Tree[] };
const solid = (color: string) => [{ type: 'solid' as const, color, visible: true }];
const layout = (patch: Partial<Layout>): Layout => ({ ...DEFAULT_LAYOUT, ...patch });
const font = (patch: Partial<TextStyle>): TextStyle => ({ ...DEFAULT_TEXT_STYLE, ...patch });

function frame(id: string, name: string, patch: Partial<FrameNode>, children: Tree[] = []): Tree {
  return { node: createNode('frame', { id, name, clip: false, fills: [], ...patch }), children };
}
function text(id: string, value: string, patch: Partial<TextNode> = {}): Tree {
  return { node: createNode('text', { id, name: value.slice(0, 40), text: value, ...patch }) };
}

function flatten(tree: Tree, parentId: string | null, out: Record<string, SiteNode>): void {
  const children = tree.children ?? [];
  out[tree.node.id] = { ...tree.node, parentId, children: children.map(child => child.node.id) } as SiteNode;
  for (const child of children) flatten(child, tree.node.id, out);
}

function button(id: string, label: string, primary: boolean): Tree {
  return frame(id, label + ' button', {
    tag: 'div', layout: layout({ mode: 'horizontal', padding: [14, 28, 14, 28], alignMain: 'center', alignCross: 'center' }),
    sizing: { h: 'hug', v: 'hug' }, radius: [999, 999, 999, 999],
    fills: solid(primary ? '#1B1F24' : '#FFFFFF00'),
    stroke: primary ? null : { color: '#1B1F24', weight: 1.5, align: 'inside', style: 'solid' },
  }, [text(id + '-label', label, { fills: solid(primary ? '#FFFFFF' : '#1B1F24'), textStyle: font({ fontSize: 16, fontWeight: 600 }) })]);
}

function card(id: string, title: string, body: string, accent: string): Tree {
  return frame(id, title, {
    tag: 'article', layout: layout({ mode: 'vertical', gap: 12, padding: [32, 32, 32, 32] }),
    sizing: { h: 'fill', v: 'hug' }, radius: [20, 20, 20, 20], fills: solid('#FFFFFF'), clip: true,
    effects: [{ type: 'dropShadow', x: 0, y: 12, blur: 32, spread: -12, color: '#1B1F2422', visible: true }],
  }, [
    { node: createNode('rect', { id: id + '-dot', name: 'Accent', width: 40, height: 40, radius: [12, 12, 12, 12], fills: solid(accent) }) },
    text(id + '-title', title, { tag: 'h3', fills: solid('#1B1F24'), textStyle: font({ fontSize: 22, fontWeight: 700, lineHeight: 1.25 }), sizing: { h: 'fill', v: 'hug' } }),
    text(id + '-body', body, { fills: solid('#5A616B'), textStyle: font({ fontSize: 16, lineHeight: 1.6 }), sizing: { h: 'fill', v: 'hug' } }),
  ]);
}

export function lumenSample(): SiteDoc {
  const nav = frame('nav', 'Navigation', {
    tag: 'nav', layout: layout({ mode: 'horizontal', alignMain: 'spaceBetween', alignCross: 'center', padding: [24, 64, 24, 64] }),
    sizing: { h: 'fill', v: 'hug' },
    overrides: { mobile: { layout: { padding: [20, 24, 20, 24] } } },
  }, [
    text('logo', 'Lumen', { tag: 'span', fills: solid('#1B1F24'), textStyle: font({ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }) }),
    frame('links', 'Links', { layout: layout({ mode: 'horizontal', gap: 32, alignCross: 'center' }), sizing: { h: 'hug', v: 'hug' }, overrides: { mobile: { visible: false } } }, [
      text('link-work', 'Work', { tag: 'span', fills: solid('#1B1F24'), textStyle: font({ fontSize: 15, fontWeight: 500 }) }),
      text('link-studio', 'Studio', { tag: 'span', fills: solid('#1B1F24'), textStyle: font({ fontSize: 15, fontWeight: 500 }) }),
      text('link-contact', 'Contact', { tag: 'span', fills: solid('#1B1F24'), textStyle: font({ fontSize: 15, fontWeight: 500 }) }),
    ]),
  ]);

  const hero = frame('hero', 'Hero', {
    tag: 'section', layout: layout({ mode: 'vertical', gap: 24, alignCross: 'center', padding: [120, 64, 140, 64] }),
    sizing: { h: 'fill', v: 'hug' }, width: 1440, height: 640, clip: true,
    fills: [{ type: 'linear', angle: 160, stops: [{ offset: 0, color: '#F7F3EA' }, { offset: 1, color: '#E6EEF5' }], visible: true }],
    // Design-time widths per breakpoint: the glow's right-edge constraint is measured from them.
    overrides: { tablet: { width: 768, layout: { padding: [96, 40, 112, 40] } }, mobile: { width: 390, layout: { padding: [64, 24, 80, 24], gap: 20 } } },
  }, [
    { node: createNode('ellipse', {
      id: 'glow', name: 'Glow', absolute: true, x: 1040, y: -120, width: 520, height: 520, constraints: { h: 'right', v: 'top' },
      fills: [{ type: 'radial', stops: [{ offset: 0, color: '#FFB86BAA' }, { offset: 1, color: '#FFB86B00' }], visible: true }],
      effects: [{ type: 'layerBlur', radius: 24, visible: true }],
      overrides: { tablet: { x: 420, width: 420, height: 420 }, mobile: { x: 120, y: -160, width: 360, height: 360 } },
    }) },
    text('eyebrow', 'Independent design studio', { tag: 'span', fills: solid('#B4632A'), textStyle: font({ fontSize: 14, fontWeight: 700, letterSpacing: 2, transform: 'uppercase' }) }),
    text('headline', 'We design calm, fast websites that people remember.', {
      tag: 'h1', fills: solid('#1B1F24'), sizing: { h: 'fill', v: 'hug' }, maxWidth: 900,
      textStyle: font({ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, align: 'center' }),
      overrides: { tablet: { textStyle: { fontSize: 56 } }, mobile: { textStyle: { fontSize: 40, letterSpacing: -1 } } },
    }),
    text('lede', 'Strategy, identity and full-stack builds for small teams with big ideas.', {
      fills: solid('#5A616B'), sizing: { h: 'fill', v: 'hug' }, maxWidth: 620,
      textStyle: font({ fontSize: 20, lineHeight: 1.6, align: 'center' }),
      overrides: { mobile: { textStyle: { fontSize: 17 } } },
    }),
    frame('actions', 'Actions', { layout: layout({ mode: 'horizontal', gap: 16, alignCross: 'center', wrap: true, alignMain: 'center' }), sizing: { h: 'hug', v: 'hug' } }, [
      button('cta', 'Start a project', true),
      button('cta-secondary', 'See our work', false),
    ]),
  ]);

  const features = frame('features', 'Features', {
    tag: 'section', layout: layout({ mode: 'grid', gridColumns: 3, gap: 24, padding: [96, 64, 96, 64] }),
    sizing: { h: 'fill', v: 'hug' }, fills: solid('#F7F5F0'),
    overrides: { tablet: { layout: { gridColumns: 2, padding: [72, 40, 72, 40] } }, mobile: { layout: { gridColumns: 1, padding: [48, 24, 48, 24], gap: 16 } } },
  }, [
    card('card-1', 'Brand systems', 'Logos, type and color that hold together from business cards to product screens.', '#FFB86B'),
    card('card-2', 'Websites that ship', 'Designed in APL, exported as clean Next.js with your own Supabase backend.', '#7CC4A8'),
    card('card-3', 'Care after launch', 'Content updates, performance reviews and new pages whenever you need them.', '#8DA7F0'),
  ]);

  const footer = frame('footer', 'Footer', {
    tag: 'footer', layout: layout({ mode: 'horizontal', alignMain: 'spaceBetween', alignCross: 'center', padding: [40, 64, 40, 64], wrap: true, counterGap: 12 }),
    sizing: { h: 'fill', v: 'hug' }, fills: solid('#1B1F24'),
    overrides: { mobile: { layout: { mode: 'vertical', alignCross: 'start', gap: 8, padding: [32, 24, 32, 24] } } },
  }, [
    text('footer-brand', 'Lumen Studio', { tag: 'span', fills: solid('#FFFFFF'), textStyle: font({ fontSize: 18, fontWeight: 700 }) }),
    text('footer-note', '© 2026 Lumen Studio. Made with APL.', { tag: 'span', fills: solid('#FFFFFF99'), textStyle: font({ fontSize: 14 }) }),
  ]);

  const root = frame('home', 'Home', {
    tag: 'main', layout: layout({ mode: 'vertical' }), width: 1440, height: 1600, sizing: { h: 'fill', v: 'hug' }, fills: solid('#F7F5F0'),
  }, [nav, hero, features, footer]);

  const nodes: Record<string, SiteNode> = {};
  flatten(root, null, nodes);
  return validateDoc({
    version: 1, id: 'lumen-sample', name: 'Lumen Studio',
    pages: [{ id: 'page-home', name: 'Home', path: '/', rootId: 'home', title: 'Lumen Studio', description: 'An original APL sample site.' }],
    nodes, assets: {},
  });
}
