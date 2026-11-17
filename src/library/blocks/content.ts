import { alpha, type Kit, type Tree } from '../kit';
import { define, type LibraryItem } from '../types';
import { person } from './marketing';

/** Blog, team, galleries, contact, shop and sign-in designs. */

const POSTS: [string, string, string][] = [
  ['Design', 'What we learned redesigning our onboarding', 'Six experiments, two surprises and one change that doubled activation.'],
  ['Engineering', 'How we made search feel instant', 'A tour of the small decisions behind a sub-50ms search box.'],
  ['Company', 'Why we work in six-week cycles', 'Fewer meetings, clearer bets and time to do things properly.'],
  ['Product', 'Introducing shared views', 'Save any filter as a view your whole team can open in one click.'],
];
const TEAM: [string, string][] = [['Maya Okafor', 'Founder & CEO'], ['Daniel Reyes', 'Head of Design'], ['Sofia Lindqvist', 'Engineering Lead'], ['Arjun Mehta', 'Product Manager']];
const PRODUCTS: [string, string][] = [['Oak desk lamp', '$129'], ['Linen throw', '$84'], ['Ceramic pour-over', '$46'], ['Wool slippers', '$68']];

const post = (k: Kit, index: number, height = 220): Tree => {
  const [tag, title, body] = POSTS[index % POSTS.length];
  return k.col({ name: title, gap: 16, w: 'fill', motion: { hover: { type: 'lift' } } }, [k.img(index, { h: height }), k.col({ gap: 8, w: 'fill' }, [k.eyebrow(tag, { size: 12 }), k.h3(title), k.p(body, { size: 15 }), k.txt('6 min read · Mar 12', { size: 13, color: k.t.muted, tag: 'span' })])]);
};
const product = (k: Kit, index: number): Tree => k.col({ name: PRODUCTS[index][0], gap: 12, w: 'fill', motion: { hover: { type: 'lift' } } }, [
  k.img(index, { h: 300, mobile: { height: 220 } }),
  k.row({ w: 'fill', main: 'between', gap: 8 }, [k.txt(PRODUCTS[index][0], { size: 16, weight: 500, w: 'fill' }), k.txt(PRODUCTS[index][1], { size: 16, color: k.t.muted, tag: 'span' })]),
]);
/** Centered sign-in style card on a soft background. */
const authCard = (k: Kit, name: string, kids: (Tree | null)[]) => k.section(name, { py: 96, bg: k.t.alt, cross: 'center' }, [k.card({ name: 'Form', maxW: 440, pad: 40, gap: 20, mpad: 24 }, kids)]);
const divider = (k: Kit, label: string) => k.row({ name: 'Divider', w: 'fill', gap: 12, cross: 'center' }, [k.rule(), k.txt(label, { size: 13, color: k.t.muted, tag: 'span' }), k.rule()]);
const social = (k: Kit, label: string) => k.row({ name: label, w: 'fill', pad: [13, 16], r: Math.min(k.t.br, 12), line: true, main: 'center', cross: 'center', gap: 10 }, [k.shape('ellipse', { w: 16, h: 16, bg: k.t.accent }), k.txt(label, { size: 15, weight: 500, lh: 1.2, tag: 'span' })]);

export const CONTENT: LibraryItem[] = [
  // ── Blog & team ────────────────────────────────────────────────────────────
  define('content', 'blog-cards', 'Blog post cards', 'articles news three', k => k.section('Blog', {}, [
    k.row({ w: 'fill', main: 'between', cross: 'end', gap: 20 }, [k.intro('Journal', 'Latest from the team.'), k.btn('All posts →', 'ghost', { hideM: true })]),
    k.grid(3, { gap: 32, rgap: 40, w: 'fill' }, [0, 1, 2].map(i => post(k, i))),
  ])),
  define('content', 'blog-featured', 'Featured post with list', 'articles news highlight', k => k.section('Blog', { bg: k.t.alt }, [
    k.intro('Journal', 'Stories, notes and how-tos.'),
    k.row({ gap: 48, w: 'fill', stack: true, mobile: { layout: { gap: 32 } } }, [
      post(k, 0, 380),
      k.col({ w: 'fill', gap: 0 }, [1, 2, 3].flatMap(i => [k.col({ name: POSTS[i][1], gap: 8, w: 'fill', pad: [20, 0] }, [k.eyebrow(POSTS[i][0], { size: 12 }), k.h3(POSTS[i][1]), k.p(POSTS[i][2], { size: 15 })]), k.rule()])),
    ]),
  ])),
  define('content', 'blog-list', 'Blog list rows', 'articles news minimal index', k => k.section('Blog', { maxW: 880 }, [
    k.h2('Writing'),
    k.col({ w: 'fill' }, [k.rule(), ...POSTS.flatMap(([tag, title]) => [k.row({ name: title, w: 'fill', pad: [24, 0], gap: 24, cross: 'center', main: 'between', motion: { hover: { type: 'dim' } } }, [k.col({ gap: 6, w: 'fill' }, [k.h3(title), k.txt(tag + ' · 6 min read', { size: 14, color: k.t.muted, tag: 'span' })]), k.txt('→', { size: 22, color: k.t.muted, lh: 1, tag: 'span' })]), k.rule()])]),
  ])),
  define('content', 'blog-two', 'Two large posts', 'articles news big cards', k => k.section('Blog', {}, [k.grid(2, { gap: 40, rgap: 40, w: 'fill', tcols: 2 }, [post(k, 0, 340), post(k, 1, 340)])])),
  define('content', 'team-grid', 'Team grid', 'people about staff', k => k.section('Team', { cross: 'center' }, [
    k.intro('Our team', 'The people behind the product.', 'A small, senior team spread across six time zones.', { center: true }),
    k.grid(4, { gap: 32, rgap: 40, w: 'fill', tcols: 2, mcols: 2 }, TEAM.map(([name, role], i) => k.col({ name, gap: 14, w: 'fill', cross: 'center' }, [k.avatar(i, 120), k.col({ gap: 4, w: 'fill' }, [k.txt(name, { size: 17, weight: 600, w: 'fill', align: 'center' }), k.p(role, { size: 14, align: 'center' })])]))),
  ])),
  define('content', 'team-cards', 'Team cards with photos', 'people about staff portraits', k => k.section('Team', { bg: k.t.alt }, [
    k.intro('Leadership', 'Meet the people you will work with.'),
    k.grid(3, { gap: 24, w: 'fill' }, TEAM.slice(0, 3).map(([name, role], i) => k.card({ name, pad: 12, gap: 0, h: 'fill' }, [k.img(i, { h: 300, r: Math.max(0, k.t.r - 6) }), k.col({ gap: 4, w: 'fill', pad: [18, 12, 12, 12] }, [k.h3(name), k.p(role, { size: 15 })])]))),
  ])),
  define('content', 'team-list', 'Team list', 'people about staff rows', k => k.section('Team', { maxW: 880 }, [
    k.h2('Who we are'),
    k.col({ w: 'fill' }, [k.rule(), ...TEAM.flatMap(([name, role], i) => [k.row({ name, w: 'fill', pad: [20, 0], gap: 16, cross: 'center', main: 'between' }, [person(k, i, name, role), k.link('Say hello →', k.t.text, { hideM: true })]), k.rule()])]),
  ])),

  // ── Galleries ──────────────────────────────────────────────────────────────
  define('gallery', 'gallery-grid', 'Picture grid', 'photos portfolio images', k => k.section('Gallery', {}, [
    k.intro('Selected work', 'A few things we are proud of.'),
    k.grid(3, { gap: 20, w: 'fill', mcols: 2 }, [0, 1, 2, 3, 4, 5].map(i => k.img(i + (i > 2 ? 1 : 0), { h: 300, mobile: { height: 160 }, motion: { hover: { type: 'grow' } } }))),
  ])),
  define('gallery', 'gallery-masonry', 'Masonry gallery', 'photos portfolio staggered', k => k.section('Gallery', { bg: k.t.alt }, [
    k.row({ gap: 20, w: 'fill' }, [[360, 240], [240, 380], [300, 300]].map((heights, c) => k.col({ name: 'Column ' + (c + 1), gap: 20, w: 'fill', ...(c === 2 ? { hideM: true } : {}) }, heights.map((h, i) => k.img(c + i, { h, mobile: { height: Math.round(h * 0.6) } })))),
    ),
  ])),
  define('gallery', 'gallery-projects', 'Project list with thumbnails', 'portfolio case studies rows', k => k.section('Projects', {}, [
    k.h2('Case studies'),
    k.col({ w: 'fill' }, [k.rule(), ...[['Lumina', 'Brand identity', '2026'], ['Vertex', 'Product design', '2025'], ['Polar', 'Website & CMS', '2025']].flatMap(([name, kind, year], i) => [
      k.row({ name, w: 'fill', pad: [24, 0], gap: 28, cross: 'center', motion: { hover: { type: 'dim' } } }, [k.img(i, { w: 160, h: 104, mobile: { width: 96, height: 72 } }), k.h3(name, { size: 30 }), k.txt(kind, { size: 15, color: k.t.muted, tag: 'span', hideM: true }), k.txt(year, { size: 15, color: k.t.muted, tag: 'span' })]),
      k.rule(),
    ])]),
  ])),
  define('gallery', 'gallery-showcase', 'Showcase mosaic', 'portfolio feature large images', k => k.section('Showcase', {}, [
    k.row({ gap: 20, w: 'fill', stack: true }, [k.img(0, { h: 520, mobile: { height: 280 } }), k.col({ gap: 20, w: 'fill' }, [k.img(1, { h: 250, mobile: { height: 180 } }), k.img(2, { h: 250, mobile: { height: 180 } })])]),
    k.row({ w: 'fill', main: 'between', cross: 'center', gap: 20, stack: true }, [k.col({ gap: 6, w: 'fill' }, [k.h3('Harbour House', { size: 28 }), k.p('Identity, wayfinding and website for a waterfront hotel.', { size: 16 })]), k.btn('View project →', 'secondary')]),
  ])),

  // ── Contact ────────────────────────────────────────────────────────────────
  define('contact', 'contact-form', 'Contact form', 'message email form', k => k.section('Contact', { bg: k.t.alt, cross: 'center' }, [
    k.intro('Contact', 'Tell us about your project.', 'We reply within one working day.', { center: true }),
    k.card({ name: 'Form', maxW: 640, pad: 36, gap: 20, mpad: 24 }, [k.row({ gap: 16, w: 'fill', stack: true }, [k.field('Name', 'Jane Doe'), k.field('Email', 'jane@company.com')]), k.field('Company', 'Where do you work?'), k.field('Message', 'What can we help with?', { pad: [13, 16, 72, 16], cross: 'start' }), k.btn('Send message', 'primary', { w: 'fill', lg: true })]),
  ])),
  define('contact', 'contact-split', 'Contact details with form', 'message email address two column', k => k.section('Contact', {}, [
    k.row({ gap: 72, w: 'fill', stack: true, mobile: { layout: { gap: 40 } } }, [
      k.col({ gap: 28, w: 'fill' }, [k.col({ gap: 16, w: 'fill' }, [k.eyebrow('Get in touch'), k.h2('Let us talk.'), k.p('Questions, ideas or just a hello. We would love to hear from you.')]),
        k.col({ gap: 18, w: 'fill' }, [['✉', 'hello@northwind.example'], ['☎', '+1 (555) 010-2030'], ['⌂', '18 Harbour Street, Lisbon']].map(([glyph, value]) => k.row({ name: value, gap: 14, cross: 'center' }, [k.icon(glyph, 40), k.txt(value, { size: 16, tag: 'span' })])))]),
      k.card({ name: 'Form', pad: 32, gap: 18, mpad: 24 }, [k.field('Name', 'Your name'), k.field('Email', 'you@example.com'), k.field('Message', 'How can we help?', { pad: [13, 16, 72, 16], cross: 'start' }), k.btn('Send message', 'primary', { w: 'fill' })]),
    ]),
  ])),
  define('contact', 'contact-cards', 'Contact option cards', 'support email phone chat', k => k.section('Contact', { cross: 'center' }, [
    k.intro(null, 'How can we help?', null, { center: true }),
    k.grid(3, { gap: 24, w: 'fill' }, [['✉', 'Email us', 'For anything that is not urgent.', 'hello@northwind.example'], ['☏', 'Call sales', 'Mon to Fri, 9am to 6pm.', '+1 (555) 010-2030'], ['✦', 'Live chat', 'Usually replies in two minutes.', 'Start a chat →']].map(([glyph, title, body, action]) => k.card({ name: title, h: 'fill', pad: 32 }, [k.icon(glyph), k.h3(title), k.p(body, { size: 15 }), k.txt(action, { size: 15, weight: 600, color: k.t.accent, tag: 'span' })]))),
  ])),
  define('contact', 'contact-location', 'Location with map', 'address office visit hours', k => k.section('Visit', { bg: k.t.alt }, [
    k.row({ gap: 48, w: 'fill', cross: 'center', stack: true, mobile: { layout: { gap: 32 } } }, [
      k.img(1, { name: 'Map', h: 420, mobile: { height: 240 } }),
      k.col({ gap: 24, w: 'fill', maxW: 420 }, [k.h2('Come say hello.', { size: 40 }), k.col({ gap: 6, w: 'fill' }, [k.txt('Studio', { size: 14, weight: 600, tag: 'span' }), k.p('18 Harbour Street\n1200-109 Lisbon, Portugal', { size: 16 })]), k.col({ gap: 6, w: 'fill' }, [k.txt('Hours', { size: 14, weight: 600, tag: 'span' }), k.p('Monday to Friday\n9:00 – 18:00', { size: 16 })]), k.btn('Get directions →', 'secondary')]),
    ]),
  ])),

  // ── Shop ───────────────────────────────────────────────────────────────────
  define('shop', 'shop-grid', 'Product grid', 'ecommerce store items', k => k.section('Products', {}, [
    k.row({ w: 'fill', main: 'between', cross: 'end', gap: 20 }, [k.h2('New arrivals', { size: 40 }), k.btn('Shop all →', 'ghost', { hideM: true })]),
    k.grid(4, { gap: 24, rgap: 36, w: 'fill', tcols: 2, mcols: 2 }, [0, 1, 2, 3].map(i => product(k, i))),
  ])),
  define('shop', 'shop-product', 'Product detail', 'ecommerce store buy', k => k.section('Product', {}, [
    k.row({ gap: 64, w: 'fill', stack: true, mobile: { layout: { gap: 32 } } }, [
      k.img(0, { h: 560, mobile: { height: 340 } }),
      k.col({ gap: 22, w: 'fill', maxW: 480 }, [k.badge('Back in stock'), k.h1('Oak desk lamp', { size: 44 }), k.row({ gap: 12, cross: 'center' }, [k.stars(), k.txt('128 reviews', { size: 14, color: k.t.muted, tag: 'span' })]), k.txt('$129', { font: 'head', size: 32, lh: 1.1 }), k.p('Hand-turned oak base with a warm dimmable light. Made to order in small batches.', { size: 16 }),
        k.row({ gap: 10 }, ['Oak', 'Walnut', 'Ash'].map((name, i) => k.row({ name, pad: [10, 18], r: Math.min(k.t.br, 12), line: i === 0 ? k.t.text : true }, [k.txt(name, { size: 14, weight: 500, lh: 1.2, tag: 'span' })]))),
        k.btn('Add to bag', 'primary', { w: 'fill', lg: true }), k.col({ gap: 10, w: 'fill' }, ['Free shipping over $50', '30-day returns', '2-year guarantee'].map(point => k.check(point, k.t.muted)))]),
    ]),
  ])),
  define('shop', 'shop-categories', 'Category tiles', 'ecommerce store collections', k => k.section('Categories', { bg: k.t.alt }, [
    k.h2('Shop by room', { size: 40 }),
    k.grid(3, { gap: 24, w: 'fill' }, ['Living', 'Kitchen', 'Bedroom'].map((name, i) => k.col({ name, w: 'fill', gap: 14, motion: { hover: { type: 'lift' } } }, [k.img(i, { h: 360, mobile: { height: 220 } }), k.row({ w: 'fill', main: 'between', cross: 'center' }, [k.h3(name, { w: 'hug' }), k.txt('Shop →', { size: 15, color: k.t.muted, tag: 'span' })])]))),
  ])),
  define('shop', 'shop-cart', 'Cart summary', 'ecommerce checkout order bag', k => k.section('Cart', { cross: 'center', bg: k.t.alt }, [
    k.card({ name: 'Order summary', maxW: 520, pad: 32, gap: 20, mpad: 22 }, [
      k.h3('Your bag', { size: 26 }),
      ...PRODUCTS.slice(0, 2).map(([name, price], i) => k.row({ name, w: 'fill', gap: 16, cross: 'center' }, [k.img(i, { w: 64, h: 64, r: Math.min(k.t.r, 10) }), k.col({ gap: 2, w: 'fill' }, [k.txt(name, { size: 15, weight: 500, w: 'fill' }), k.txt('Qty 1', { size: 13, color: k.t.muted, tag: 'span' })]), k.txt(price, { size: 15, tag: 'span' })])),
      k.rule(),
      ...[['Subtotal', '$213'], ['Shipping', 'Free']].map(([label, value]) => k.row({ name: label, w: 'fill', main: 'between' }, [k.txt(label, { size: 15, color: k.t.muted, tag: 'span' }), k.txt(value, { size: 15, tag: 'span' })])),
      k.row({ name: 'Total', w: 'fill', main: 'between', cross: 'center' }, [k.txt('Total', { size: 17, weight: 600, tag: 'span' }), k.txt('$213', { font: 'head', size: 26, lh: 1.1 })]),
      k.btn('Checkout', 'primary', { w: 'fill', lg: true }),
    ]),
  ])),

  // ── Sign in & sign up ──────────────────────────────────────────────────────
  define('auth', 'auth-signin', 'Sign-in card', 'login form account', k => authCard(k, 'Sign in', [
    k.col({ gap: 8, w: 'fill', cross: 'center' }, [k.logo(), k.h3('Welcome back', { size: 26, align: 'center' }), k.p('Sign in to continue to your workspace.', { size: 15, align: 'center' })]),
    k.field('Email', 'you@company.com'), k.field('Password', '••••••••'),
    k.row({ w: 'fill', main: 'between' }, [k.txt('☐ Remember me', { size: 14, color: k.t.muted, tag: 'span' }), k.txt('Forgot password?', { size: 14, weight: 500, color: k.t.accent, tag: 'span' })]),
    k.btn('Sign in', 'primary', { w: 'fill', lg: true }), k.p('New here? Create an account', { size: 14, align: 'center' }),
  ])),
  define('auth', 'auth-signup', 'Sign-up card with social', 'register form account google', k => authCard(k, 'Sign up', [
    k.col({ gap: 8, w: 'fill' }, [k.h3('Create your account', { size: 26 }), k.p('Free for 14 days. No card required.', { size: 15 })]),
    social(k, 'Continue with Google'), divider(k, 'or'),
    k.field('Full name', 'Jane Doe'), k.field('Work email', 'jane@company.com'), k.field('Password', 'At least 8 characters'),
    k.btn('Create account', 'primary', { w: 'fill', lg: true }), k.p('By signing up you agree to our Terms and Privacy Policy.', { size: 13, align: 'center' }),
  ])),
  define('auth', 'auth-split', 'Split sign-in with quote', 'login form two column image', k => k.row({ name: 'Sign in', tag: 'section', w: 'fill', bg: k.t.bg, stack: true }, [
    k.col({ name: 'Form side', w: 'fill', pad: [96, 64], mpad: [48, 20], cross: 'center', main: 'center', minH: 720, mobile: { minHeight: 0 } }, [
      k.col({ gap: 20, w: 'fill', maxW: 380 }, [k.logo(), k.col({ gap: 8, w: 'fill' }, [k.h3('Sign in to Northwind', { size: 28 }), k.p('Enter your details to continue.', { size: 15 })]), k.field('Email', 'you@company.com'), k.field('Password', '••••••••'), k.btn('Sign in', 'primary', { w: 'fill', lg: true }), social(k, 'Sign in with Google')]),
    ]),
    k.col({ name: 'Quote side', w: 'fill', h: 'fill', pad: 64, main: 'end', gap: 20, bg: k.t.inv, hideM: true }, [k.txt('“The first tool our whole team agreed on.”', { font: 'head', size: 36, color: k.t.onInv, w: 'fill', lh: 1.2 }), person(k, 0, 'Daniel Reyes', 'CTO, Vertex', k.t.onInv, alpha(k.t.onInv, 'A6'))]),
  ])),
  define('auth', 'auth-magic', 'Magic link sign-in', 'login passwordless email', k => authCard(k, 'Magic link', [
    k.icon('✉', 52), k.col({ gap: 8, w: 'fill' }, [k.h3('Sign in with email', { size: 26 }), k.p('We will send you a link. No password needed.', { size: 15 })]),
    k.field('Email', 'you@company.com'), k.btn('Send magic link', 'primary', { w: 'fill', lg: true }),
  ])),
];
