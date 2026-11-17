import { alpha, drop, lin, type F, type Kit, type Tree, type X, HASH } from '../kit';
import { define, type LibraryItem } from '../types';

/** Button styles: gradient, glow, glass, neo-brutalist, 3D, shimmer, pulse and more. */

const label = (k: Kit, text: string, color: string, o: X = {}) => k.txt(text, { size: 15, weight: 600, color, lh: 1.2, tag: 'span', ...o });
const base = (k: Kit, name: string, o: F, kids: Tree[]) => k.row({ name: name + ' button', pad: [14, 24], r: k.t.br, main: 'center', cross: 'center', gap: 10, ...o }, kids);
const set = (k: Kit, name: string, kids: Tree[], o: F = {}) => k.row({ name, gap: 16, rgap: 16, wrap: true, cross: 'center', main: 'center', maxW: 480, ...o }, kids);
/** Text that reads well on the theme's primary / accent colors. */
const onAccent = (k: Kit) => (k.t.dark ? k.t.bg : '#FFFFFF');

export const BUTTONS: LibraryItem[] = [
  define('button', 'btn-gradient', 'Gradient buttons', 'colorful cta modern', k => set(k, 'Gradient buttons', [
    base(k, 'Gradient', { bg: lin(100, k.t.primary, k.t.accent), motion: { hover: { type: 'lift' } } }, [label(k, 'Get started', k.t.onPrimary)]),
    base(k, 'Gradient pill', { r: 999, bg: lin(100, k.t.accent, k.t.imgs[1][1]), motion: { hover: { type: 'grow' } } }, [label(k, 'Try it free', onAccent(k)), label(k, '→', onAccent(k))]),
  ])),
  define('button', 'btn-glow', 'Glow buttons', 'shadow neon colorful cta', k => set(k, 'Glow buttons', [
    base(k, 'Glow', { bg: k.t.primary, fx: [drop(0, 10, 28, alpha(k.t.primary, '8C'), -4)], motion: { hover: { type: 'lift' } } }, [label(k, 'Launch now', k.t.onPrimary)]),
    base(k, 'Accent glow', { r: 999, bg: k.t.accent, fx: [drop(0, 0, 0, alpha(k.t.accent, '40'), 6), drop(0, 12, 32, alpha(k.t.accent, '80'), -6)], motion: { hover: { type: 'grow' } } }, [label(k, 'Upgrade', onAccent(k))]),
  ])),
  define('button', 'btn-brutal', 'Neo-brutalist buttons', 'hard shadow bold retro offset', k => set(k, 'Brutalist buttons', [
    base(k, 'Brutal', { r: Math.min(k.t.br, 8), bg: k.t.accent, line: k.t.text, fx: [drop(5, 5, 0, k.t.text)], motion: { hover: { type: 'press' } } }, [label(k, 'Click me', onAccent(k), { weight: 700 })]),
    base(k, 'Brutal light', { r: Math.min(k.t.br, 8), bg: k.t.surface, line: k.t.text, fx: [drop(5, 5, 0, k.t.accent)], motion: { hover: { type: 'press' } } }, [label(k, 'Learn more', k.t.text, { weight: 700 })]),
  ])),
  define('button', 'btn-3d', '3D push buttons', 'depth press tactile game', k => set(k, '3D buttons', [
    base(k, '3D', { bg: k.t.primary, fx: [drop(0, 6, 0, alpha(k.t.text, k.t.dark ? '40' : '66'))], motion: { hover: { type: 'press' } } }, [label(k, 'Press me', k.t.onPrimary, { weight: 700 })]),
    base(k, '3D accent', { r: 999, bg: k.t.accent, fx: [drop(0, 6, 0, alpha(k.t.text, k.t.dark ? '40' : '59'))], motion: { hover: { type: 'press' } } }, [label(k, 'Play', onAccent(k), { weight: 700 }), label(k, '▶', onAccent(k), { size: 12 })]),
  ])),
  define('button', 'btn-glass', 'Glass buttons', 'glassmorphism blur frosted translucent', k => k.row({ name: 'Glass buttons', pad: [36, 40], gap: 16, r: k.t.r, bg: lin(120, ...k.t.imgs[0], k.t.imgs[1][1]), cross: 'center' }, [
    base(k, 'Glass', { r: 999, bg: '#FFFFFF33', line: '#FFFFFF80', blur: 14, motion: { hover: { type: 'brighten' } } }, [label(k, 'Explore', '#FFFFFF')]),
    base(k, 'Glass dark', { r: 999, bg: '#0000002E', line: '#FFFFFF4D', blur: 14, motion: { hover: { type: 'lift' } } }, [label(k, 'Watch demo', '#FFFFFF'), label(k, '▶', '#FFFFFF', { size: 11 })]),
  ])),
  define('button', 'btn-arrow', 'Arrow pill buttons', 'icon circle trailing cta', k => set(k, 'Arrow buttons', [
    base(k, 'Arrow', { r: 999, pad: [8, 8, 8, 24], gap: 14, bg: k.t.primary, motion: { hover: { type: 'pushRight' } } }, [label(k, 'Start a project', k.t.onPrimary), k.row({ name: 'Arrow', w: 36, h: 36, r: 999, bg: k.t.onPrimary, main: 'center', cross: 'center' }, [label(k, '→', k.t.primary, { size: 16 })])]),
    base(k, 'Arrow outline', { r: 999, pad: [8, 8, 8, 24], gap: 14, line: true, motion: { hover: { type: 'pushRight' } } }, [label(k, 'See pricing', k.t.text), k.row({ name: 'Arrow', w: 36, h: 36, r: 999, bg: k.t.accent, main: 'center', cross: 'center' }, [label(k, '↗', onAccent(k), { size: 16 })])]),
  ])),
  define('button', 'btn-soft', 'Soft tinted buttons', 'subtle pastel secondary', k => set(k, 'Soft buttons', [
    base(k, 'Soft', { bg: alpha(k.t.accent, '1F'), motion: { hover: { type: 'lift' } } }, [label(k, 'Save draft', k.t.accent)]),
    base(k, 'Soft success', { bg: '#16A34A1F', motion: { hover: { type: 'lift' } } }, [label(k, '✓ Approve', '#16A34A')]),
    base(k, 'Soft danger', { bg: '#DC26261F', motion: { hover: { type: 'lift' } } }, [label(k, 'Delete', '#DC2626')]),
  ])),
  define('button', 'btn-outline', 'Outline buttons', 'border ghost secondary minimal', k => set(k, 'Outline buttons', [
    base(k, 'Outline', { line: k.t.text, motion: { hover: { type: 'invert' } } }, [label(k, 'Contact us', k.t.text)]),
    base(k, 'Outline accent', { r: 999, line: k.t.accent, motion: { hover: { type: 'lift' } } }, [label(k, 'Subscribe', k.t.accent)]),
    k.btn('Ghost link →', 'ghost'),
  ])),
  define('button', 'btn-shimmer', 'Shimmer buttons', 'animated shine sweep gradient', k => set(k, 'Shimmer buttons', [
    base(k, 'Shimmer', { bg: lin(110, k.t.primary, k.t.accent, k.t.primary, k.t.accent, k.t.primary), motion: { loop: { type: 'shimmer', duration: 4000 }, hover: { type: 'grow' } } }, [label(k, '✦ Upgrade to Pro', k.t.onPrimary)]),
    base(k, 'Shine', { r: 999, bg: lin(110, k.t.inv, alpha(k.t.muted, 'FF'), k.t.inv, alpha(k.t.muted, 'FF'), k.t.inv), motion: { loop: { type: 'shimmer', duration: 3200 } } }, [label(k, 'Join the beta', k.t.onInv)]),
  ])),
  define('button', 'btn-pulse', 'Pulsing ring button', 'animated attention ping live', k => set(k, 'Pulse button', [
    k.row({ name: 'Pulse', w: 190, h: 52 }, [
      k.shape('rect', { name: 'Ring', w: 190, h: 52, r: k.t.br, abs: [0, 0], bg: alpha(k.t.primary, '80'), motion: { loop: { type: 'ping', duration: 1800 } } }),
      base(k, 'Pulse', { w: 'fill', h: 'fill', bg: k.t.primary }, [label(k, 'Go live', k.t.onPrimary)]),
    ]),
    base(k, 'Heartbeat', { r: 999, bg: '#E11D48', motion: { loop: { type: 'heartbeat', duration: 1400 } } }, [label(k, '♥', '#FFFFFF'), label(k, 'Donate', '#FFFFFF')]),
  ])),
  define('button', 'btn-loading', 'Loading buttons', 'spinner progress busy animated', k => set(k, 'Loading buttons', [
    base(k, 'Loading', { bg: k.t.primary, op: 0.92 }, [k.txt('◠', { name: 'Spinner', size: 18, weight: 700, color: k.t.onPrimary, lh: 1, tag: 'span', motion: { loop: { type: 'spin', duration: 800 } } }), label(k, 'Saving…', k.t.onPrimary)]),
    base(k, 'Dots', { line: true }, [label(k, 'Sending', k.t.text), k.row({ gap: 4, cross: 'center' }, [0, 1, 2].map(i => k.shape('ellipse', { name: 'Dot', w: 6, h: 6, bg: k.t.text, motion: { enter: { type: 'fade', duration: 50, delay: 150 * i, trigger: 'load' }, loop: { type: 'bounce', duration: 800 } } })))]),
  ])),
  define('button', 'btn-icon', 'Icon buttons', 'round circle fab floating action', k => set(k, 'Icon buttons', [
    ...['＋', '♥', '↗', '⋯'].map((glyph, i) => k.row({ name: 'Icon button', w: 46, h: 46, r: 999, main: 'center', cross: 'center', bg: i === 0 ? k.t.primary : undefined, line: i !== 0, motion: { hover: { type: i === 0 ? 'rotate' : 'pop' } } }, [label(k, glyph, i === 0 ? k.t.onPrimary : k.t.text, { size: 18, lh: 1 })])),
    k.row({ name: 'Floating action', tag: 'button', w: 60, h: 60, r: 999, main: 'center', cross: 'center', bg: k.t.accent, fx: [drop(0, 12, 28, alpha(k.t.accent, '80'), -6)], motion: { hover: { type: 'float' } } }, [label(k, '✎', onAccent(k), { size: 24, lh: 1 })]),
  ])),
  define('button', 'btn-group', 'Button group', 'segmented joined toolbar split', k => set(k, 'Button groups', [
    k.row({ name: 'Group', r: Math.min(k.t.br, 12), line: true, bg: k.t.surface, clip: true }, ['Day', 'Week', 'Month'].flatMap((name, i) => [i ? k.shape('rect', { name: 'Divider', w: k.t.lw, h: 44, bg: k.t.line }) : null, k.row({ name, tag: 'button', pad: [13, 20], bg: i === 1 ? k.t.alt : undefined, cross: 'center' }, [label(k, name, i === 1 ? k.t.text : k.t.muted, { size: 14 })])]).filter((item): item is Tree => item !== null)),
    k.row({ name: 'Split button', r: k.t.br, bg: k.t.primary, clip: true }, [k.row({ name: 'Publish button', pad: [13, 20] }, [label(k, 'Publish', k.t.onPrimary)]), k.shape('rect', { name: 'Divider', w: 1, h: 44, bg: alpha(k.t.onPrimary, '4D') }), k.row({ name: 'More options button', pad: [13, 14] }, [label(k, '▾', k.t.onPrimary, { size: 14 })])]),
  ], { maxW: 520 })),
  define('button', 'btn-social', 'Social sign-in buttons', 'google apple github login oauth', k => k.col({ name: 'Social buttons', gap: 12, w: 340 }, [['G', 'Continue with Google', false], ['', 'Continue with Apple', true], ['◐', 'Continue with GitHub', false]].map(([glyph, text, dark]) => base(k, text as string, { w: 'fill', r: Math.min(k.t.br, 12), bg: dark ? k.t.inv : k.t.surface, line: !dark, motion: { hover: { type: 'lift' } } }, [
    k.row({ name: 'Brand', w: 20, h: 20, r: 999, main: 'center', cross: 'center', bg: dark ? k.t.onInv : alpha(k.t.accent, '26') }, [label(k, (glyph as string) || '●', dark ? k.t.inv : k.t.accent, { size: 11, weight: 800, lh: 1 })]),
    label(k, text as string, dark ? k.t.onInv : k.t.text, { weight: 500 }),
  ])))),
  define('button', 'btn-link', 'Link buttons', 'text underline arrow inline', k => set(k, 'Link buttons', [
    k.row({ name: 'Arrow link', link: HASH, gap: 8, cross: 'center', motion: { hover: { type: 'pushRight' } } }, [label(k, 'Read the story', k.t.text, { size: 16 }), label(k, '→', k.t.accent, { size: 16 })]),
    label(k, 'Underlined link', k.t.accent, { size: 16, underline: true, link: HASH, motion: { hover: { type: 'dim' } } }),
    k.col({ name: 'Bar link', link: HASH, gap: 4, motion: { hover: { type: 'lift' } } }, [label(k, 'View all work', k.t.text, { size: 16 }), k.shape('rect', { w: 'fill', h: 2, bg: k.t.accent })]),
  ], { gap: 28 })),
  define('button', 'btn-toggle', 'Like and follow buttons', 'social heart state toggle', k => set(k, 'Toggle buttons', [
    base(k, 'Liked', { r: 999, bg: '#E11D481F', pad: [11, 18] }, [label(k, '♥', '#E11D48', { motion: { loop: { type: 'heartbeat', duration: 1300 } } }), label(k, '1,284', '#E11D48')]),
    base(k, 'Follow', { r: 999, bg: k.t.primary, pad: [11, 20], motion: { hover: { type: 'grow' } } }, [label(k, '＋ Follow', k.t.onPrimary)]),
    base(k, 'Following', { r: 999, line: true, pad: [11, 20] }, [label(k, '✓ Following', k.t.text)]),
  ])),
  define('button', 'btn-store', 'App download buttons', 'store mobile get the app badge', k => set(k, 'Download buttons', ['iPhone', 'Android'].map((device, i) => k.row({ name: device + ' download', link: HASH, pad: [10, 20, 10, 16], r: Math.min(Math.max(k.t.br, 10), 14), gap: 12, cross: 'center', bg: k.t.inv, motion: { hover: { type: 'lift' } } }, [
    label(k, i ? '▶' : '●', k.t.onInv, { size: 22, lh: 1 }), k.col({ gap: 1 }, [label(k, 'Get the app for', alpha(k.t.onInv, 'B3'), { size: 11, weight: 500 }), label(k, device, k.t.onInv, { size: 17 })]),
  ])))),
  define('button', 'btn-neon', 'Neon buttons', 'glow dark cyber outline night', k => k.row({ name: 'Neon buttons', pad: [40, 44], gap: 20, r: k.t.r, bg: '#07080D', cross: 'center' }, [
    base(k, 'Neon', { r: 999, line: '#5EEAD4', fx: [drop(0, 0, 22, '#5EEAD480'), { type: 'innerShadow', x: 0, y: 0, blur: 14, spread: 0, color: '#5EEAD440', visible: true }], motion: { loop: { type: 'glow', duration: 2400 } } }, [label(k, 'Enter', '#5EEAD4')]),
    base(k, 'Neon pink', { r: 999, line: '#F472B6', fx: [drop(0, 0, 22, '#F472B680')], motion: { hover: { type: 'brighten' } } }, [label(k, 'Join now', '#F472B6')]),
  ])),
  define('button', 'btn-offer', 'Attention buttons', 'animated tada wiggle jelly sale', k => set(k, 'Attention buttons', [
    base(k, 'Tada', { bg: k.t.accent, motion: { loop: { type: 'tada', duration: 2600 } } }, [label(k, '🎁 Claim offer', onAccent(k))]),
    base(k, 'Jelly', { r: 999, bg: k.t.primary, motion: { loop: { type: 'jelly', duration: 2200 } } }, [label(k, 'Tap me', k.t.onPrimary)]),
    base(k, 'Swing', { line: true, motion: { loop: { type: 'swing', duration: 2000 } } }, [label(k, '🔔 Notify me', k.t.text)]),
  ])),
  define('button', 'btn-sizes', 'Button sizes', 'scale small medium large system', k => set(k, 'Button sizes', [['XS', 7, 12, 12], ['Small', 9, 16, 13], ['Medium', 13, 22, 15], ['Large', 17, 30, 17]].map(([name, py, px, size]) => base(k, name as string, { pad: [py as number, px as number], bg: k.t.primary, motion: { hover: { type: 'lift' } } }, [label(k, name as string, k.t.onPrimary, { size: size as number })])), { maxW: 520 })),
];
