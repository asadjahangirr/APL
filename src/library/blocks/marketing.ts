import { alpha, lin, type F, type Kid, type Kit, type Tree, HASH } from '../kit';
import { define, type LibraryItem } from '../types';

/** Navigation bars, heroes, features, social proof, testimonials, pricing, CTAs, FAQ and footers. */

const NAV = ['Product', 'Pricing', 'Customers', 'Docs'];
const GLYPHS = ['✦', '◆', '▲', '●', '■', '◎', '↗', '✚'];

export const links = (k: Kit, color = k.t.muted, names = NAV, o: F = {}) => k.row({ name: 'Links', gap: 32, cross: 'center', hideM: true, ...o }, names.map(name => k.link(name, color)));
const burger = (k: Kit, color = k.t.text) => k.row({ name: 'Menu button', onlyM: true }, [k.txt('☰', { name: 'Menu', size: 22, color, lh: 1, tag: 'span' })]);
const bar = (k: Kit, o: F, kids: Kid[]) => k.row({ name: 'Navigation', tag: 'nav', w: 'fill', pad: [18, 64], tpad: [18, 40], mpad: [14, 20], main: 'between', cross: 'center', bg: k.t.bg, ...o }, kids);
/** Outlined button for inverse / colored backgrounds. */
export const outline = (k: Kit, label: string, color: string, o: F = {}) => k.row({ name: label + ' button', pad: [16, 28], r: k.t.br, line: alpha(color, '66'), main: 'center', cross: 'center', motion: { hover: { type: 'lift' } }, ...o }, [k.txt(label, { size: 16, weight: 600, color, lh: 1.2, tag: 'span' })]);
export const stat = (k: Kit, value: string, label: string, o: { color?: string; muted?: string; center?: boolean; size?: number } = {}) => k.col({ name: 'Stat', gap: 6, w: 'fill', cross: o.center ? 'center' : 'start' }, [
  k.txt(value, { font: 'head', size: o.size ?? 48, color: o.color ?? k.t.text, w: 'fill', align: o.center ? 'center' : 'left', lh: 1.1 }),
  k.p(label, { size: 15, color: o.muted ?? k.t.muted, align: o.center ? 'center' : 'left' }),
]);
export const person = (k: Kit, index: number, name: string, role: string, color = k.t.text, muted = k.t.muted) => k.row({ name, gap: 12, cross: 'center' }, [
  k.avatar(index, 44), k.col({ gap: 2 }, [k.txt(name, { size: 15, weight: 600, color, lh: 1.3, tag: 'span' }), k.txt(role, { size: 14, color: muted, lh: 1.3, tag: 'span' })]),
]);
export const feature = (k: Kit, index: number, title: string, body: string, o: F = {}) => k.col({ name: title, gap: 14, w: 'fill', ...o }, [k.icon(GLYPHS[index % GLYPHS.length]), k.h3(title), k.p(body, { size: 16 })]);
const wordmark = (k: Kit, name: string, color = alpha(k.t.text, '8C')) => k.txt(name, { font: 'head', size: 22, color, lh: 1.2, ls: -0.4, tag: 'span' });
const footCol = (k: Kit, title: string, names: string[], color = k.t.text, muted = k.t.muted) => k.col({ name: title, gap: 14, w: 'fill' }, [k.txt(title, { size: 14, weight: 600, color, tag: 'span' }), ...names.map(name => k.link(name, muted))]);

const FEATURES: [string, string][] = [
  ['Plan in minutes', 'Turn a rough idea into a clear roadmap with templates your whole team already understands.'],
  ['Design together', 'Comment, sketch and decide in one shared space instead of across five different tools.'],
  ['Ship with confidence', 'Every change is reviewed, tracked and reversible, so releases stop being stressful.'],
  ['Measure what matters', 'Simple dashboards show what is working, what is not and what to do next.'],
  ['Automate the busywork', 'Hand off status updates, reminders and reports to rules that never forget.'],
  ['Stay secure', 'Single sign-on, granular roles and audit logs come as standard on every plan.'],
];
const QUOTES: [string, string, string][] = [
  ['We replaced four tools with Northwind and shipped our redesign three weeks early.', 'Maya Okafor', 'Head of Product, Lumina'],
  ['The first tool our designers and engineers both actually enjoy opening in the morning.', 'Daniel Reyes', 'CTO, Vertex'],
  ['Onboarding took an afternoon. By Friday the whole company was planning in it.', 'Sofia Lindqvist', 'Operations Lead, Polar'],
  ['It feels calm. That is rare for software that does this much.', 'Arjun Mehta', 'Founder, Kite'],
  ['Support answers in minutes and the product gets better every single month.', 'Hannah Weiss', 'Design Director, Oak & Co'],
  ['Our clients notice the difference. Projects simply run smoother.', 'Leo Tanaka', 'Partner, Studio Nord'],
];
const FAQS: [string, string][] = [
  ['How does the free trial work?', 'You get every feature for 14 days. No card is needed, and you can invite your whole team.'],
  ['Can I change plans later?', 'Yes. Upgrade, downgrade or cancel at any time and we will prorate the difference.'],
  ['Do you offer discounts for nonprofits?', 'Registered nonprofits and schools get 50% off every paid plan.'],
  ['Where is my data stored?', 'In encrypted databases in the region you choose when you create your workspace.'],
  ['Is there an API?', 'Yes. Everything you can do in the app is available through a documented REST API.'],
];
const LOGOS = ['Acme', 'Lumina', 'Vertex', 'Polar', 'Kite', 'Oak & Co'];

function plan(k: Kit, name: string, price: string, desc: string, points: string[], featured = false): Tree {
  const { t } = k;
  const color = featured ? t.onInv : t.text, muted = featured ? alpha(t.onInv, 'A6') : t.muted;
  return k.card({ name: name + ' plan', h: 'fill', gap: 24, pad: 32, ...(featured ? { bg: t.inv, line: false, shadow: true } : {}) }, [
    k.col({ gap: 8, w: 'fill' }, [
      k.row({ w: 'fill', main: 'between', cross: 'center' }, [k.h3(name, { color, w: 'hug' }), featured ? k.badge('Most popular', t.onInv) : null]),
      k.p(desc, { size: 15, color: muted }),
    ]),
    k.row({ gap: 6, cross: 'end' }, [k.txt(price, { font: 'head', size: 48, color, lh: 1 }), k.txt('/month', { size: 15, color: muted, tag: 'span' })]),
    featured ? k.btn('Start free trial', 'onInv', { w: 'fill' }) : k.btn('Choose ' + name, 'secondary', { w: 'fill' }),
    k.rule({ bg: featured ? alpha(t.onInv, '33') : t.line }),
    k.col({ gap: 12, w: 'fill' }, points.map(point => k.check(point, color, featured ? t.onInv : t.accent))),
  ]);
}
const PLANS = (k: Kit) => [
  plan(k, 'Starter', '$0', 'For individuals trying things out.', ['3 projects', 'Unlimited viewers', 'Community support']),
  plan(k, 'Team', '$24', 'For growing teams that ship weekly.', ['Unlimited projects', 'Roles and permissions', 'Priority support', 'Advanced analytics'], true),
  plan(k, 'Scale', '$79', 'For companies with many teams.', ['Single sign-on', 'Audit log', 'Dedicated manager', 'Custom contracts']),
];
/** Accordion row: clicking the question shows or hides its answer (the first starts open). */
const faqRow = (k: Kit, q: string, a: string, open = false) => {
  const answer = k.p(a, { name: 'Answer', size: 16, hidden: !open });
  return [
    k.col({ name: q, w: 'fill', pad: [22, 0], gap: 10 }, [
      k.row({ name: 'Question', w: 'fill', main: 'between', cross: 'center', gap: 16, link: { type: 'toggle', targetId: answer.node.id } }, [k.txt(q, { size: 18, weight: 600, w: 'fill', lh: 1.4 }), k.txt('+', { name: 'Toggle', size: 22, color: k.t.muted, lh: 1, tag: 'span' })]),
      answer,
    ]),
    k.rule(),
  ];
};
const heroButtons = (k: Kit, primary: string, secondary: string, center = false) => k.row({ name: 'Actions', gap: 12, rgap: 12, wrap: true, main: center ? 'center' : 'start' }, [k.btn(primary, 'primary', { lg: true }), k.btn(secondary, 'secondary', { lg: true })]);

export const MARKETING: LibraryItem[] = [
  // ── Navigation ─────────────────────────────────────────────────────────────
  define('nav', 'nav-simple', 'Simple navbar', 'header menu logo', k => bar(k, {}, [k.logo(), links(k), k.row({ gap: 20, cross: 'center' }, [k.link('Sign in', k.t.text, { hideM: true }), k.btn('Get started'), burger(k)])])),
  define('nav', 'nav-centered', 'Centered logo navbar', 'header menu', k => bar(k, {}, [
    k.row({ name: 'Left', w: 'fill', gap: 32, cross: 'center', hideM: true }, NAV.slice(0, 3).map(name => k.link(name))),
    k.logo(),
    k.row({ name: 'Right', w: 'fill', main: 'end', cross: 'center', gap: 20 }, [k.link('Sign in', k.t.text, { hideM: true }), k.btn('Book a demo')]),
  ])),
  define('nav', 'nav-pill', 'Floating pill navbar', 'header menu rounded glass', k => k.col({ name: 'Navigation', tag: 'nav', w: 'fill', cross: 'center', pad: [20, 64], mpad: [14, 16], bg: k.t.bg }, [
    k.row({ name: 'Pill', w: 'fill', maxW: 920, pad: [10, 10, 10, 24], r: 999, bg: k.t.surface, line: true, shadow: true, main: 'between', cross: 'center' }, [k.logo(), links(k), k.btn('Get started')]),
  ])),
  define('nav', 'nav-inverse', 'Solid navbar', 'header menu dark bold', k => bar(k, { bg: k.t.inv }, [k.logo('Northwind', k.t.onInv), links(k, alpha(k.t.onInv, 'B3')), k.row({ gap: 16, cross: 'center' }, [k.btn('Start free', 'onInv'), burger(k, k.t.onInv)])])),
  define('nav', 'nav-announce', 'Navbar with announcement', 'header banner promo', k => k.col({ name: 'Header', tag: 'header', w: 'fill' }, [
    k.row({ name: 'Announcement', w: 'fill', pad: [10, 20], main: 'center', cross: 'center', gap: 10, bg: k.t.primary }, [
      k.txt('New: Workflows 2.0 is here', { size: 13.5, weight: 500, color: k.t.onPrimary, tag: 'span' }), k.txt('Read more →', { size: 13.5, weight: 700, color: k.t.onPrimary, tag: 'span', hideM: true }),
    ]),
    bar(k, {}, [k.logo(), links(k), k.row({ gap: 16, cross: 'center' }, [k.btn('Try it free'), burger(k)])]),
    k.rule(),
  ])),
  define('nav', 'nav-minimal', 'Minimal wordmark navbar', 'header menu editorial', k => k.col({ name: 'Header', tag: 'header', w: 'fill' }, [
    bar(k, { pad: [26, 64] }, [k.txt('NORTHWIND', { font: 'head', size: 16, ls: 3, lh: 1.2, tag: 'span' }), links(k, k.t.text, ['Work', 'Studio', 'Journal', 'Contact']), burger(k)]),
    k.rule(),
  ])),
  define('nav', 'nav-search', 'App navbar with search', 'header search avatar app', k => bar(k, { pad: [14, 32], line: false }, [
    k.row({ gap: 36, cross: 'center' }, [k.logo(), links(k, k.t.muted, ['Overview', 'Projects', 'Reports'], { hideT: true })]),
    k.input('Search projects, people, files…', { w: 320, pad: [10, 14], hideM: true }),
    k.row({ gap: 14, cross: 'center' }, [k.btn('Upgrade', 'secondary', { hideM: true }), k.avatar(0, 36)]),
  ])),
  define('nav', 'nav-store', 'Two-tier store navbar', 'header shop ecommerce', k => k.col({ name: 'Header', tag: 'header', w: 'fill' }, [
    k.row({ name: 'Utility', w: 'fill', pad: [9, 64], mpad: [9, 20], main: 'between', cross: 'center', bg: k.t.alt }, [k.txt('Free shipping on orders over $50', { size: 13, color: k.t.muted, tag: 'span' }), k.txt('Help · Track order · EN', { size: 13, color: k.t.muted, tag: 'span', hideM: true })]),
    bar(k, {}, [k.logo('Northwind Goods'), links(k, k.t.text, ['New in', 'Living', 'Kitchen', 'Gifts', 'Sale']), k.row({ gap: 22, cross: 'center' }, [k.link('Search', k.t.text, { hideM: true }), k.link('Bag (2)', k.t.text), burger(k)])]),
    k.rule(),
  ])),

  // ── Heroes ─────────────────────────────────────────────────────────────────
  define('hero', 'hero-centered', 'Centered hero', 'landing headline saas', k => k.section('Hero', { py: 120, cross: 'center', gap: 32 }, [
    k.badge('✦ Now in public beta'),
    k.col({ gap: 20, w: 'fill', maxW: 880, cross: 'center' }, [
      k.h1('Ship your next idea before the week is over.', { align: 'center' }),
      k.p('Northwind brings planning, design and delivery into one calm workspace, so small teams can move like big ones.', { align: 'center', size: 20, maxW: 640 }),
    ]),
    heroButtons(k, 'Start for free', 'Watch the film', true),
    k.p('Free for 14 days · No card required', { align: 'center', size: 14 }),
  ])),
  define('hero', 'hero-split', 'Split hero with picture', 'landing image two column', k => k.section('Hero', {}, [
    k.row({ gap: 64, cross: 'center', w: 'fill', stack: true, mobile: { layout: { gap: 40 } } }, [
      k.col({ gap: 24, w: 'fill' }, [k.eyebrow('Design studio'), k.h1('Brands people feel before they read a word.', { size: 60 }), k.p('We shape identities, websites and products for founders who care how things are made.', { size: 19 }), heroButtons(k, 'Start a project', 'See our work')]),
      k.img(0, { h: 520, mobile: { height: 300 } }),
    ]),
  ])),
  define('hero', 'hero-glow', 'Glow hero with gradient title', 'landing gradient aurora modern', k => k.section('Hero', { py: 140, cross: 'center', gap: 28, deco: [k.glow(-320, -260, 760), k.glow(260, -120, 600, k.t.primary)] }, [
    k.badge('Introducing Northwind AI'),
    k.h1('Your whole workflow, one prompt away.', { align: 'center', size: 76, maxW: 900, grad: lin(100, k.t.text, k.t.accent) }),
    k.p('Describe what you need and watch a working first draft appear. Then refine it together.', { align: 'center', size: 20, maxW: 600 }),
    heroButtons(k, 'Try it now', 'Read the docs', true),
  ])),
  define('hero', 'hero-bigtype', 'Oversized type hero', 'landing bold typography agency', k => k.section('Hero', { py: 80, gap: 48 }, [
    k.h1('Make\nsomething\nworth keeping.', { size: 132, upper: true, lh: 0.95 }),
    k.rule(),
    k.row({ w: 'fill', main: 'between', cross: 'end', gap: 32, stack: true }, [k.p('An independent studio for identity, web and motion. Currently booking projects for spring.', { maxW: 460, size: 19 }), k.btn('Start a project →', 'primary', { lg: true })]),
  ])),
  define('hero', 'hero-stats', 'Hero with stats', 'landing numbers metrics', k => k.section('Hero', { py: 112, cross: 'center', gap: 56 }, [
    k.col({ gap: 22, w: 'fill', maxW: 820, cross: 'center' }, [k.eyebrow('For modern finance teams'), k.h1('Close the books in days, not weeks.', { align: 'center' }), k.p('Automated reconciliation, live reporting and approvals your auditors will love.', { align: 'center', size: 20, maxW: 580 }), k.btn('Book a demo', 'primary', { lg: true })]),
    k.rule(),
    k.grid(3, { w: 'fill', maxW: 900, gap: 32, tcols: 3, mcols: 1 }, [stat(k, '12k+', 'teams onboard', { center: true }), stat(k, '99.99%', 'uptime last year', { center: true }), stat(k, '4.9/5', 'average rating', { center: true })]),
  ])),
  define('hero', 'hero-capture', 'Hero with email capture', 'landing waitlist newsletter signup', k => k.section('Hero', { py: 112, bg: k.t.alt, cross: 'center', gap: 32 }, [
    k.h1('Be first to try the new Northwind.', { align: 'center', maxW: 800 }),
    k.p('Join the waitlist and get early access, founder pricing and a say in what we build next.', { align: 'center', size: 20, maxW: 580 }),
    k.row({ name: 'Signup', gap: 10, w: 'fill', maxW: 480, stack: true }, [k.input('you@company.com'), k.btn('Join waitlist', 'primary', { mfill: true })]),
    k.row({ gap: 12, cross: 'center' }, [k.row({ gap: 4 }, [0, 1, 2, 3].map(i => k.avatar(i, 28))), k.txt('Joined by 4,200+ makers', { size: 14, color: k.t.muted, tag: 'span' })]),
  ])),
  define('hero', 'hero-product', 'Hero with product shot', 'landing screenshot app saas', k => k.section('Hero', { cross: 'center', gap: 56 }, [
    k.col({ gap: 22, w: 'fill', maxW: 820, cross: 'center' }, [k.badge('New · Version 3.0'), k.h1('The dashboard your team will actually read.', { align: 'center', size: 60 }), k.p('Connect your data in two clicks and share live reports with anyone.', { align: 'center', size: 20, maxW: 560 }), heroButtons(k, 'Get started', 'Live demo', true)]),
    k.col({ name: 'Product shot', w: 'fill', pad: 12, r: k.t.r + 8, bg: k.t.surface, line: true, shadow: true }, [k.img(0, { h: 560, mobile: { height: 220 } })]),
  ])),
  define('hero', 'hero-inverse', 'Bold color hero', 'landing dark inverse statement', k => k.section('Hero', { py: 128, bg: k.t.inv, gap: 28 }, [
    k.eyebrow('Since 2014', { color: alpha(k.t.onInv, 'B3') }),
    k.h1('We build software for people who build things.', { color: k.t.onInv, maxW: 940, size: 72 }),
    k.p('From job sites to workshops, Northwind keeps crews, schedules and materials in sync.', { color: alpha(k.t.onInv, 'B3'), maxW: 580, size: 20 }),
    k.row({ gap: 12, rgap: 12, wrap: true }, [k.btn('Get a quote', 'onInv', { lg: true }), outline(k, 'Talk to sales', k.t.onInv)]),
  ])),
  define('hero', 'hero-editorial', 'Editorial hero', 'landing magazine serif minimal', k => k.section('Hero', { gap: 56 }, [
    k.row({ w: 'fill', main: 'between', cross: 'center' }, [k.eyebrow('Issue 07 — Autumn'), k.txt('Scroll ↓', { size: 14, color: k.t.muted, tag: 'span' })]),
    k.h1('The quiet craft of making things that last.', { size: 104, lh: 1 }),
    k.rule(),
    k.grid(3, { gap: 40, w: 'fill' }, [['01', 'Materials', 'Stories from the workshops still doing it by hand.'], ['02', 'People', 'Conversations with makers on patience and practice.'], ['03', 'Places', 'A slow guide to studios worth travelling for.']].map(([n, title, body]) => k.col({ name: title, gap: 10, w: 'fill' }, [k.txt(n, { size: 14, color: k.t.accent, weight: 600, tag: 'span' }), k.h3(title), k.p(body, { size: 16 })]))),
  ])),
  define('hero', 'hero-cards', 'Hero with floating cards', 'landing cards playful product', k => k.section('Hero', {}, [
    k.row({ gap: 64, cross: 'center', w: 'fill', stack: true, mobile: { layout: { gap: 40 } } }, [
      k.col({ gap: 24, w: 'fill' }, [k.badge('Rated 4.9 by 2,300 teams'), k.h1('Know your numbers without opening a spreadsheet.', { size: 58 }), k.p('Revenue, churn and runway on one page that updates itself.', { size: 19 }), heroButtons(k, 'Start free', 'See pricing')]),
      k.col({ name: 'Cards', w: 'fill', gap: 20, cross: 'center' }, [
        k.card({ name: 'Revenue card', w: 360, rot: -3, shadow: true, gap: 10, mfill: true }, [k.txt('Monthly revenue', { size: 14, color: k.t.muted, tag: 'span' }), k.txt('$48,290', { font: 'head', size: 40, lh: 1.1 }), k.badge('▲ 12.4% vs last month', '#16A34A')]),
        k.card({ name: 'Quote card', w: 360, rot: 2, shadow: true, mfill: true }, [k.p('“Finally a finance tool I look forward to opening.”', { color: k.t.text, size: 16 }), person(k, 1, 'Maya Okafor', 'CFO, Lumina')]),
      ]),
    ]),
  ])),

  // ── Features ───────────────────────────────────────────────────────────────
  define('feature', 'feature-cards', 'Feature cards', 'benefits three column icons', k => k.section('Features', { bg: k.t.alt, cross: 'center' }, [
    k.intro('Why Northwind', 'Everything you need, nothing you do not.', 'Powerful enough for experts and simple enough for day one.', { center: true }),
    k.grid(3, { gap: 24, w: 'fill' }, FEATURES.slice(0, 3).map(([title, body], i) => k.card({ name: title, h: 'fill', pad: 32 }, [k.icon(GLYPHS[i]), k.h3(title), k.p(body, { size: 16 })]))),
  ])),
  define('feature', 'feature-grid', 'Feature grid', 'benefits two column list icons', k => k.section('Features', {}, [
    k.intro('Features', 'Built for the way teams really work.'),
    k.grid(2, { gap: 48, rgap: 48, w: 'fill' }, FEATURES.slice(0, 4).map(([title, body], i) => k.row({ name: title, gap: 18, w: 'fill' }, [k.icon(GLYPHS[i]), k.col({ gap: 8, w: 'fill' }, [k.h3(title), k.p(body, { size: 16 })])]))),
  ])),
  define('feature', 'feature-split', 'Feature with picture and checklist', 'benefits image two column', k => k.section('Feature', {}, [
    k.row({ gap: 72, cross: 'center', w: 'fill', stack: true, mobile: { layout: { gap: 36 } } }, [
      k.img(1, { h: 480, mobile: { height: 280 } }),
      k.col({ gap: 24, w: 'fill' }, [k.eyebrow('Collaboration'), k.h2('One place for every decision.'), k.p('Stop digging through chat threads. Decisions, files and feedback live next to the work.'), k.col({ gap: 12, w: 'fill' }, ['Threaded comments on anything', 'Approvals with one click', 'Version history that reads like a story', 'Guest access for clients'].map(point => k.check(point))), k.btn('Explore collaboration')]),
    ]),
  ])),
  define('feature', 'feature-bento', 'Bento feature grid', 'benefits cards mosaic modern', k => k.section('Features', { bg: k.t.alt, cross: 'center' }, [
    k.intro('Platform', 'A toolkit that grows with you.', null, { center: true }),
    k.col({ gap: 24, w: 'fill' }, [
      k.row({ gap: 24, w: 'fill', stack: true }, [
        k.card({ name: 'Large card', h: 'fill', pad: 36, gap: 18 }, [k.badge('Core'), k.h3('Workflows that run themselves', { size: 30 }), k.p('Chain triggers, approvals and updates without writing code.'), k.img(0, { h: 180 })]),
        k.col({ gap: 24, w: 'fill' }, FEATURES.slice(3, 5).map(([title, body], i) => k.card({ name: title, pad: 32 }, [k.icon(GLYPHS[i + 3]), k.h3(title), k.p(body, { size: 16 })]))),
      ]),
      k.grid(3, { gap: 24, w: 'fill' }, [['120+', 'integrations'], ['30 sec', 'average setup'], ['24/7', 'human support']].map(([value, label]) => k.card({ name: label, h: 'fill', gap: 6, pad: 32 }, [k.txt(value, { font: 'head', size: 40, lh: 1.1 }), k.p(label, { size: 16 })]))),
    ]),
  ])),
  define('feature', 'feature-steps', 'Numbered steps', 'how it works process three', k => k.section('How it works', {}, [
    k.intro('How it works', 'Up and running in three steps.'),
    k.grid(3, { gap: 40, w: 'fill' }, [['Connect', 'Link the tools you already use. It takes about two minutes.'], ['Customize', 'Pick a template and shape it around how your team works.'], ['Launch', 'Invite everyone and start shipping the same afternoon.']].map(([title, body], i) => k.col({ name: title, gap: 16, w: 'fill' }, [k.txt('0' + (i + 1), { font: 'head', size: 56, color: k.t.accent, lh: 1 }), k.rule(), k.h3(title), k.p(body, { size: 16 })]))),
  ])),
  define('feature', 'feature-list', 'Feature list with intro', 'benefits rows sticky two column', k => k.section('Features', {}, [
    k.row({ gap: 80, w: 'fill', stack: true, mobile: { layout: { gap: 32 } } }, [
      k.col({ gap: 20, w: 'fill', maxW: 400 }, [k.eyebrow('Capabilities'), k.h2('Serious tools, friendly surface.', { size: 40 }), k.p('Everything is one click away and nothing gets in your way.'), k.btn('See all features →', 'ghost')]),
      k.col({ w: 'fill' }, FEATURES.slice(0, 4).flatMap(([title, body], i) => [k.col({ name: title, gap: 8, w: 'fill', pad: [24, 0] }, [k.row({ w: 'fill', main: 'between', cross: 'center' }, [k.h3(title, { w: 'hug' }), k.txt('0' + (i + 1), { size: 14, color: k.t.muted, tag: 'span' })]), k.p(body, { size: 16 })]), k.rule()])),
    ]),
  ])),
  define('feature', 'feature-minimal', 'Four-column features', 'benefits icons simple centered', k => k.section('Features', { cross: 'center' }, [
    k.intro(null, 'Small details, big difference.', null, { center: true }),
    k.grid(4, { gap: 32, rgap: 40, w: 'fill', tcols: 2, mcols: 1 }, FEATURES.slice(0, 4).map(([title, body], i) => k.col({ name: title, gap: 12, w: 'fill', cross: 'center' }, [k.icon(GLYPHS[i], 52), k.h3(title, { align: 'center', size: 19 }), k.p(body, { align: 'center', size: 15 })]))),
  ])),
  define('feature', 'feature-alternating', 'Alternating feature rows', 'benefits image zigzag', k => k.section('Features', { gap: 96 }, [0, 1].map(i => {
    const text = k.col({ gap: 20, w: 'fill' }, [k.eyebrow(i ? 'Reporting' : 'Planning'), k.h2(i ? 'Answers, not just charts.' : 'See the whole quarter at a glance.', { size: 40 }), k.p(i ? 'Ask a question in plain language and get a report you can share in seconds.' : 'Timelines, owners and dependencies stay in sync as plans change.'), k.btn('Learn more →', 'ghost')]);
    const picture = k.img(i, { h: 420, mobile: { height: 260 } });
    return k.row({ name: i ? 'Row two' : 'Row one', gap: 72, cross: 'center', w: 'fill', stack: true, mobile: { layout: { gap: 32 } } }, i ? [picture, text] : [text, picture]);
  }))),

  // ── Logos & stats ──────────────────────────────────────────────────────────
  define('proof', 'logos-row', 'Logo row', 'customers brands trusted', k => k.section('Logos', { py: 56, cross: 'center', gap: 28 }, [
    k.p('Trusted by teams at', { align: 'center', size: 14 }),
    k.row({ gap: 56, rgap: 20, wrap: true, main: 'center', cross: 'center', w: 'fill' }, LOGOS.map(name => wordmark(k, name))),
  ])),
  define('proof', 'logos-grid', 'Logo grid', 'customers brands cards', k => k.section('Logos', { bg: k.t.alt, cross: 'center' }, [
    k.intro(null, 'Loved by fast-moving teams.', null, { center: true, size: 36 }),
    k.grid(3, { gap: 16, w: 'fill', maxW: 900, tcols: 3, mcols: 2 }, LOGOS.map(name => k.row({ name, w: 'fill', pad: [28, 12], main: 'center', cross: 'center', r: k.t.r, bg: k.t.surface, line: true }, [wordmark(k, name)]))),
  ])),
  define('proof', 'stats-row', 'Stats row', 'numbers metrics counters', k => k.section('Stats', { py: 72 }, [
    k.grid(4, { gap: 32, rgap: 32, w: 'fill', tcols: 2, mcols: 2 }, [stat(k, '2.4M', 'tasks completed'), stat(k, '180+', 'countries'), stat(k, '35%', 'faster delivery'), stat(k, '24/7', 'support')]),
  ])),
  define('proof', 'stats-cards', 'Stat cards', 'numbers metrics growth', k => k.section('Stats', { bg: k.t.alt }, [
    k.intro('By the numbers', 'Results our customers see in the first quarter.'),
    k.grid(3, { gap: 24, w: 'fill' }, [['Hours saved per week', '11.5', '▲ 18%'], ['Faster approvals', '3.2×', '▲ 40%'], ['Return on investment', '412%', '▲ 22%']].map(([label, value, change]) => k.card({ name: label, h: 'fill', gap: 10, pad: 32 }, [k.p(label, { size: 15 }), k.txt(value, { font: 'head', size: 52, lh: 1.05 }), k.badge(change + ' this year', '#16A34A')]))),
  ])),
  define('proof', 'stats-split', 'Big number with quote', 'numbers satisfaction testimonial', k => k.section('Stats', {}, [
    k.row({ gap: 72, cross: 'center', w: 'fill', stack: true, mobile: { layout: { gap: 28 } } }, [
      k.col({ w: 'fill', gap: 8 }, [k.txt('98%', { font: 'head', size: 150, color: k.t.accent, lh: 0.95 }), k.h3('of customers renew after their first year.')]),
      k.col({ w: 'fill', gap: 24 }, [k.p('“We measured it ourselves: fewer meetings, faster launches and a team that finally knows what everyone else is doing.”', { size: 22, color: k.t.text, lh: 1.5 }), person(k, 0, 'Sofia Lindqvist', 'Operations Lead, Polar')]),
    ]),
  ])),
  define('proof', 'stats-inverse', 'Stats band', 'numbers metrics dark banner', k => k.section('Stats', { py: 80, bg: k.t.inv }, [
    k.grid(3, { gap: 40, rgap: 32, w: 'fill', tcols: 3, mcols: 1 }, [['$2.1B', 'processed for customers'], ['40k', 'active workspaces'], ['< 2 min', 'median support reply']].map(([value, label]) => stat(k, value, label, { color: k.t.onInv, muted: alpha(k.t.onInv, 'A6'), center: true, size: 56 }))),
  ])),

  // ── Testimonials ───────────────────────────────────────────────────────────
  define('testimonial', 'quote-single', 'Large single quote', 'review customer centered', k => k.section('Testimonial', { py: 112, bg: k.t.alt, cross: 'center', gap: 32 }, [
    k.stars(), k.txt('“' + QUOTES[0][0] + '”', { font: 'head', size: 40, align: 'center', w: 'fill', maxW: 900, lh: 1.25 }), person(k, 0, QUOTES[0][1], QUOTES[0][2]),
  ])),
  define('testimonial', 'quote-cards', 'Testimonial cards', 'reviews customers three', k => k.section('Testimonials', { cross: 'center' }, [
    k.intro('Customers', 'Teams that switched never looked back.', null, { center: true }),
    k.grid(3, { gap: 24, w: 'fill' }, QUOTES.slice(0, 3).map(([quote, name, role], i) => k.card({ name, h: 'fill', gap: 20, pad: 32 }, [k.stars(), k.p('“' + quote + '”', { color: k.t.text, size: 17 }), person(k, i, name, role)]))),
  ])),
  define('testimonial', 'quote-split', 'Quote with portrait', 'review customer image', k => k.section('Testimonial', {}, [
    k.row({ gap: 64, cross: 'center', w: 'fill', stack: true, mobile: { layout: { gap: 32 } } }, [
      k.img(2, { w: 400, h: 460, mfill: true, mobile: { height: 300 } }),
      k.col({ gap: 24, w: 'fill' }, [k.txt('“', { font: 'head', size: 110, color: k.t.accent, lh: 0.6, fixed: true }), k.txt(QUOTES[1][0], { font: 'head', size: 34, w: 'fill', lh: 1.25 }), person(k, 2, QUOTES[1][1], QUOTES[1][2])]),
    ]),
  ])),
  define('testimonial', 'quote-wall', 'Wall of love', 'reviews customers masonry many', k => k.section('Testimonials', { bg: k.t.alt, cross: 'center' }, [
    k.intro(null, 'Kind words from people we admire.', null, { center: true }),
    k.grid(3, { gap: 20, w: 'fill' }, QUOTES.map(([quote, name, role], i) => k.card({ name, gap: 18 }, [k.p('“' + quote + '”', { color: k.t.text, size: 16 }), person(k, i, name, role)]))),
  ])),
  define('testimonial', 'rating-strip', 'Rating strip', 'reviews stars social proof', k => k.section('Rating', { py: 56, cross: 'center', gap: 16 }, [
    k.row({ gap: 6 }, [0, 1, 2, 3, 4].map(i => k.avatar(i, 36))),
    k.row({ gap: 12, rgap: 6, cross: 'center', wrap: true, main: 'center' }, [k.stars(), k.txt('4.9 out of 5', { size: 16, weight: 600, tag: 'span' }), k.txt('from 2,300+ reviews', { size: 15, color: k.t.muted, tag: 'span' })]),
  ])),

  // ── Pricing ────────────────────────────────────────────────────────────────
  define('pricing', 'pricing-three', 'Three pricing tiers', 'plans cards subscription', k => k.section('Pricing', { bg: k.t.alt, cross: 'center' }, [
    k.intro('Pricing', 'Simple plans that scale with you.', 'Start free. Upgrade when your team is ready.', { center: true }),
    k.grid(3, { gap: 24, w: 'fill' }, PLANS(k)),
  ])),
  define('pricing', 'pricing-two', 'Two pricing tiers', 'plans cards subscription', k => k.section('Pricing', { cross: 'center' }, [
    k.intro('Pricing', 'Pick the plan that fits.', null, { center: true }),
    k.grid(2, { gap: 24, w: 'fill', maxW: 860 }, PLANS(k).slice(0, 2)),
  ])),
  define('pricing', 'pricing-single', 'Single plan', 'plans one price all inclusive', k => k.section('Pricing', { cross: 'center', bg: k.t.alt }, [
    k.intro(null, 'One plan. Everything included.', null, { center: true }),
    k.card({ name: 'Plan', maxW: 900, pad: 40 }, [
      k.row({ gap: 48, w: 'fill', cross: 'center', stack: true, mobile: { layout: { gap: 28 } } }, [
        k.col({ w: 'fill', gap: 16 }, [k.h3('Northwind Complete', { size: 28 }), k.p('Every feature, unlimited seats and priority support.', { size: 16 }), k.row({ gap: 6, cross: 'end' }, [k.txt('$49', { font: 'head', size: 56, lh: 1 }), k.txt('/month', { size: 15, color: k.t.muted, tag: 'span' })]), k.btn('Start 14-day trial', 'primary', { lg: true })]),
        k.col({ w: 'fill', gap: 12 }, ['Unlimited projects and seats', 'Advanced analytics', 'Single sign-on', 'Custom domains', 'API access', 'Priority support'].map(point => k.check(point))),
      ]),
    ]),
  ])),
  define('pricing', 'pricing-table', 'Comparison table', 'plans compare features rows', k => {
    const cell = (value: string, o = {}) => k.txt(value, { size: 15, w: 'fill', align: 'center', ...o });
    const line = (label: string, values: string[], header = false) => k.row({ name: label, w: 'fill', pad: [16, 24], mpad: [14, 12], gap: 8, cross: 'center', bg: header ? k.t.alt : undefined }, [cell(label, { align: 'left', weight: header ? 600 : 500 }), ...values.map(value => cell(value, { weight: header ? 600 : 400, color: value === '—' ? k.t.muted : k.t.text }))]);
    return k.section('Pricing', {}, [
      k.intro('Compare', 'Find the right plan.'),
      k.col({ name: 'Table', w: 'fill', r: k.t.r, line: true, bg: k.t.surface, clip: true }, [
        line('Features', ['Free', 'Team', 'Scale'], true),
        ...[['Projects', '3', 'Unlimited', 'Unlimited'], ['Team members', '2', '25', 'Unlimited'], ['Analytics', '—', '✓', '✓'], ['Single sign-on', '—', '—', '✓'], ['Support', 'Community', 'Priority', 'Dedicated']].flatMap(([label, ...values]) => [k.rule(), line(label, values)]),
      ]),
    ]);
  }),
  define('pricing', 'pricing-list', 'Pricing rows', 'plans list minimal', k => k.section('Pricing', {}, [
    k.intro('Pricing', 'Honest pricing, no surprises.'),
    k.col({ w: 'fill' }, [k.rule(), ...[['Starter', 'For individuals and side projects.', 'Free'], ['Team', 'For teams shipping every week.', '$24'], ['Scale', 'For companies with many teams.', '$79']].flatMap(([name, desc, price]) => [
      k.row({ name, w: 'fill', pad: [28, 0], gap: 24, cross: 'center', main: 'between', stack: true, mobile: { layout: { gap: 14 } } }, [k.col({ gap: 6, w: 'fill' }, [k.h3(name), k.p(desc, { size: 15 })]), k.txt(price, { font: 'head', size: 32, lh: 1.1 }), k.btn('Choose', 'secondary')]),
      k.rule(),
    ])]),
  ])),

  // ── Calls to action ────────────────────────────────────────────────────────
  define('cta', 'cta-centered', 'Centered call to action', 'signup closing', k => k.section('Call to action', { py: 120, cross: 'center', gap: 28 }, [
    k.h2('Ready to do your best work?', { align: 'center', size: 56, maxW: 760 }), k.p('Join thousands of teams who plan, build and launch with Northwind.', { align: 'center', maxW: 520, size: 19 }), heroButtons(k, 'Start for free', 'Talk to sales', true),
  ])),
  define('cta', 'cta-banner', 'Banner call to action', 'signup card dark rounded', k => k.section('Call to action', { py: 64 }, [
    k.col({ name: 'Banner', w: 'fill', pad: [72, 64], mpad: [48, 24], r: k.t.r + 8, bg: k.t.inv, cross: 'center', gap: 24 }, [
      k.h2('Start building today.', { align: 'center', color: k.t.onInv, maxW: 700, size: 48 }), k.p('Free for 14 days. Set up in minutes. Cancel any time.', { align: 'center', color: alpha(k.t.onInv, 'B3'), size: 18 }), k.btn('Create your workspace', 'onInv', { lg: true }),
    ]),
  ])),
  define('cta', 'cta-split', 'Split call to action', 'signup inline row', k => k.section('Call to action', { py: 80, bg: k.t.alt }, [
    k.row({ w: 'fill', main: 'between', cross: 'center', gap: 32, stack: true }, [k.col({ gap: 10, w: 'fill' }, [k.h2('Have a project in mind?', { size: 36 }), k.p('Tell us about it and we will reply within one working day.')]), k.row({ gap: 12, rgap: 12, wrap: true }, [k.btn('Get in touch', 'primary', { lg: true }), k.btn('View pricing', 'secondary', { lg: true })])]),
  ])),
  define('cta', 'cta-newsletter', 'Newsletter signup', 'email subscribe form', k => k.section('Newsletter', { cross: 'center', gap: 24 }, [
    k.icon('✉', 56), k.h2('Good ideas, once a month.', { align: 'center', size: 40 }), k.p('Product news, field notes and nothing else. Unsubscribe whenever you like.', { align: 'center', maxW: 480 }),
    k.row({ name: 'Signup', gap: 10, w: 'fill', maxW: 460, stack: true }, [k.input('Your email address'), k.btn('Subscribe', 'primary', { mfill: true })]),
  ])),
  define('cta', 'cta-gradient', 'Gradient call to action', 'signup colorful card', k => {
    const color = k.t.dark ? '#FFFFFF' : k.t.text;
    return k.section('Call to action', { py: 64 }, [
      k.col({ name: 'Banner', w: 'fill', pad: [80, 64], mpad: [48, 24], r: k.t.r + 8, bg: lin(120, ...k.t.imgs[1]), gap: 20 }, [k.h2('Make your next launch your best one.', { color, maxW: 640, size: 48 }), k.p('Bring your team, your tools and your ambition. We will handle the rest.', { color: alpha(color, 'CC'), maxW: 520, size: 18 }), k.btn('Get started free', 'primary', { lg: true })]),
    ]);
  }),

  // ── FAQ ────────────────────────────────────────────────────────────────────
  define('faq', 'faq-list', 'FAQ list', 'questions accordion help', k => k.section('FAQ', { cross: 'center' }, [
    k.intro('FAQ', 'Questions, answered.', null, { center: true }),
    k.col({ w: 'fill', maxW: 760 }, [k.rule(), ...FAQS.flatMap(([q, a], i) => faqRow(k, q, a, i === 0))]),
  ])),
  define('faq', 'faq-grid', 'FAQ grid', 'questions two column help', k => k.section('FAQ', { bg: k.t.alt }, [
    k.intro('Support', 'Good to know before you start.'),
    k.grid(2, { gap: 48, rgap: 40, w: 'fill' }, FAQS.slice(0, 4).map(([q, a]) => k.col({ name: q, gap: 10, w: 'fill' }, [k.h3(q, { size: 19 }), k.p(a, { size: 16 })]))),
  ])),
  define('faq', 'faq-split', 'FAQ with side intro', 'questions two column contact', k => k.section('FAQ', {}, [
    k.row({ gap: 80, w: 'fill', stack: true, mobile: { layout: { gap: 32 } } }, [
      k.col({ gap: 20, w: 'fill', maxW: 380 }, [k.h2('Frequently asked questions', { size: 40 }), k.p('Cannot find what you are looking for? Our team is happy to help.'), k.btn('Contact support', 'secondary')]),
      k.col({ w: 'fill' }, [k.rule(), ...FAQS.slice(0, 4).flatMap(([q, a], i) => faqRow(k, q, a, i === 0))]),
    ]),
  ])),

  // ── Footers ────────────────────────────────────────────────────────────────
  define('footer', 'footer-simple', 'Simple footer', 'links copyright', k => k.section('Footer', { py: 40, tag: 'footer' }, [
    k.row({ w: 'fill', main: 'between', cross: 'center', gap: 20, stack: true }, [k.logo(), k.row({ gap: 28, rgap: 10, wrap: true }, ['About', 'Blog', 'Careers', 'Privacy', 'Terms'].map(name => k.link(name))), k.txt('© 2026 Northwind', { size: 14, color: k.t.muted, tag: 'span' })]),
  ])),
  define('footer', 'footer-columns', 'Footer with columns', 'links sitemap', k => k.section('Footer', { py: 72, tag: 'footer', bg: k.t.alt, gap: 48 }, [
    k.row({ gap: 64, w: 'fill', stack: true, mobile: { layout: { gap: 40 } } }, [
      k.col({ gap: 16, w: 'fill', maxW: 320 }, [k.logo(), k.p('The calm workspace for teams that ship.', { size: 15 })]),
      k.grid(3, { gap: 32, rgap: 32, w: 'fill', tcols: 3, mcols: 2 }, [footCol(k, 'Product', ['Features', 'Pricing', 'Changelog', 'Integrations']), footCol(k, 'Company', ['About', 'Careers', 'Press', 'Contact']), footCol(k, 'Resources', ['Docs', 'Guides', 'Community', 'Status'])]),
    ]),
    k.rule(),
    k.row({ w: 'fill', main: 'between', cross: 'center', gap: 12, rgap: 8, wrap: true }, [k.txt('© 2026 Northwind, Inc.', { size: 14, color: k.t.muted, tag: 'span' }), k.row({ gap: 24 }, [k.link('Privacy', k.t.muted, { size: 14 }), k.link('Terms', k.t.muted, { size: 14 })])]),
  ])),
  define('footer', 'footer-newsletter', 'Footer with newsletter', 'links subscribe email', k => k.section('Footer', { py: 80, tag: 'footer', gap: 48 }, [
    k.row({ gap: 64, w: 'fill', cross: 'center', stack: true, mobile: { layout: { gap: 24 } } }, [k.col({ w: 'fill', gap: 10 }, [k.h2('Stay in the loop.', { size: 36 }), k.p('Monthly product updates. No spam, ever.')]), k.row({ gap: 10, w: 'fill', maxW: 440 }, [k.input('Email address'), k.btn('Subscribe')])]),
    k.rule(),
    k.row({ w: 'fill', main: 'between', cross: 'center', gap: 20, stack: true }, [k.logo(), k.row({ gap: 28, rgap: 10, wrap: true }, ['Product', 'Company', 'Docs', 'Privacy'].map(name => k.link(name))), k.txt('© 2026 Northwind', { size: 14, color: k.t.muted, tag: 'span' })]),
  ])),
  define('footer', 'footer-centered', 'Centered footer', 'links social minimal', k => k.section('Footer', { py: 64, tag: 'footer', cross: 'center', gap: 24 }, [
    k.logo(), k.row({ gap: 28, rgap: 10, wrap: true, main: 'center' }, ['Work', 'Studio', 'Journal', 'Contact'].map(name => k.link(name))),
    k.row({ gap: 10 }, ['in', '◎', '▶'].map(glyph => k.icon(glyph, 38, k.t.text))), k.txt('© 2026 Northwind. All rights reserved.', { size: 14, color: k.t.muted, tag: 'span' }),
  ])),
  define('footer', 'footer-inverse', 'Bold footer', 'links sitemap dark', k => {
    const muted = alpha(k.t.onInv, 'A6');
    return k.section('Footer', { py: 72, tag: 'footer', bg: k.t.inv, gap: 48 }, [
      k.row({ gap: 64, w: 'fill', stack: true, mobile: { layout: { gap: 40 } } }, [
        k.col({ gap: 20, w: 'fill', maxW: 360 }, [k.logo('Northwind', k.t.onInv), k.p('Made with care for people who make things.', { size: 15, color: muted }), k.btn('Get started', 'onInv')]),
        k.grid(3, { gap: 32, rgap: 32, w: 'fill', tcols: 3, mcols: 2 }, [footCol(k, 'Product', ['Features', 'Pricing', 'Security'], k.t.onInv, muted), footCol(k, 'Company', ['About', 'Careers', 'Contact'], k.t.onInv, muted), footCol(k, 'Legal', ['Privacy', 'Terms', 'Cookies'], k.t.onInv, muted)]),
      ]),
      k.rule({ bg: alpha(k.t.onInv, '33') }), k.txt('© 2026 Northwind, Inc.', { size: 14, color: muted, tag: 'span' }),
    ]);
  }),
  define('footer', 'footer-wordmark', 'Footer with giant wordmark', 'links big type statement', k => k.section('Footer', { py: 64, tag: 'footer', gap: 40, clip: true }, [
    k.row({ w: 'fill', main: 'between', gap: 32, stack: true }, [k.p('An independent studio for brands, websites and digital products.', { maxW: 360, size: 16 }), k.row({ gap: 64 }, [footCol(k, 'Studio', ['Work', 'About', 'Journal']), footCol(k, 'Say hello', ['Email', 'Instagram', 'LinkedIn'])])]),
    k.rule(),
    k.txt('NORTHWIND', { font: 'head', size: 160, w: 'fill', align: 'center', lh: 0.95, color: alpha(k.t.text, '1F'), mobile: { textStyle: { fontSize: 44 } } }),
  ])),
];
