import type { Motion, SiteDoc } from '../doc/schema';

/**
 * Motion → CSS. Animations use the individual `translate` / `scale` / `rotate`
 * properties so they compose with the `transform` a layer already uses for
 * rotation and centering. Enter animations fill backwards only, so hover
 * effects still work once they finish.
 */

type EnterType = NonNullable<Motion['enter']>['type'];
type LoopType = NonNullable<Motion['loop']>['type'];
type HoverType = NonNullable<Motion['hover']>['type'];
type ScrollType = NonNullable<Motion['scroll']>['type'];

/**
 * Scroll effects follow the page's scroll position (CSS scroll-driven
 * animations). `a` is the amount, 0–1. Most play as the layer enters the
 * window; parallax and rotate run while it crosses the whole window.
 */
const SCROLL: Record<ScrollType, { frames: (a: number) => string; range: string }> = {
  parallax: { frames: a => `from{translate:0 ${r(a * 240)}px}to{translate:0 ${r(-a * 240)}px}`, range: 'cover 0% cover 100%' },
  fadeIn: { frames: a => `from{opacity:${r(1 - a)}}to{opacity:1}`, range: 'entry 0% cover 40%' },
  slideUp: { frames: a => `from{opacity:0;translate:0 ${r(a * 200)}px}to{opacity:1;translate:0 0}`, range: 'entry 0% cover 40%' },
  scaleUp: { frames: a => `from{scale:${r(1 - a * 0.5)}}to{scale:1}`, range: 'entry 0% cover 45%' },
  zoomOut: { frames: a => `from{scale:${r(1 + a * 0.6)}}to{scale:1}`, range: 'entry 0% cover 50%' },
  slideLeft: { frames: a => `from{opacity:0;translate:${r(a * 300)}px 0}to{opacity:1;translate:0 0}`, range: 'entry 0% cover 40%' },
  slideRight: { frames: a => `from{opacity:0;translate:${r(-a * 300)}px 0}to{opacity:1;translate:0 0}`, range: 'entry 0% cover 40%' },
  blurIn: { frames: a => `from{opacity:0;filter:blur(${r(a * 24)}px)}to{opacity:1;filter:blur(0px)}`, range: 'entry 0% cover 40%' },
  rotate: { frames: a => `from{rotate:${r(-a * 30)}deg}to{rotate:${r(a * 30)}deg}`, range: 'cover 0% cover 100%' },
  reveal: { frames: () => 'from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}', range: 'entry 10% cover 50%' },
};
const r = (value: number) => Math.round(value * 100) / 100;

const ENTER: Record<EnterType, string> = {
  fade: 'from{opacity:0}',
  fadeUp: 'from{opacity:0;translate:0 32px}',
  fadeDown: 'from{opacity:0;translate:0 -32px}',
  slideLeft: 'from{opacity:0;translate:56px 0}',
  slideRight: 'from{opacity:0;translate:-56px 0}',
  zoomIn: 'from{opacity:0;scale:.86}',
  zoomOut: 'from{opacity:0;scale:1.14}',
  blurIn: 'from{opacity:0;filter:blur(14px)}',
  flipIn: 'from{opacity:0;rotate:x 75deg}',
  pop: '0%{opacity:0;scale:.6}70%{opacity:1;scale:1.06}100%{scale:1}',
  rotateIn: 'from{opacity:0;rotate:-14deg;scale:.9}',
  spinIn: 'from{opacity:0;rotate:-180deg;scale:.4}',
  bounceIn: '0%{opacity:0;scale:.3}50%{opacity:1;scale:1.1}70%{scale:.94}100%{scale:1}',
  dropIn: '0%{opacity:0;translate:0 -90px}60%{opacity:1;translate:0 12px}80%{translate:0 -5px}100%{translate:0 0}',
  rise: 'from{opacity:0;translate:0 90px}',
  expand: 'from{opacity:0;scale:0 1}',
};
const LOOP: Record<LoopType, { frames: string; easing: string; extra?: string }> = {
  float: { frames: '0%,100%{translate:0 0}50%{translate:0 -14px}', easing: 'ease-in-out' },
  pulse: { frames: '0%,100%{scale:1}50%{scale:1.06}', easing: 'ease-in-out' },
  breathe: { frames: '0%,100%{opacity:1}50%{opacity:.45}', easing: 'ease-in-out' },
  spin: { frames: 'to{rotate:360deg}', easing: 'linear' },
  bounce: { frames: '0%,100%{translate:0 0}50%{translate:0 -18px}', easing: 'cubic-bezier(.3,0,.7,1)' },
  wiggle: { frames: '0%,100%{rotate:-4deg}50%{rotate:4deg}', easing: 'ease-in-out' },
  drift: { frames: '0%,100%{translate:0 0}33%{translate:24px -16px}66%{translate:-18px 12px}', easing: 'ease-in-out' },
  marquee: { frames: 'to{translate:-50% 0}', easing: 'linear' },
  marqueeUp: { frames: 'to{translate:0 -50%}', easing: 'linear' },
  shake: { frames: '0%,60%,100%{translate:0 0}10%,30%,50%{translate:-6px 0}20%,40%{translate:6px 0}', easing: 'ease-in-out' },
  heartbeat: { frames: '0%,40%,80%,100%{scale:1}20%{scale:1.18}60%{scale:1.12}', easing: 'ease-in-out' },
  swing: { frames: '0%,100%{rotate:8deg}50%{rotate:-8deg}', easing: 'ease-in-out' },
  flash: { frames: '0%,50%,100%{opacity:1}25%,75%{opacity:.25}', easing: 'linear' },
  jelly: { frames: '0%,100%{scale:1 1}30%{scale:1.18 .84}50%{scale:.9 1.1}70%{scale:1.05 .96}', easing: 'ease-in-out' },
  tada: { frames: '0%,100%{scale:1;rotate:0deg}10%,20%{scale:.92;rotate:-4deg}30%,50%,70%{scale:1.1;rotate:4deg}40%,60%{scale:1.1;rotate:-4deg}80%{scale:1;rotate:0deg}', easing: 'ease-in-out' },
  ping: { frames: '0%{scale:1;opacity:.7}80%,100%{scale:1.9;opacity:0}', easing: 'cubic-bezier(0,0,.2,1)' },
  hue: { frames: 'to{filter:hue-rotate(360deg)}', easing: 'linear' },
  glow: { frames: '0%,100%{filter:brightness(1)}50%{filter:brightness(1.3) saturate(1.2)}', easing: 'ease-in-out' },
  shimmer: { frames: 'from{background-position:200% 0}to{background-position:-200% 0}', easing: 'linear', extra: 'background-size:200% 100%' },
};
const HOVER: Record<HoverType, string> = {
  lift: 'translate:0 -4px',
  grow: 'scale:1.04',
  shrink: 'scale:.97',
  dim: 'opacity:.7',
  brighten: 'filter:brightness(1.12)',
  tilt: 'rotate:-2deg',
  pop: 'scale:1.08;rotate:2deg',
  press: 'scale:.96;translate:0 2px',
  float: 'translate:0 -10px',
  pushRight: 'translate:6px 0',
  rotate: 'rotate:8deg',
  shadow: 'filter:drop-shadow(0 12px 22px rgba(0,0,0,.28))',
  saturate: 'filter:saturate(1.7)',
  invert: 'filter:invert(1)',
};
const ENTER_EASING = 'cubic-bezier(.2,.7,.2,1)';

/** Stylesheet for every animated layer of a page, with only the keyframes it uses. */
export function motionCss(doc: SiteDoc, rootId: string, scope: string): string {
  const keyframes = new Map<string, string>();
  const rules: string[] = [];
  const scrollRules: string[] = [];
  const visit = (id: string) => {
    const node = doc.nodes[id];
    if (!node) return;
    const motion = node.motion;
    const selector = `.${scope} .n-${id}`;
    if (motion) {
      const parts: string[] = [];
      let loopDelay = 0;
      if (motion.enter) {
        const { type, duration, delay } = motion.enter;
        keyframes.set('apl-in-' + type, ENTER[type]);
        parts.push(`apl-in-${type} ${duration}ms ${ENTER_EASING} ${delay}ms backwards`);
        loopDelay = duration + delay;
      }
      if (motion.loop) {
        const { type, duration } = motion.loop;
        keyframes.set('apl-loop-' + type, LOOP[type].frames);
        parts.push(`apl-loop-${type} ${duration}ms ${LOOP[type].easing} ${loopDelay}ms infinite`);
        if (LOOP[type].extra) rules.push(`${selector}{${LOOP[type].extra}}`);
      }
      if (parts.length) rules.push(`${selector}{animation:${parts.join(',')}}`);
      if (motion.scroll) {
        // Only where the browser supports scroll timelines; elsewhere the layer simply shows.
        const effect = SCROLL[motion.scroll.type], name = `apl-sc-${id}`;
        keyframes.set(name, effect.frames(motion.scroll.amount / 100));
        const all = [...parts, `${name} linear both`];
        scrollRules.push(`${selector}{animation:${all.join(',')};animation-timeline:${[...parts.map(() => 'auto'), 'view()'].join(',')};animation-range:${[...parts.map(() => 'normal'), effect.range].join(',')}}`);
      }
      if (motion.enter?.trigger === 'inView') rules.push(`${selector}:not([data-apl-in]){animation-play-state:paused}`);
      if (motion.hover) {
        rules.push(`${selector}{transition:translate .25s ease,scale .25s ease,rotate .25s ease,opacity .25s ease,filter .25s ease}`);
        rules.push(`${selector}:hover{${HOVER[motion.hover.type]}}`);
      }
    }
    for (const child of node.children) visit(child);
  };
  visit(rootId);
  if (!rules.length && !scrollRules.length) return '';
  return [
    ...[...keyframes].map(([name, frames]) => `@keyframes ${name}{${frames}}`),
    ...rules,
    ...(scrollRules.length ? [`@supports (animation-timeline: view()){\n${scrollRules.join('\n')}\n}`] : []),
    `@media (prefers-reduced-motion: reduce){.${scope} *{animation:none!important;transition:none!important}}`,
  ].join('\n');
}
