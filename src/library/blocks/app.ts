import { alpha, type F, type Kit, type Tree, HASH } from '../kit';
import { define, type LibraryItem } from '../types';
import { person } from './marketing';

/** Sidebars, dashboard widgets and small interface elements. */

const GREEN = '#16A34A', AMBER = '#D97706', RED = '#DC2626';
const MENU: [string, string][] = [['◧', 'Overview'], ['▤', 'Projects'], ['◷', 'Schedule'], ['☺', 'Customers'], ['▥', 'Reports'], ['⚙', 'Settings']];

const navItem = (k: Kit, glyph: string, label: string, active = false, o: { color?: string; muted?: string; count?: string; tint?: string } = {}) => {
  const color = o.color ?? k.t.text, muted = o.muted ?? k.t.muted;
  return k.row({ name: label, link: HASH, w: 'fill', pad: [10, 12], r: Math.min(k.t.br, 10), gap: 12, cross: 'center', bg: active ? o.tint ?? alpha(k.t.accent, '1F') : undefined, motion: { hover: { type: 'dim' } } }, [
    k.txt(glyph, { size: 16, color: active ? color : muted, lh: 1.2, tag: 'span' }), k.txt(label, { size: 15, weight: active ? 600 : 500, color: active ? color : muted, w: 'fill', lh: 1.3 }),
    o.count ? k.badge(o.count) : null,
  ]);
};
const spacer = (k: Kit) => k.col({ name: 'Spacer', w: 'fill', h: 'fill' }, []);
const shell = (k: Kit, o: F, kids: (Tree | null | Tree[])[]) => k.col({ name: 'Sidebar', tag: 'aside', w: 280, h: 720, pad: 20, gap: 6, bg: k.t.surface, line: true, ...o }, kids);

export const sidebar = (k: Kit, o: F = {}): Tree => shell(k, o, [
  k.row({ w: 'fill', pad: [4, 8, 18, 8] }, [k.logo()]),
  ...MENU.map(([glyph, label], i) => navItem(k, glyph, label, i === 0, i === 1 ? { count: '12' } : {})),
  spacer(k), k.rule(), k.row({ w: 'fill', pad: [14, 8, 4, 8] }, [person(k, 0, 'Maya Okafor', 'maya@northwind.example')]),
]);

const delta = (k: Kit, value: string) => k.badge(value, value.startsWith('▼') ? RED : GREEN);
export const statCards = (k: Kit): Tree => k.grid(4, { name: 'Stats', gap: 20, w: 'fill', tcols: 2, mcols: 1 }, [['Revenue', '$84,210', '▲ 12.5%'], ['New customers', '1,284', '▲ 8.1%'], ['Churn', '1.9%', '▼ 0.4%'], ['Avg. order', '$65.40', '▲ 3.2%']].map(([label, value, change]) => k.card({ name: label, gap: 10, pad: 22, h: 'fill' }, [
  k.txt(label, { size: 14, color: k.t.muted, tag: 'span' }), k.txt(value, { font: 'head', size: 30, lh: 1.15, fixed: true }), delta(k, change),
])));
export const chartCard = (k: Kit): Tree => k.card({ name: 'Chart', gap: 20, pad: 24, h: 'fill' }, [
  k.row({ w: 'fill', main: 'between', cross: 'center' }, [k.col({ gap: 2 }, [k.h3('Revenue', { w: 'hug', size: 18 }), k.txt('Last 12 months', { size: 13, color: k.t.muted, tag: 'span' })]), k.badge('▲ 18% vs last year', GREEN)]),
  k.row({ name: 'Bars', w: 'fill', h: 200, gap: 10, cross: 'end' }, [72, 96, 84, 120, 110, 140, 132, 158, 150, 176, 168, 196].map((height, i) => k.shape('rect', { name: 'Bar', w: 'fill', h: height, r: Math.min(k.t.r, 5), bg: i === 11 ? k.t.accent : alpha(k.t.accent, '55') }))),
  k.row({ w: 'fill', main: 'between' }, ['Jan', 'Apr', 'Jul', 'Oct', 'Dec'].map(month => k.txt(month, { size: 12, color: k.t.muted, tag: 'span' }))),
]);
export const tableCard = (k: Kit): Tree => {
  const cell = (value: string, o = {}) => k.txt(value, { size: 14, w: 'fill', ...o });
  const status = (value: string) => k.row({ w: 'fill' }, [k.badge(value, value === 'Paid' ? GREEN : value === 'Pending' ? AMBER : RED)]);
  return k.card({ name: 'Table', pad: 0, gap: 0, clip: true }, [
    k.row({ w: 'fill', pad: [18, 24], main: 'between', cross: 'center' }, [k.h3('Recent orders', { w: 'hug', size: 18 }), k.btn('Export', 'secondary', { pad: [8, 14] })]),
    k.row({ name: 'Header', w: 'fill', pad: [12, 24], gap: 16, bg: k.t.alt }, ['Customer', 'Status', 'Amount', 'Date'].map((label, i) => cell(label, { weight: 600, color: k.t.muted, size: 13, ...(i === 3 ? { hideM: true } : {}) }))),
    ...[['Lumina Labs', 'Paid', '$2,400', 'Mar 12'], ['Vertex Inc.', 'Pending', '$860', 'Mar 11'], ['Polar Studio', 'Paid', '$1,150', 'Mar 9'], ['Kite Co.', 'Failed', '$320', 'Mar 8']].flatMap(([name, state, amount, date]) => [
      k.rule(), k.row({ name, w: 'fill', pad: [14, 24], gap: 16, cross: 'center' }, [cell(name, { weight: 500 }), status(state), cell(amount), cell(date, { color: k.t.muted, hideM: true })]),
    ]),
  ]);
};
export const activityCard = (k: Kit): Tree => k.card({ name: 'Activity', gap: 18, pad: 24, h: 'fill' }, [
  k.h3('Activity', { size: 18 }),
  ...[['Maya approved the Q2 budget', '2 min ago'], ['Daniel commented on Launch plan', '1 hour ago'], ['Sofia invited 3 teammates', 'Yesterday'], ['Arjun closed 12 tasks', 'Yesterday']].map(([text, time], i) => k.row({ name: text, w: 'fill', gap: 12, cross: 'center' }, [k.avatar(i, 32), k.col({ gap: 2, w: 'fill' }, [k.txt(text, { size: 14, w: 'fill', lh: 1.4 }), k.txt(time, { size: 12.5, color: k.t.muted, tag: 'span' })])])),
]);
export const topbar = (k: Kit): Tree => k.row({ name: 'Top bar', w: 'fill', main: 'between', cross: 'center', gap: 16 }, [
  k.col({ gap: 2 }, [k.h3('Good morning, Maya', { w: 'hug', size: 24 }), k.txt('Here is what happened this week.', { size: 14, color: k.t.muted, tag: 'span', hideM: true })]),
  k.row({ gap: 10, cross: 'center' }, [k.input('Search…', { w: 220, pad: [10, 14], hideM: true }), k.btn('＋ New project')]),
]);
const panel = (k: Kit, name: string, kids: Tree[]) => k.section(name, { py: 32, bg: k.t.alt, gap: 20 }, kids);
/** Preview frame for small elements so they sit on the theme background when inserted alone. */
const el = (k: Kit, name: string, o: F, kids: (Tree | null | Tree[])[]) => k.col({ name, gap: 14, ...o }, kids);
const toggle = (k: Kit, on: boolean) => k.row({ name: 'Toggle', tag: 'button', w: 42, h: 24, pad: 2, r: 999, bg: on ? k.t.accent : k.t.line, main: on ? 'end' : 'start', cross: 'center' }, [k.shape('ellipse', { w: 20, h: 20, bg: '#FFFFFF' })]);
const bar = (k: Kit, label: string, percent: number, width = 352) => k.col({ name: label, gap: 8, w: 'fill' }, [
  k.row({ w: 'fill', main: 'between' }, [k.txt(label, { size: 14, weight: 500, tag: 'span' }), k.txt(percent + '%', { size: 14, color: k.t.muted, tag: 'span' })]),
  k.row({ name: 'Track', w: 'fill', h: 8, r: 999, bg: k.t.line, clip: true }, [k.shape('rect', { name: 'Fill', w: Math.round(width * percent / 100), h: 8, r: 999, bg: k.t.accent })]),
]);
const alert = (k: Kit, color: string, glyph: string, title: string, body: string) => k.row({ name: title, w: 'fill', pad: 16, gap: 12, r: Math.min(k.t.r, 12), bg: alpha(color, '14'), line: alpha(color, '4D') }, [
  k.txt(glyph, { size: 16, weight: 700, color, lh: 1.4, tag: 'span' }), k.col({ gap: 2, w: 'fill' }, [k.txt(title, { size: 15, weight: 600, w: 'fill', lh: 1.4 }), k.p(body, { size: 14 })]),
]);
const pageBtn = (k: Kit, label: string, active = false) => k.row({ name: 'Page ' + label, tag: 'button', w: 38, h: 38, r: Math.min(k.t.br, 10), main: 'center', cross: 'center', bg: active ? k.t.primary : undefined, line: !active }, [k.txt(label, { size: 14, weight: 500, color: active ? k.t.onPrimary : k.t.text, lh: 1, tag: 'span' })]);

export const APP: LibraryItem[] = [
  // ── Sidebars ───────────────────────────────────────────────────────────────
  define('sidebar', 'sidebar-simple', 'Simple sidebar', 'navigation menu app', k => sidebar(k)),
  define('sidebar', 'sidebar-sections', 'Sidebar with sections', 'navigation menu groups upgrade', k => shell(k, {}, [
    k.row({ w: 'fill', pad: [4, 8, 14, 8] }, [k.logo()]),
    k.eyebrow('Workspace', { size: 11, color: k.t.muted, name: 'Label' }), ...MENU.slice(0, 3).map(([glyph, label], i) => navItem(k, glyph, label, i === 1)),
    k.col({ h: 10, w: 'fill' }, []), k.eyebrow('Manage', { size: 11, color: k.t.muted, name: 'Label' }), ...MENU.slice(3).map(([glyph, label]) => navItem(k, glyph, label)),
    spacer(k),
    k.col({ name: 'Upgrade', w: 'fill', pad: 16, gap: 10, r: Math.min(k.t.r, 14), bg: k.t.alt }, [k.txt('Upgrade to Team', { size: 15, weight: 600, tag: 'span' }), k.p('Unlimited projects and priority support.', { size: 13 }), k.btn('Upgrade', 'primary', { w: 'fill', pad: [10, 14] })]),
  ])),
  define('sidebar', 'sidebar-rail', 'Icon rail', 'navigation compact narrow', k => k.col({ name: 'Rail', tag: 'aside', w: 76, h: 720, pad: [18, 0], gap: 10, cross: 'center', bg: k.t.surface, line: true }, [
    k.shape('rect', { name: 'Mark', w: 30, h: 30, r: Math.min(k.t.r, 9), bg: k.t.primary }), k.col({ h: 10 }, []),
    ...MENU.map(([glyph], i) => k.icon(glyph, 44, i === 0 ? k.t.accent : k.t.muted, i === 0 ? {} : { bg: undefined })),
    spacer(k), k.avatar(0, 36),
  ])),
  define('sidebar', 'sidebar-inverse', 'Bold sidebar', 'navigation menu dark', k => {
    const color = k.t.onInv, muted = alpha(k.t.onInv, '99');
    return shell(k, { bg: k.t.inv, line: false }, [
      k.row({ w: 'fill', pad: [4, 8, 18, 8] }, [k.logo('Northwind', color)]),
      ...MENU.map(([glyph, label], i) => navItem(k, glyph, label, i === 0, { color, muted, tint: alpha(color, '1F') })),
      spacer(k), k.rule({ bg: alpha(color, '33') }), k.row({ w: 'fill', pad: [14, 8, 4, 8] }, [person(k, 1, 'Daniel Reyes', 'Admin', color, muted)]),
    ]);
  }),
  define('sidebar', 'sidebar-settings', 'Settings sidebar', 'navigation preferences account', k => shell(k, { h: 560 }, [
    k.col({ gap: 4, w: 'fill', pad: [4, 8, 16, 8] }, [k.h3('Settings', { size: 20 }), k.p('Manage your account and workspace.', { size: 13 })]),
    ...[['☺', 'Profile'], ['♢', 'Appearance'], ['✉', 'Notifications'], ['⚿', 'Security'], ['▣', 'Billing'], ['⇄', 'Integrations']].map(([glyph, label], i) => navItem(k, glyph, label, i === 0, i === 4 ? { count: 'Pro' } : {})),
  ])),

  // ── Dashboard ──────────────────────────────────────────────────────────────
  define('dashboard', 'dash-stats', 'Stat cards', 'metrics kpi numbers admin', k => panel(k, 'Stats', [statCards(k)])),
  define('dashboard', 'dash-chart', 'Chart with activity', 'graph bars analytics admin', k => panel(k, 'Insights', [k.row({ gap: 20, w: 'fill', stack: true }, [chartCard(k), k.col({ w: 'fill', maxW: 380, mobile: { maxWidth: null } }, [activityCard(k)])])])),
  define('dashboard', 'dash-table', 'Orders table', 'data rows list admin', k => panel(k, 'Orders', [tableCard(k)])),
  define('dashboard', 'dash-header', 'Dashboard header', 'title search actions admin', k => panel(k, 'Header', [topbar(k)])),
  define('dashboard', 'dash-progress', 'Goals and progress', 'bars targets admin', k => panel(k, 'Goals', [k.grid(2, { gap: 20, w: 'fill' }, [
    k.card({ name: 'Goals', gap: 20, pad: 24, h: 'fill' }, [k.h3('Quarterly goals', { size: 18 }), bar(k, 'Revenue target', 82, 520), bar(k, 'New signups', 64, 520), bar(k, 'Support satisfaction', 96, 520)]),
    k.card({ name: 'Team', gap: 16, pad: 24, h: 'fill' }, [k.h3('Team on call', { size: 18 }), ...[['Maya Okafor', 'Product'], ['Daniel Reyes', 'Design'], ['Sofia Lindqvist', 'Engineering']].map(([name, role], i) => k.row({ name, w: 'fill', main: 'between', cross: 'center' }, [person(k, i, name, role), k.badge(i === 0 ? 'Online' : 'Away', i === 0 ? GREEN : AMBER)]))]),
  ])])),

  // ── Elements ───────────────────────────────────────────────────────────────
  define('element', 'el-buttons', 'Buttons', 'cta actions primary secondary', k => el(k, 'Buttons', { gap: 16 }, [
    k.row({ gap: 12, rgap: 12, wrap: true, cross: 'center' }, [k.btn('Primary'), k.btn('Secondary', 'secondary'), k.btn('Accent', 'accent'), k.btn('Ghost →', 'ghost')]),
    k.row({ gap: 12, cross: 'center' }, [k.btn('Large button', 'primary', { lg: true }), k.btn('Small', 'secondary', { pad: [8, 14] })]),
  ])),
  define('element', 'el-badges', 'Badges', 'labels tags status pills', k => k.row({ name: 'Badges', gap: 10, rgap: 10, wrap: true, cross: 'center', maxW: 480 }, [k.badge('New'), k.badge('● Online', GREEN), k.badge('Pending', AMBER), k.badge('Failed', RED), k.badge('Beta', k.t.text), k.badge('▲ 12%', GREEN)])),
  define('element', 'el-inputs', 'Form fields', 'input text form field', k => el(k, 'Fields', { w: 380, gap: 18 }, [k.field('Email', 'you@company.com'), k.field('Password', '••••••••'), k.field('Message', 'Write a few lines…', { pad: [13, 16, 64, 16], cross: 'start' })])),
  define('element', 'el-alerts', 'Alerts', 'notice banner message status', k => el(k, 'Alerts', { w: 460, gap: 12 }, [alert(k, k.t.accent, 'ℹ', 'Heads up', 'A new version is available. Refresh to update.'), alert(k, GREEN, '✓', 'Saved', 'Your changes are live.'), alert(k, RED, '!', 'Payment failed', 'Check your card details and try again.')])),
  define('element', 'el-avatars', 'Avatar group', 'people team stack', k => k.row({ name: 'Avatar group', gap: 12, cross: 'center' }, [k.row({ gap: 4 }, [0, 1, 2, 3].map(i => k.avatar(i, 40))), k.row({ pad: [8, 12], r: 999, bg: k.t.alt, line: true }, [k.txt('+12', { size: 13, weight: 600, lh: 1.2, tag: 'span' })]), k.txt('16 people on this project', { size: 14, color: k.t.muted, tag: 'span' })])),
  define('element', 'el-tabs', 'Tabs', 'segmented switch navigation', k => el(k, 'Tabs', { gap: 20 }, [
    k.row({ name: 'Segmented', pad: 4, gap: 4, r: Math.min(k.t.br, 12), bg: k.t.alt, line: true }, ['Overview', 'Activity', 'Settings'].map((label, i) => k.row({ name: label, tag: 'button', pad: [8, 16], r: Math.min(k.t.br, 9), bg: i === 0 ? k.t.surface : undefined, shadow: i === 0 }, [k.txt(label, { size: 14, weight: i === 0 ? 600 : 500, color: i === 0 ? k.t.text : k.t.muted, lh: 1.2, tag: 'span' })]))),
    k.row({ name: 'Underline', gap: 28 }, ['Details', 'Reviews', 'Shipping'].map((label, i) => k.col({ name: label, gap: 10 }, [k.txt(label, { size: 15, weight: i === 0 ? 600 : 500, color: i === 0 ? k.t.text : k.t.muted, lh: 1.2, tag: 'span' }), k.shape('rect', { w: 'fill', h: 2, bg: i === 0 ? k.t.accent : alpha(k.t.line, '00') })]))),
  ])),
  define('element', 'el-breadcrumb', 'Breadcrumb', 'navigation path trail', k => k.row({ name: 'Breadcrumb', gap: 10, cross: 'center' }, ['Home', '/', 'Projects', '/', 'Website redesign'].map((label, i) => k.txt(label, { size: 14, weight: i === 4 ? 600 : 400, color: i === 4 ? k.t.text : k.t.muted, tag: 'span', ...(i === 0 || i === 2 ? { link: HASH } : {}) })))),
  define('element', 'el-pagination', 'Pagination', 'pages navigation numbers', k => k.row({ name: 'Pagination', gap: 6, cross: 'center' }, [pageBtn(k, '←'), pageBtn(k, '1'), pageBtn(k, '2', true), pageBtn(k, '3'), k.txt('…', { size: 14, color: k.t.muted, tag: 'span' }), pageBtn(k, '12'), pageBtn(k, '→')])),
  define('element', 'el-toggles', 'Settings toggles', 'switch preferences options', k => k.card({ name: 'Settings', w: 420, gap: 0, pad: [8, 24] }, [['Email notifications', 'News and product updates', true], ['Weekly summary', 'Every Monday morning', true], ['Marketing emails', 'Offers and tips', false]].flatMap(([title, body, on], i) => [
    i ? k.rule() : null, k.row({ name: title as string, w: 'fill', pad: [16, 0], gap: 16, cross: 'center' }, [k.col({ gap: 2, w: 'fill' }, [k.txt(title as string, { size: 15, weight: 500, w: 'fill' }), k.txt(body as string, { size: 13, color: k.t.muted, tag: 'span' })]), toggle(k, on as boolean)]),
  ]))),
  define('element', 'el-progress', 'Progress bars', 'loading status meter', k => k.card({ name: 'Progress', w: 400, gap: 20, pad: 24 }, [bar(k, 'Uploading files', 62), bar(k, 'Storage used', 38), bar(k, 'Profile complete', 90)])),
  define('element', 'el-chips', 'Filter chips', 'tags filters selection', k => k.row({ name: 'Chips', gap: 8, rgap: 8, wrap: true, maxW: 460 }, ['All', 'Design', 'Engineering', 'Marketing', 'Sales', 'Support'].map((label, i) => k.row({ name: label, tag: 'button', pad: [8, 14], r: 999, bg: i === 0 ? k.t.primary : k.t.surface, line: i !== 0, motion: { hover: { type: 'lift' } } }, [k.txt(label, { size: 14, weight: 500, color: i === 0 ? k.t.onPrimary : k.t.text, lh: 1.2, tag: 'span' })])))),
  define('element', 'el-profile', 'Profile card', 'user person account', k => k.card({ name: 'Profile', w: 320, cross: 'center', gap: 16, pad: 28 }, [
    k.avatar(0, 88), k.col({ gap: 4, w: 'fill' }, [k.h3('Maya Okafor', { align: 'center' }), k.p('Head of Product · Lisbon', { align: 'center', size: 14 })]),
    k.row({ w: 'fill', main: 'between', pad: [4, 12] }, [['128', 'Projects'], ['2.4k', 'Followers'], ['96', 'Following']].map(([value, label]) => k.col({ name: label, gap: 2, cross: 'center' }, [k.txt(value, { size: 18, weight: 700, lh: 1.2, tag: 'span' }), k.txt(label, { size: 12.5, color: k.t.muted, tag: 'span' })]))),
    k.btn('Follow', 'primary', { w: 'fill' }),
  ])),
  define('element', 'el-toast', 'Toast notification', 'message popup snackbar', k => k.row({ name: 'Toast', w: 400, pad: 16, gap: 14, cross: 'center', r: Math.min(k.t.r, 14), bg: k.t.surface, line: true, shadow: true }, [k.icon('✓', 36, GREEN), k.col({ gap: 2, w: 'fill' }, [k.txt('Project published', { size: 15, weight: 600, w: 'fill', lh: 1.4 }), k.txt('Your site is live at northwind.example', { size: 13.5, color: k.t.muted, w: 'fill' })]), k.txt('×', { size: 20, color: k.t.muted, lh: 1, tag: 'span' })])),
  define('element', 'el-empty', 'Empty state', 'placeholder no data blank', k => k.card({ name: 'Empty state', w: 440, cross: 'center', gap: 14, pad: 40 }, [k.icon('✦', 56), k.h3('No projects yet', { align: 'center' }), k.p('Create your first project to see it here. It only takes a minute.', { align: 'center', size: 15 }), k.btn('＋ New project')])),
  define('element', 'el-card', 'Content card', 'article post preview', k => k.card({ name: 'Card', w: 340, pad: 12, gap: 0, motion: { hover: { type: 'lift' } } }, [k.img(0, { h: 180, r: Math.max(0, k.t.r - 6) }), k.col({ gap: 10, w: 'fill', pad: [16, 10, 10, 10] }, [k.badge('Guide'), k.h3('Getting started with workflows'), k.p('Everything you need to automate your first process.', { size: 15 }), k.txt('Read more →', { size: 15, weight: 600, color: k.t.accent, tag: 'span' })])])),
  define('element', 'el-stat', 'Stat tile', 'metric kpi number', k => k.card({ name: 'Stat', w: 260, gap: 10, pad: 22 }, [k.row({ w: 'fill', main: 'between', cross: 'center' }, [k.txt('Active users', { size: 14, color: k.t.muted, tag: 'span' }), k.icon('↗', 32)]), k.txt('12,480', { font: 'head', size: 34, lh: 1.1, fixed: true }), delta(k, '▲ 8.2% this week')])),
  define('element', 'el-tooltip', 'Tooltip', 'hint popover help', k => k.col({ name: 'Tooltip', gap: 8, cross: 'center' }, [k.row({ pad: [8, 12], r: Math.min(k.t.br, 8), bg: k.t.inv, shadow: true }, [k.txt('Copied to clipboard', { size: 13, weight: 500, color: k.t.onInv, lh: 1.3, tag: 'span' })]), k.btn('Copy link', 'secondary')])),
  define('element', 'el-search', 'Command menu', 'search palette results', k => k.card({ name: 'Command menu', w: 480, pad: 0, gap: 0, shadow: true, clip: true }, [
    k.row({ w: 'fill', pad: [16, 18], gap: 12, cross: 'center' }, [k.txt('⌕', { size: 18, color: k.t.muted, lh: 1, tag: 'span' }), k.txt('Search or jump to…', { size: 16, color: k.t.muted, w: 'fill' }), k.badge('Ctrl K', k.t.muted)]), k.rule(),
    k.col({ w: 'fill', pad: 8, gap: 2 }, [['▤', 'Website redesign', 'Project'], ['☺', 'Maya Okafor', 'Person'], ['▥', 'Q2 revenue report', 'Report']].map(([glyph, label, kind], i) => k.row({ name: label, w: 'fill', pad: [10, 12], gap: 12, cross: 'center', r: Math.min(k.t.br, 8), bg: i === 0 ? k.t.alt : undefined }, [k.txt(glyph, { size: 16, color: k.t.muted, lh: 1.2, tag: 'span' }), k.txt(label, { size: 15, w: 'fill' }), k.txt(kind, { size: 13, color: k.t.muted, tag: 'span' })]))),
  ])),
];
