import type { Motion } from '../../doc/schema';
import { alpha, lin, type Kit, type Tree } from '../kit';
import { define, type LibraryItem } from '../types';
import { person } from './marketing';

/** More animated designs: shimmer text, pings, loaders, vertical marquees, flips, drops and shakes. */

const enter = (type: NonNullable<Motion['enter']>['type'], delay = 0, trigger: 'load' | 'inView' = 'inView', duration = 700): Motion => ({ enter: { type, duration, delay, trigger } });
const loop = (type: NonNullable<Motion['loop']>['type'], duration: number): Motion => ({ loop: { type, duration } });
const QUOTES: [string, string][] = [['Shipped our redesign three weeks early.', 'Maya Okafor'], ['The calmest tool we use.', 'Daniel Reyes'], ['Onboarding took one afternoon.', 'Sofia Lindqvist'], ['Support replies in minutes.', 'Arjun Mehta']];

const quoteCard = (k: Kit, i: number): Tree => k.card({ name: QUOTES[i % 4][1], gap: 14, pad: 22 }, [k.stars(), k.p('“' + QUOTES[i % 4][0] + '”', { color: k.t.text, size: 15 }), person(k, i, QUOTES[i % 4][1], 'Verified customer')]);
/** A column that scrolls upward forever (content repeated twice). */
const column = (k: Kit, offset: number, duration: number, hideM = false) => k.col({ name: 'Column', w: 'fill', h: 440, clip: true, hideM }, [
  k.col({ name: 'Track', w: 'fill', gap: 16, pad: [0, 0, 16, 0], motion: loop('marqueeUp', duration) }, [0, 1, 2, 0, 1, 2].map(i => quoteCard(k, i + offset))),
]);

const scrollFx = (type: NonNullable<Motion['scroll']>['type'], amount = 50): Motion => ({ scroll: { type, amount } });

export const MORE_MOTION: LibraryItem[] = [
  define('motion', 'motion-scroll-story', 'Scroll story with sticky title', 'scroll parallax sticky reveal storytelling', k => k.section('Scroll story', { py: 120 }, [
    k.row({ name: 'Story', w: 'fill', gap: 64, cross: 'start', stack: true }, [
      k.col({ name: 'Sticky intro', w: 'fill', maxW: 420, gap: 16, sticky: 96 }, [k.eyebrow('How it works'), k.h2('Every step, one scroll at a time.', { size: 44 }), k.p('The title stays put while the steps slide in beside it.')]),
      k.col({ name: 'Steps', w: 'fill', gap: 24 }, ['Plan the pages', 'Design every screen', 'Preview on any device', 'Publish the site'].map((title, i) =>
        k.card({ name: title, gap: 10, motion: scrollFx(i % 2 ? 'slideLeft' : 'slideUp', 40) }, [k.txt(`0${i + 1}`, { font: 'head', size: 15, color: k.t.accent, tag: 'span' }), k.h3(title), k.p('Scroll to see each card arrive as it enters the window.', { size: 15 })]))),
    ]),
  ])),
  define('motion', 'motion-parallax-gallery', 'Parallax gallery', 'scroll parallax depth images reveal', k => k.section('Parallax gallery', { py: 120, bg: k.t.alt }, [
    k.intro('Depth on scroll', 'Pictures that move at different speeds.', null, { center: true }),
    k.grid(3, { name: 'Gallery', gap: 24, w: 'fill' }, [0, 1, 2].map(i => k.img(i, { h: 360, motion: scrollFx(i === 1 ? 'parallax' : 'scaleUp', i === 1 ? 35 : 40) }))),
    k.row({ name: 'Reveal line', w: 'fill', main: 'center' }, [k.h2('Revealed as you scroll.', { size: 40, align: 'center', motion: scrollFx('reveal') })]),
  ])),
  define('motion', 'motion-shimmer-title', 'Hero with shimmering title', 'animation gradient text shine landing', k => k.section('Shimmer hero', { py: 130, cross: 'center', gap: 26 }, [
    k.badge('✦ Spring release'),
    k.h1('Design that shines.', { align: 'center', size: 92, grad: lin(100, k.t.text, k.t.accent, k.t.text, k.t.accent, k.t.text), motion: loop('shimmer', 6000) }),
    k.p('The headline gradient sweeps across forever. Change the colors and it keeps moving.', { align: 'center', size: 20, maxW: 560 }),
    k.btn('See what is new', 'primary', { lg: true }),
  ])),
  define('motion', 'motion-ping-status', 'Live status with ping', 'animation pulse dot online notification', k => k.section('Status', { cross: 'center', bg: k.t.alt }, [
    k.card({ name: 'Status', maxW: 520, gap: 0, pad: [8, 24] }, [['All systems operational', '#16A34A'], ['API response time: 42 ms', '#16A34A'], ['Scheduled maintenance tonight', '#D97706']].flatMap(([text, color], i) => [
      i ? k.rule() : null,
      k.row({ name: text, w: 'fill', pad: [18, 0], gap: 14, cross: 'center' }, [
        k.row({ name: 'Signal', w: 14, h: 14 }, [k.shape('ellipse', { name: 'Ping', w: 14, h: 14, abs: [0, 0], bg: color, motion: loop('ping', 1600) }), k.shape('ellipse', { name: 'Dot', w: 14, h: 14, bg: color })]),
        k.txt(text, { size: 16, weight: 500, w: 'fill' }), k.txt('Live', { size: 13, color: k.t.muted, tag: 'span' }),
      ]),
    ])),
  ])),
  define('motion', 'motion-loaders', 'Loaders and spinners', 'animation loading spinner bars dots', k => k.section('Loaders', { cross: 'center' }, [
    k.grid(4, { gap: 24, w: 'fill', maxW: 900, tcols: 2, mcols: 2 }, [
      k.card({ name: 'Spinner', cross: 'center', pad: 32, h: 'fill' }, [k.txt('◠', { size: 44, weight: 700, color: k.t.accent, lh: 1, fixed: true, tag: 'span', motion: loop('spin', 900) }), k.p('Spinner', { align: 'center', size: 14 })]),
      k.card({ name: 'Bars', cross: 'center', pad: 32, h: 'fill' }, [k.row({ gap: 5, cross: 'center', h: 44 }, [0, 1, 2, 3].map(i => k.shape('rect', { name: 'Bar', w: 7, h: 30, r: 4, bg: k.t.accent, motion: { enter: { type: 'fade', duration: 50, delay: 120 * i, trigger: 'load' }, loop: { type: 'jelly', duration: 900 } } }))), k.p('Bars', { align: 'center', size: 14 })]),
      k.card({ name: 'Dots', cross: 'center', pad: 32, h: 'fill' }, [k.row({ gap: 8, cross: 'center', h: 44 }, [0, 1, 2].map(i => k.shape('ellipse', { name: 'Dot', w: 12, h: 12, bg: k.t.accent, motion: { enter: { type: 'fade', duration: 50, delay: 160 * i, trigger: 'load' }, loop: { type: 'bounce', duration: 900 } } }))), k.p('Dots', { align: 'center', size: 14 })]),
      k.card({ name: 'Pulse', cross: 'center', pad: 32, h: 'fill' }, [k.row({ w: 44, h: 44 }, [k.shape('ellipse', { name: 'Ring', w: 44, h: 44, abs: [0, 0], bg: alpha(k.t.accent, '80'), motion: loop('ping', 1400) }), k.shape('ellipse', { name: 'Core', w: 44, h: 44, bg: k.t.accent })]), k.p('Pulse', { align: 'center', size: 14 })]),
    ]),
  ])),
  define('motion', 'motion-quote-columns', 'Scrolling testimonial columns', 'animation vertical marquee reviews wall', k => k.section('Scrolling reviews', { bg: k.t.alt, cross: 'center' }, [
    k.intro('Loved by teams', 'Reviews that never stop rolling.', null, { center: true }),
    k.row({ gap: 16, w: 'fill' }, [column(k, 0, 26000), column(k, 1, 34000), column(k, 2, 30000, true)]),
  ])),
  define('motion', 'motion-flip-cards', 'Cards that flip in', 'animation 3d flip scroll features', k => k.section('Flip cards', { cross: 'center' }, [
    k.intro('How it works', 'Three steps, one after another.', null, { center: true }),
    k.grid(3, { gap: 24, w: 'fill' }, [['Connect', 'Link the tools you already use.'], ['Customize', 'Shape it around how your team works.'], ['Launch', 'Invite everyone and start shipping.']].map(([title, body], i) => k.card({ name: title, h: 'fill', pad: 32, motion: { ...enter('flipIn', 180 * i, 'inView', 800), hover: { type: 'float' } } }, [k.txt('0' + (i + 1), { font: 'head', size: 48, color: k.t.accent, lh: 1 }), k.h3(title), k.p(body, { size: 16 })]))),
  ])),
  define('motion', 'motion-drop-list', 'Checklist that drops in', 'animation bounce stagger list onboarding', k => k.section('Drop list', { cross: 'center', bg: k.t.alt }, [
    k.card({ name: 'Checklist', maxW: 520, gap: 14, pad: 28 }, [
      k.h3('Getting started', { size: 24 }),
      ...['Create your workspace', 'Invite your team', 'Connect your tools', 'Publish your first page'].map((text, i) => k.row({ name: text, w: 'fill', pad: [14, 16], gap: 12, cross: 'center', r: Math.min(k.t.r, 12), bg: k.t.alt, motion: enter('dropIn', 140 * i, 'inView', 800) }, [k.icon('✓', 28, i < 2 ? '#16A34A' : k.t.muted), k.txt(text, { size: 15, weight: 500, w: 'fill', strike: i < 2, color: i < 2 ? k.t.muted : k.t.text })])),
    ]),
  ])),
  define('motion', 'motion-shake-form', 'Form with error shake', 'animation shake validation error input', k => k.section('Shake form', { cross: 'center' }, [
    k.card({ name: 'Form', maxW: 420, gap: 18, pad: 32 }, [
      k.h3('Reset your password', { size: 24 }),
      k.col({ name: 'Email', gap: 8, w: 'fill', motion: loop('shake', 2600) }, [k.txt('Email', { size: 14, weight: 500, tag: 'span' }), k.input('not-an-email', { line: '#DC2626' }), k.txt('Enter a valid email address.', { size: 13, color: '#DC2626', tag: 'span' })]),
      k.btn('Send reset link', 'primary', { w: 'fill', lg: true }),
    ]),
  ])),
  define('motion', 'motion-bounce-stats', 'Stats that bounce in', 'animation numbers scroll bounce counters', k => k.section('Bounce stats', { py: 88, bg: k.t.inv }, [
    k.grid(3, { gap: 40, rgap: 32, w: 'fill', tcols: 3, mcols: 1 }, [['$2.1B', 'processed'], ['40k', 'workspaces'], ['99.99%', 'uptime']].map(([value, text], i) => k.col({ name: text, gap: 6, w: 'fill', cross: 'center', motion: enter('bounceIn', 160 * i, 'inView', 900) }, [k.txt(value, { font: 'head', size: 64, color: k.t.onInv, w: 'fill', align: 'center', lh: 1.05 }), k.p(text, { size: 16, align: 'center', color: alpha(k.t.onInv, 'A6') })])),
    ),
  ])),
  define('motion', 'motion-hue-orb', 'Hero with color-shifting orb', 'animation hue gradient blob ai landing', k => k.section('Orb hero', {}, [
    k.row({ gap: 64, cross: 'center', w: 'fill', stack: 'center', mobile: { layout: { gap: 40 } } }, [
      k.col({ gap: 24, w: 'fill' }, [k.eyebrow('Meet Nova'), k.h1('An assistant that listens first.', { size: 62, motion: enter('rise', 0, 'load', 900) }), k.p('Ask in your own words. Nova answers with the context of your whole workspace.', { size: 19 }), k.btn('Talk to Nova', 'primary', { lg: true })]),
      k.shape('ellipse', { name: 'Orb', w: 300, h: 300, bg: lin(135, k.t.accent, k.t.imgs[1][1], k.t.imgs[2][1]), blur: 2, motion: { loop: { type: 'hue', duration: 9000 }, hover: { type: 'pop' } } }),
    ]),
  ])),
  define('motion', 'motion-spin-in-gallery', 'Gallery that spins in', 'animation rotate scroll images portfolio', k => k.section('Spin gallery', { bg: k.t.alt }, [
    k.intro('Fresh work', 'Tiles tumble into place as you scroll.'),
    k.grid(4, { gap: 20, w: 'fill', tcols: 2, mcols: 2 }, [0, 1, 2, 3].map(i => k.img(i, { h: 260, mobile: { height: 160 }, motion: { ...enter(i % 2 ? 'rotateIn' : 'spinIn', 110 * i, 'inView', 900), hover: { type: 'saturate' } } }))),
  ])),
];
