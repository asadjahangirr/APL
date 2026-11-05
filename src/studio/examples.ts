import { projectSchema, type BodyNode, type Project } from '../project/schema';
import { newProject } from '../project/templates';
import { themePresets } from '../project/theme';
import northline from './assets/northline.webp?inline';
import form from './assets/form-study.webp?inline';
import field from './assets/field-notes.webp?inline';

export type ExampleKind = 'northline' | 'ellis';
export const exampleDetails = [
  { id: 'northline' as const, name: 'Northline Studio', category: 'Business / studio', description: 'A considered identity studio. An introduction, an approach, and a place to start a conversation.', image: northline, pages: 3 },
  { id: 'ellis' as const, name: 'Jordan Ellis', category: 'Personal portfolio', description: 'An independent designer. Expressive work, complete case studies, and a direct invitation to connect.', image: form, pages: 4 },
];
const text = (title: string, body: string, design: 'classic' | 'editorial' | 'panel' = 'editorial'): BodyNode => ({
  id: crypto.randomUUID(), type: 'Text', props: { title, body, align: 'left', design },
});
const contact = (): BodyNode => ({ id: crypto.randomUUID(), type: 'Contact', props: {
  title: 'A good conversation\nis a good beginning.', description: 'Tell us a little about your idea, your timeline, and what you would like to make possible.', button: 'Send your inquiry',
} });
const hero = (title: string, description: string, image: string, imageAlt: string, layout: 'split' | 'editorial' | 'inset', eyebrow: string): BodyNode => ({
  id: crypto.randomUUID(), type: 'Hero', props: { title, description, image, imageAlt, layout, eyebrow, motion: 'none' },
});
function work(): BodyNode {
  return { id: crypto.randomUUID(), type: 'Section', props: { width: 'content', tone: 'plain', padding: { mobile: 32, desktop: 64 } }, children: [
    { id: crypto.randomUUID(), type: 'Heading', props: { text: 'Selected work,\nfrom start to finish.', level: 'h2', size: 'large', align: 'left' } },
    { id: crypto.randomUUID(), type: 'Columns', props: { layout: { mobile: 'stack', tablet: 'halves' }, gap: { mobile: 32, desktop: 48 }, align: 'start' }, children: [
      { id: crypto.randomUUID(), type: 'Column', props: { gap: { mobile: 20 }, align: 'start' }, children: [
        { id: crypto.randomUUID(), type: 'Image', props: { image: form, alt: 'Original blue circular and triangular Form Study artwork', ratio: 'square', radius: 'none' } },
        { id: crypto.randomUUID(), type: 'Heading', props: { text: '01 / Form Study', level: 'h3', size: 'medium', align: 'left' } },
        { id: crypto.randomUUID(), type: 'Paragraph', props: { text: 'A visual identity for a fictional design publication, built around geometry, rhythm, and a single clear idea.', align: 'left' } },
        { id: crypto.randomUUID(), type: 'Button', props: { label: 'Read the case study', target: { pageId: 'form-study', anchor: '#top' }, variant: 'text', shape: 'square', motion: 'none' } },
      ] },
      { id: crypto.randomUUID(), type: 'Column', props: { gap: { mobile: 20 }, align: 'start' }, children: [
        { id: crypto.randomUUID(), type: 'Image', props: { image: field, alt: 'Original six-panel terracotta Field Notes artwork', ratio: 'square', radius: 'none' } },
        { id: crypto.randomUUID(), type: 'Heading', props: { text: '02 / Field Notes', level: 'h3', size: 'medium', align: 'left' } },
        { id: crypto.randomUUID(), type: 'Paragraph', props: { text: 'An editorial system for a fictional independent journal. Small observations, given room to become a story.', align: 'left' } },
        { id: crypto.randomUUID(), type: 'Button', props: { label: 'Read the case study', target: { pageId: 'field-notes', anchor: '#top' }, variant: 'text', shape: 'square', motion: 'none' } },
      ] },
    ] },
  ] };
}
/** Example factories always create a new, independent project. They never modify stored work. */
export function createExample(kind: ExampleKind): Project {
  const portfolio = kind === 'ellis';
  const p = newProject(portfolio ? 'portfolio' : 'business');
  const page = (id: string, name: string, path: string, nodes: BodyNode[], inNavigation = true) => ({ id, name, path, nodes, inNavigation, title: name + ' | ' + (portfolio ? 'Jordan Ellis' : 'Northline Studio'), description: portfolio ? 'Independent design, identity, and digital experiences.' : 'Identity and digital design for independent businesses.' });
  p.name = portfolio ? 'Jordan Ellis / portfolio' : 'Northline / studio website';
  p.theme = { ...themePresets.find(t => t.id === (portfolio ? 'cobalt' : 'editorial'))!.theme };
  if (!portfolio) p.theme = { accent: '#465c45', background: '#f5f2eb', surface: '#e7e4d9', ink: '#252f29', muted: '#576057', line: '#d4d6c9', font: 'serif' };
  p.shared.header.props.design = portfolio ? 'editorial' : 'framed';
  p.shared.header.props.target = { pageId: 'contact', anchor: '#contact' };
  p.shared.footer.props.design = portfolio ? 'editorial' : 'columns';
  p.shared.footer.props.note = 'An original APL example. Make it your own.';
  p.pages = portfolio ? [
    page('home', 'Home', '/', [hero('Ideas with character.\nDesign with purpose.', 'I’m Jordan, an independent designer exploring the space between identity, digital experiences, and everyday life.', '', '', 'editorial', 'Jordan Ellis / Independent designer'), work(), text('A point of view,\nnot a house style.', 'Every project starts with listening. I work closely with people who care about what they make, finding a visual language that belongs to them.')]),
    page('form-study', 'Form Study', '/work/form-study', [hero('Finding the shape\nof a new idea.', 'Form Study / Identity & art direction / Fictional example project', form, 'Original geometric blue Form Study identity artwork', 'inset', 'Selected work / 01'), text('The brief', 'Create a recognizable identity for an independent publication about design. A circle and a triangle become a flexible vocabulary for covers, digital layouts, and small printed details.'), text('The approach', 'A deliberate use of scale turns familiar forms into something distinctive. Blue provides a clear visual anchor; open space gives the content room to lead.')], false),
    page('field-notes', 'Field Notes', '/work/field-notes', [hero('Small observations.\nA bigger picture.', 'Field Notes / Editorial design / Fictional example project', field, 'Original terracotta Field Notes editorial artwork', 'split', 'Selected work / 02'), text('The brief', 'Give an independent journal a simple, expressive editorial system. The design needs to feel coherent across stories without making every page look the same.'), text('The approach', 'A repeated grid provides the structure. Warm color, varied crops, and geometric illustration let each story keep its own personality.')], false),
    page('contact', 'Contact', '/contact', [hero('Have something\nin mind?', 'I work with independent businesses, creative teams, and people with an idea worth making real.', '', '', 'editorial', 'Let’s work together'), contact()]),
  ] : [
    page('home', 'Home', '/', [hero('A clear direction.\nA lasting impression.', 'We help independent businesses bring their story into focus through strategy, identity, and thoughtful digital design.', northline, 'Original architectural study of a green colonnade and courtyard', 'split', 'Northline / Identity & digital studio'), { id: crypto.randomUUID(), type: 'Services', props: { title: 'From the first question\nto the final detail.', description: 'A small team, working closely with you.', mobile: 1, tablet: 2, desktop: 3, gap: 32, design: 'numbered', items: [
      { title: 'Find your direction', description: 'Research, positioning, and a clear point of view. We make space for the questions that shape better work.' },
      { title: 'Make your mark', description: 'Names, identities, and visual systems with character. Designed to work in the places your business lives.' },
      { title: 'Build your presence', description: 'Useful websites with a considered experience, clear content, and a foundation you can own.' },
    ] } }, text('Good work begins\nwith understanding.', 'We are a fictional independent studio created to demonstrate APL. This complete example has real page navigation and an exportable contact module. Replace our story with yours.')]),
    page('about', 'Our approach', '/about', [hero('Small studio.\nShared ambition.', 'We believe the best work happens when people are involved, questions are welcomed, and the direction is clear.', northline, 'Northline original green architectural artwork', 'inset', 'Our approach'), text('Listen, explore, refine.', 'We start with your audience and your ambitions. Then we explore a focused set of directions, develop the strongest ideas together, and test the details in real contexts.'), text('Built for the everyday.', 'A brand should feel as good on a small screen as it does on a large one. Our systems are made to be used: clear guidelines, practical layouts, and room to grow.', 'panel')]),
    page('contact', 'Contact', '/contact', [hero('Let’s find\nyour direction.', 'Tell us where you are now, where you want to go, and what a good outcome would look like.', '', '', 'editorial', 'Start a conversation'), contact()]),
  ];
  return projectSchema.parse(p);
}
