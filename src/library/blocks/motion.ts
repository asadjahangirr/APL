import type { Motion } from '../../doc/schema';
import { alpha, lin, type Kit } from '../kit';
import { define, type LibraryItem } from '../types';
import { feature, person, stat } from './marketing';

/** Animated designs. Motion plays in Preview and on the live site. */

const enter = (type: NonNullable<Motion['enter']>['type'], delay = 0, trigger: 'load' | 'inView' = 'inView', duration = 700): Motion => ({ enter: { type, duration, delay, trigger } });
const loop = (type: NonNullable<Motion['loop']>['type'], duration: number): Motion => ({ loop: { type, duration } });
const LOGOS = ['Acme', 'Lumina', 'Vertex', 'Polar', 'Kite', 'Oak & Co', 'Nord', 'Fathom'];

/** A track that scrolls forever: its content is repeated twice and shifted by half its width. */
const marquee = (k: Kit, name: string, gap: number, duration: number, items: () => ReturnType<Kit['txt']>[]) => k.col({ name, w: 'fill', clip: true }, [
  k.row({ name: 'Track', gap, pad: [0, gap, 0, 0], cross: 'center', motion: loop('marquee', duration) }, [...items(), ...items()]),
]);

export const MOTION: LibraryItem[] = [
  define('motion', 'motion-logo-marquee', 'Scrolling logo marquee', 'animation ticker brands infinite', k => k.section('Logo marquee', { py: 56, cross: 'center', gap: 28, maxW: 1440 }, [
    k.p('Trusted by 4,000+ teams', { align: 'center', size: 14 }),
    marquee(k, 'Marquee', 72, 26000, () => LOGOS.map(name => k.txt(name, { font: 'head', size: 24, color: alpha(k.t.text, '8C'), lh: 1.2, tag: 'span' }))),
  ])),
  define('motion', 'motion-text-marquee', 'Big text ticker', 'animation ticker headline infinite bold', k => k.col({ name: 'Text ticker', tag: 'section', w: 'fill', pad: [36, 0], bg: k.t.inv, clip: true }, [
    k.row({ name: 'Track', gap: 48, pad: [0, 48, 0, 0], cross: 'center', motion: loop('marquee', 22000) }, [0, 1].flatMap(() => ['Design', '✦', 'Build', '✦', 'Launch', '✦', 'Repeat', '✦'].map(word => k.txt(word, { font: 'head', size: 88, color: word === '✦' ? k.t.accent === k.t.inv ? k.t.onInv : k.t.accent : k.t.onInv, lh: 1.1, upper: true, tag: 'span', mobile: { textStyle: { fontSize: 44 } } })))),
  ])),
  define('motion', 'motion-reveal-cards', 'Cards that reveal on scroll', 'animation fade stagger features', k => k.section('Reveal features', { bg: k.t.alt, cross: 'center' }, [
    k.col({ w: 'fill', cross: 'center', motion: enter('fadeUp') }, [k.intro('Features', 'Everything arrives right on cue.', 'Each card fades up as it scrolls into view.', { center: true })]),
    k.grid(3, { gap: 24, w: 'fill' }, [['Plan in minutes', 'Turn a rough idea into a clear roadmap.'], ['Design together', 'Comment, sketch and decide in one place.'], ['Ship with confidence', 'Every change is tracked and reversible.']].map(([title, body], i) => k.card({ name: title, h: 'fill', pad: 32, motion: { ...enter('fadeUp', 120 * i), hover: { type: 'lift' } } }, [feature(k, i, title, body)]))),
  ])),
  define('motion', 'motion-float-hero', 'Hero with floating cards', 'animation float landing product', k => k.section('Floating hero', {}, [
    k.row({ gap: 64, cross: 'center', w: 'fill', stack: true, mobile: { layout: { gap: 40 } } }, [
      k.col({ gap: 24, w: 'fill' }, [
        k.badge('✦ New', k.t.accent, { motion: enter('fade', 0, 'load') }),
        k.h1('Numbers that move as fast as you do.', { size: 58, motion: enter('fadeUp', 100, 'load') }),
        k.p('Live revenue, churn and runway on a single page that keeps itself up to date.', { size: 19, motion: enter('fadeUp', 220, 'load') }),
        k.row({ gap: 12, rgap: 12, wrap: true, motion: enter('fadeUp', 340, 'load') }, [k.btn('Start free', 'primary', { lg: true }), k.btn('See a demo', 'secondary', { lg: true })]),
      ]),
      k.col({ name: 'Cards', w: 'fill', gap: 22, cross: 'center' }, [
        k.card({ name: 'Revenue', w: 340, shadow: true, gap: 10, mfill: true, motion: { ...enter('zoomIn', 300, 'load'), ...loop('float', 5000) } }, [k.txt('Monthly revenue', { size: 14, color: k.t.muted, tag: 'span' }), k.txt('$48,290', { font: 'head', size: 40, lh: 1.1 }), k.badge('▲ 12.4%', '#16A34A')]),
        k.card({ name: 'Quote', w: 340, shadow: true, mfill: true, motion: { ...enter('zoomIn', 480, 'load'), ...loop('float', 6400) } }, [k.p('“I check it before my coffee.”', { color: k.t.text, size: 16 }), person(k, 1, 'Maya Okafor', 'CFO, Lumina')]),
      ]),
    ]),
  ])),
  define('motion', 'motion-orbs-hero', 'Hero with drifting glow', 'animation gradient aurora blur landing', k => k.section('Glow hero', { py: 150, cross: 'center', gap: 28, deco: [
    k.glow(-300, -200, 640, k.t.accent, { blur: 30, motion: loop('drift', 14000) }), k.glow(280, -60, 560, k.t.primary, { blur: 30, motion: loop('drift', 18000) }), k.glow(-20, 220, 480, k.t.imgs[1][1], { blur: 30, motion: loop('drift', 22000) }),
  ] }, [
    k.badge('Introducing Northwind AI', k.t.accent, { motion: enter('fade', 0, 'load') }),
    k.h1('Ideas in. Finished work out.', { align: 'center', size: 80, maxW: 900, grad: lin(100, k.t.text, k.t.accent), motion: enter('blurIn', 120, 'load', 900) }),
    k.p('Describe what you need, then refine the result together with your team.', { align: 'center', size: 20, maxW: 560, motion: enter('fadeUp', 320, 'load') }),
    k.btn('Try it now', 'primary', { lg: true, motion: { ...enter('fadeUp', 460, 'load'), hover: { type: 'grow' } } }),
  ])),
  define('motion', 'motion-pulse-cta', 'Pulsing call to action', 'animation button attention live', k => k.section('Pulsing CTA', { py: 112, cross: 'center', gap: 24, bg: k.t.alt }, [
    k.row({ gap: 8, cross: 'center' }, [k.shape('ellipse', { name: 'Live dot', w: 10, h: 10, bg: '#16A34A', motion: loop('breathe', 1400) }), k.txt('412 people are building right now', { size: 14, color: k.t.muted, tag: 'span' })]),
    k.h2('Your turn.', { align: 'center', size: 64 }), k.p('Start with a template and publish before lunch.', { align: 'center', maxW: 460, size: 19 }),
    k.btn('Start building — it is free', 'primary', { lg: true, motion: loop('pulse', 1800) }),
  ])),
  define('motion', 'motion-spin-sticker', 'Hero with spinning sticker', 'animation rotate badge playful', k => k.section('Sticker hero', {}, [
    k.row({ gap: 64, cross: 'center', w: 'fill', stack: 'center', mobile: { layout: { gap: 40 } } }, [
      k.col({ gap: 24, w: 'fill' }, [k.eyebrow('Limited run'), k.h1('The spring collection has landed.', { size: 64 }), k.p('Forty pieces, made once. When they are gone, they are gone.', { size: 19 }), k.btn('Shop the drop', 'primary', { lg: true })]),
      k.row({ name: 'Sticker', w: 260, h: 260, r: 999, bg: k.t.primary, main: 'center', cross: 'center', motion: loop('spin', 16000) }, [k.txt('✺', { size: 170, color: k.t.onPrimary, lh: 1, fixed: true, tag: 'span' })]),
    ]),
  ])),
  define('motion', 'motion-scroll-cue', 'Hero with bouncing scroll cue', 'animation bounce arrow landing', k => k.section('Scroll hero', { py: 140, cross: 'center', gap: 28 }, [
    k.h1('Slow down. Look closer.', { align: 'center', size: 84, motion: enter('fadeUp', 0, 'load', 900) }),
    k.p('A photo journal about small places and the people who keep them.', { align: 'center', maxW: 520, size: 20, motion: enter('fadeUp', 200, 'load') }),
    k.col({ h: 16 }, []),
    k.row({ name: 'Scroll cue', w: 52, h: 52, r: 999, line: true, main: 'center', cross: 'center', motion: loop('bounce', 1500) }, [k.txt('↓', { size: 22, lh: 1, tag: 'span' })]),
  ])),
  define('motion', 'motion-skeleton', 'Loading skeleton', 'animation placeholder shimmer loading', k => k.section('Skeleton', { bg: k.t.alt }, [
    k.grid(3, { gap: 24, w: 'fill' }, [0, 1, 2].map(i => k.card({ name: 'Loading card', gap: 14, pad: 20, motion: loop('breathe', 1500) }, [
      k.shape('rect', { w: 'fill', h: 160, r: Math.min(k.t.r, 10) }), k.shape('rect', { w: 180 - i * 20, h: 16, r: 8 }), k.shape('rect', { w: 'fill', h: 12, r: 6 }), k.shape('rect', { w: 220, h: 12, r: 6 }),
    ]))),
  ])),
  define('motion', 'motion-stats-pop', 'Stats that pop in', 'animation numbers counters scroll', k => k.section('Pop stats', { py: 88 }, [
    k.grid(4, { gap: 32, rgap: 32, w: 'fill', tcols: 2, mcols: 2 }, [['2.4M', 'tasks completed'], ['180+', 'countries'], ['35%', 'faster delivery'], ['4.9/5', 'average rating']].map(([value, label], i) => k.col({ name: label, w: 'fill', motion: enter('pop', 140 * i) }, [stat(k, value, label, { center: true, size: 56 })]))),
  ])),
  define('motion', 'motion-typing', 'Typing indicator chat', 'animation dots chat message bounce', k => k.section('Chat', { cross: 'center', bg: k.t.alt }, [
    k.card({ name: 'Chat', maxW: 460, gap: 14, pad: 24 }, [
      k.row({ gap: 10, cross: 'end' }, [k.avatar(0, 32), k.row({ pad: [12, 16], r: 18, bg: k.t.alt, maxW: 300 }, [k.txt('Hi! Can I see the new pricing page?', { size: 15, w: 'fill' })])]),
      k.row({ w: 'fill', main: 'end', motion: enter('slideLeft', 300) }, [k.row({ pad: [12, 16], r: 18, bg: k.t.primary, maxW: 300 }, [k.txt('Of course. Sending it over now.', { size: 15, color: k.t.onPrimary, w: 'fill' })])]),
      k.row({ gap: 10, cross: 'end' }, [k.avatar(0, 32), k.row({ name: 'Typing', pad: [16, 16], r: 18, bg: k.t.alt, gap: 6, cross: 'center' }, [0, 1, 2].map(i => k.shape('ellipse', { name: 'Dot', w: 8, h: 8, bg: k.t.muted, motion: { enter: { type: 'fade', duration: 50, delay: 160 * i, trigger: 'load' }, loop: { type: 'bounce', duration: 900 } } })))]),
    ]),
  ])),
  define('motion', 'motion-hover-gallery', 'Gallery with hover zoom', 'animation hover images portfolio', k => k.section('Hover gallery', {}, [
    k.intro('Hover me', 'Pictures that respond to your cursor.'),
    k.grid(3, { gap: 24, w: 'fill' }, ['Harbour House', 'Studio Nord', 'Field Notes'].map((name, i) => k.col({ name, gap: 14, w: 'fill', motion: { ...enter('fadeUp', 100 * i), hover: { type: 'grow' } } }, [k.img(i, { h: 320, mobile: { height: 220 } }), k.row({ w: 'fill', main: 'between', cross: 'center' }, [k.h3(name, { w: 'hug' }), k.txt('↗', { size: 18, color: k.t.muted, lh: 1, tag: 'span' })])]))),
  ])),
  define('motion', 'motion-slide-split', 'Split that slides together', 'animation slide scroll feature image', k => k.section('Slide feature', { bg: k.t.alt }, [
    k.row({ gap: 72, cross: 'center', w: 'fill', stack: true, mobile: { layout: { gap: 36 } } }, [
      k.img(1, { h: 460, mobile: { height: 280 }, motion: enter('slideRight', 0, 'inView', 900) }),
      k.col({ gap: 22, w: 'fill', motion: enter('slideLeft', 120, 'inView', 900) }, [k.eyebrow('Collaboration'), k.h2('Two halves, one story.'), k.p('The picture slides in from the left while the words arrive from the right.'), k.col({ gap: 12, w: 'fill' }, ['Triggers when scrolled into view', 'Respects reduced-motion settings', 'Fully editable after inserting'].map(point => k.check(point))), k.btn('Learn more')]),
    ]),
  ])),
  define('motion', 'motion-wiggle-404', 'Playful not-found page', 'animation wiggle error 404 empty', k => k.section('Not found', { py: 140, cross: 'center', gap: 20 }, [
    k.txt('404', { font: 'head', size: 180, lh: 1, color: k.t.accent, motion: loop('wiggle', 2600) }),
    k.h2('This page wandered off.', { align: 'center', size: 40 }), k.p('It may have moved, or it never existed. Let us get you back on track.', { align: 'center', maxW: 460 }),
    k.btn('Back to home', 'primary', { lg: true }),
  ])),
];
