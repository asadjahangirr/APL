import CompositionPicker from './CompositionPicker';
import CommonDesignPicker from './CommonDesignPicker';
import { useState } from 'react';
import type { Config, Data, Slot } from '@puckeditor/core';
import { type ComponentProps, type BodyProps, type BodyNode, type Project, projectSchema } from '../project/schema';
import { headerHref, navigationLinks, buttonHref, iconHref } from '../project/pages';
import { ICON_NAMES, type IconName } from '../project/icon-schema';
import { newProject } from '../project/templates';
import Header from '../site/Header';
import Hero from '../site/Hero';
import Services from '../site/Services';
import ServiceCollection from '../site/ServiceCollection';
import ArticleCollection from '../site/ArticleCollection';
import PortfolioCollection from '../site/PortfolioCollection';
import { publicPortfolio, portfolioCollectionDefaults } from '../project/portfolio';
import { themeStyle } from '../project/theme';
import DesignPicker from './DesignPicker';
import { portfolioCollectionDesigns, serviceCollectionDesigns, articleCollectionDesigns } from '../site/collection-designs';
import { publicServices, serviceCollectionDefaults } from '../project/services';
import { publicArticles, articleCollectionDefaults } from '../project/articles';
import Text from '../site/Text';
import Contact from '../site/Contact';
import Footer from '../site/Footer';
import Section from '../site/Section';
import Columns from '../site/Columns';
import Column from '../site/Column';
import Heading from '../site/Heading';
import Paragraph from '../site/Paragraph';
import Image from '../site/Image';
import Button from '../site/Button';
import Icon from '../site/Icon';
import { ResponsiveNumber, LayoutPresetField, ButtonDesignField, TargetField, IconTargetField } from './LayoutFields';
import AppearanceField, { ButtonDestinationField, type AppearanceKey } from './AppearanceField';
import type { ResponsiveAppearance } from '../project/appearance-schema';
import siteCss from '../site/site.css?inline';

type EditorProps = { [K in keyof BodyProps]: BodyProps[K] & (K extends 'Section' | 'Columns' | 'Column' ? { items: Slot } : {}) };
type RootProps = { name: string; accent: string; font: Project['theme']['font']; title: string; description: string; body: Slot };
export type EditorData = Data<EditorProps, RootProps>;
export function ImageField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [error, setError] = useState('');
  return <div><label>Photograph<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => {
    const file = e.target.files?.[0]; if (!file) return; setError('');
    try {
      if (file.size > 2_000_000 || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG or WebP under 2 MB.');
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 24_000_000) { bitmap.close(); throw new Error('Image dimensions are too large.'); }
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const encoded = canvas.toDataURL('image/webp', .85);
      if (Math.ceil(encoded.split(',')[1].length * 3 / 4) > 2_000_000) throw new Error('The resized image is too large. Choose a smaller image.');
      onChange(encoded);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not open image.'); }
  }}/></label>{value && <button type="button" onClick={() => onChange('')}>Remove image</button>}<p role="status">{error}</p></div>;
}
const initial = newProject();
function defaults<K extends 'Hero' | 'Services' | 'Contact'>(type: K): ComponentProps[K] {
  return initial.pages[0].nodes.find(n => n.type === type)!.props as ComponentProps[K];
}
const leaves: Array<keyof EditorProps> = ['Heading', 'Paragraph', 'Image', 'Button', 'Icon'];
const alignOptions = [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }];
const heading = { text: 'Make room for a good idea.', level: 'h2' as const, size: 'medium' as const, align: 'left' as const };
const paragraph = { text: 'Bring your story together with a layout that feels like you. Select any element to make it your own.', align: 'left' as const };
const image = { image: '', alt: '', ratio: 'landscape' as const, radius: 'soft' as const };
const button = { label: 'Explore our work', target: { pageId: 'home', anchor: '#top' }, variant: 'solid' as const, shape: 'rounded' as const, motion: 'none' as const, iconPosition: 'start' as const };
const icon = { name: 'arrow-right' as const, label: 'Go to home page', decorative: false, size: { mobile: 24 }, target: { pageId: 'home', anchor: '#top' } };
const columnProps = { gap: { mobile: 20 }, align: 'center' as const };
const columnsProps = { layout: { mobile: 'stack' as const, tablet: 'halves' as const, desktop: 'one-two' as const }, gap: { mobile: 24, tablet: 32, desktop: 48 }, align: 'stretch' as const };
const defaultColumns: Slot = [
  { type: 'Column', props: { ...columnProps, items: [{ type: 'Heading', props: heading }, { type: 'Paragraph', props: paragraph }, { type: 'Button', props: button }] } },
  { type: 'Column', props: { ...columnProps, items: [{ type: 'Image', props: image }] } }
];
function appearanceField(label: string, fields?: readonly AppearanceKey[]) {
  return { type: 'custom' as const, label, render: ({ value, onChange }: { value?: ResponsiveAppearance; onChange: (value: ResponsiveAppearance | undefined) => void }) =>
    <AppearanceField label={label} value={value} onChange={onChange} fields={fields}/> };
}
export const config: Config<EditorProps, RootProps> = {
  root: {
    fields: {
      name: { type: 'text', label: 'Project name' },
      title: { type: 'text', label: 'Page title / SEO' },
      description: { type: 'textarea', label: 'Search description' },
      accent: { type: 'custom', label: 'Accent color', render: ({ value, onChange }) => <label>Accent color<input type="color" aria-label="Accent color" value={value} onChange={event => onChange(event.target.value)}/><code>{value}</code></label> },
      font: { type: 'select', options: [{ label: 'Modern sans', value: 'sans' }, { label: 'Humanist', value: 'humanist' }, { label: 'Classic serif', value: 'serif' }] },
      body: { type: 'slot', allow: ['Hero', 'Services', 'ServiceCollection', 'PortfolioCollection', 'ArticleCollection', 'Text', 'Contact', 'Section'] }
    },
    render: ({ body: Body, accent, font }) => <><style>{siteCss}</style><main id="top" className="site" data-font={font} style={themeStyle({ ...initial.theme, accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : initial.theme.accent, font })}><Body/></main></>
  },
  categories: {
    sections: { title: 'Ready-made sections', components: ['Hero','Services','ServiceCollection','PortfolioCollection','ArticleCollection','Text','Contact'] },
    layouts: { title: 'Compose a layout', components: ['Section','Columns','Column'] },
    elements: { title: 'Elements inside layouts', components: leaves }
  },
  components: {
    ArticleCollection: { label: 'Articles collection (CMS)', defaultProps: articleCollectionDefaults,
      fields: { title: { type: 'text' }, description: { type: 'textarea' },
        design: { type: 'custom', label: 'Articles design', render: ({ value, onChange }) => <DesignPicker label="Articles design" value={value} onChange={onChange} designs={articleCollectionDesigns}/> },
        motion: { type: 'radio', label: 'Motion', options: [{ label: 'None', value: 'none' }, { label: 'Gentle lift', value: 'lift' }, { label: 'Image zoom', value: 'zoom' }, { label: 'Entrance reveal', value: 'reveal' }] },
        mobile: { type: 'number', min: 1, max: 4, label: 'Mobile columns (grid designs)' }, tablet: { type: 'number', min: 1, max: 6, label: 'Tablet columns (inherits mobile)' }, desktop: { type: 'number', min: 1, max: 6, label: 'Desktop columns (inherits tablet)' }, gap: { type: 'number', min: 8, max: 64, label: 'Gap (pixels)' } },
      render: props => <ArticleCollection {...props} items={[]}/> },
    PortfolioCollection: { label: 'Portfolio collection (CMS)', defaultProps: portfolioCollectionDefaults,
      fields: { title: { type: 'text' }, description: { type: 'textarea' },
        design: { type: 'custom', label: 'Portfolio design', render: ({ value, onChange }) => <DesignPicker label="Portfolio design" value={value} onChange={onChange} designs={portfolioCollectionDesigns}/> },
        motion: { type: 'radio', label: 'Motion', options: [{ label: 'None', value: 'none' }, { label: 'Gentle lift', value: 'lift' }, { label: 'Image zoom', value: 'zoom' }, { label: 'Entrance reveal', value: 'reveal' }] },
        mobile: { type: 'number', min: 1, max: 4, label: 'Mobile columns (grid designs)' }, tablet: { type: 'number', min: 1, max: 6, label: 'Tablet columns (inherits mobile)' }, desktop: { type: 'number', min: 1, max: 6, label: 'Desktop columns (inherits tablet)' }, gap: { type: 'number', min: 8, max: 64, label: 'Gap (pixels)' } },
      render: props => <PortfolioCollection {...props} items={[]}/> },
    ServiceCollection: { label: 'Services collection (CMS)', defaultProps: serviceCollectionDefaults,
      fields: { title: { type: 'text' }, description: { type: 'textarea' },
        design: { type: 'custom', label: 'Services design', render: ({ value, onChange }) => <DesignPicker label="Services design" value={value} onChange={onChange} designs={serviceCollectionDesigns}/> },
        motion: { type: 'radio', label: 'Motion', options: [{ label: 'None', value: 'none' }, { label: 'Gentle lift', value: 'lift' }, { label: 'Image zoom', value: 'zoom' }, { label: 'Entrance reveal', value: 'reveal' }] },
        mobile: { type: 'number', min: 1, max: 4, label: 'Mobile columns (grid designs)' }, tablet: { type: 'number', min: 1, max: 6, label: 'Tablet columns (inherits mobile)' }, desktop: { type: 'number', min: 1, max: 6, label: 'Desktop columns (inherits tablet)' }, gap: { type: 'number', min: 8, max: 64, label: 'Gap (pixels)' } },
      render: props => <ServiceCollection {...props} items={[]}/> },
    Hero: { label: 'Hero', defaultProps: defaults('Hero'), fields: { eyebrow: { type: 'text' }, title: { type: 'textarea' }, description: { type: 'textarea' }, layout: { type: 'custom', render: ({value,onChange}) => <CompositionPicker family="hero" value={value} onChange={onChange}/> }, motion: { type: 'select', label: 'Entrance motion', options: [{label:'None',value:'none'},{label:'Gentle reveal',value:'reveal'},{label:'Image unveil',value:'unveil'}] }, image: { type: 'custom', render: ({ value, onChange }) => <ImageField value={value} onChange={onChange}/> }, imageAlt: { type: 'text', label: 'Image description (accessibility)' } }, render: props => <Hero {...props} preview={props.puck.isEditing}/> },
    Services: { label: 'Services / cards', defaultProps: defaults('Services'), fields: { title: { type: 'text' }, description: { type: 'textarea' }, design: { type: 'custom', render: ({value,onChange}) => <CommonDesignPicker family="services" value={value ?? 'classic'} onChange={onChange}/> }, mobile: { type: 'number', min: 1, max: 4, label: 'Mobile columns' }, tablet: { type: 'number', min: 1, max: 6, label: 'Tablet columns (inherits mobile)' }, desktop: { type: 'number', min: 1, max: 6, label: 'Desktop columns (inherits tablet)' }, gap: { type: 'number', min: 8, max: 64, label: 'Gap (pixels)' }, items: { type: 'array', min: 1, max: 12, getItemSummary: item => item.title || 'Service', defaultItemProps: { title: 'New service', description: 'Describe what you offer.' }, arrayFields: { title: { type: 'text' }, description: { type: 'textarea' } } } }, render: Services },
    Text: { label: 'Text section', defaultProps: { title: 'A story worth sharing.', body: 'Add your story here.', align: 'left', design: 'classic' }, fields: { title: { type: 'text' }, body: { type: 'textarea' }, align: { type: 'radio', options: alignOptions.slice(0,2) }, design: { type: 'custom', render: ({value,onChange}) => <CommonDesignPicker family="text" value={value ?? 'classic'} onChange={onChange}/> } }, render: Text },
    Contact: { label: 'Contact form + inbox', defaultProps: defaults('Contact'), fields: {
      title: { type: 'text' }, description: { type: 'textarea' }, button: { type: 'text', label: 'Button label' },
      appearance: appearanceField('Contact section appearance'),
      buttonAppearance: appearanceField('Submit button appearance'),
      fieldAppearance: appearanceField('Form field appearance', ['fontFamily','fontSize','fontWeight','lineHeight','color','background','borderColor','borderWidth','radius','paddingX','paddingY','maxWidth','minHeight']),
    }, render: props => <Contact {...props} preview/> },
    Section: { label: 'Layout section', defaultProps: { padding: { mobile: 32, tablet: 48, desktop: 72 }, width: 'content', tone: 'plain', items: [{ type: 'Columns', props: { ...columnsProps, items: defaultColumns } }] },
      fields: { appearance: appearanceField('Section appearance'), padding: { type: 'custom', render: ({ value, onChange }) => <ResponsiveNumber label="section padding" value={value} onChange={onChange} max={160}/> },
        width: { type: 'select', label: 'Content width', options: [{ label: 'Content · 1120px maximum', value: 'content' }, { label: 'Wide · 1440px maximum', value: 'wide' }, { label: 'Full available width', value: 'full' }] },
        tone: { type: 'radio', label: 'Section background', options: [{ label: 'Plain', value: 'plain' }, { label: 'Soft', value: 'soft' }, { label: 'Contrast', value: 'contrast' }] }, items: { type: 'slot', allow: [...leaves,'Columns'] } },
      render: ({ items: Items, ...props }) => <Section {...props} renderContent={attributes => <Items {...attributes} style={{ ...attributes.style, height: 'auto' }} minEmptyHeight={96}/>}/> },
    Columns: { label: 'Column group', defaultProps: { ...columnsProps, items: defaultColumns },
      fields: { appearance: appearanceField('Column group appearance'), layout: { type: 'custom', render: ({ value, onChange }) => <LayoutPresetField value={value} onChange={onChange}/> }, gap: { type: 'custom', render: ({ value, onChange }) => <ResponsiveNumber label="column gap" value={value} onChange={onChange} max={96}/> },
        align: { type: 'select', label: 'Align columns vertically', options: [{ label: 'Top', value: 'start' }, { label: 'Center', value: 'center' }, { label: 'Stretch to equal height', value: 'stretch' }] }, items: { type: 'slot', allow: ['Column'] } },
      render: ({ items: Items, ...props }) => <Columns {...props} renderContent={attributes => <Items {...attributes} style={{ ...attributes.style, height: 'auto' }} minEmptyHeight={96} collisionAxis="dynamic"/>}/> },
    Column: { label: 'Column', defaultProps: { ...columnProps, items: [{ type: 'Paragraph', props: paragraph }] },
      fields: { appearance: appearanceField('Column appearance'), gap: { type: 'custom', render: ({ value, onChange }) => <ResponsiveNumber label="element gap" value={value} onChange={onChange} max={96}/> }, align: { type: 'select', label: 'Position content vertically', options: [{ label: 'Top', value: 'start' }, { label: 'Center', value: 'center' }, { label: 'Bottom', value: 'end' }] }, items: { type: 'slot', allow: leaves } },
      render: ({ items: Items, ...props }) => <Column {...props} renderContent={attributes => <Items {...attributes} minEmptyHeight={80}/>}/> },
    Heading: { label: 'Heading', defaultProps: heading, fields: { text: { type: 'textarea', label: 'Heading text' }, level: { type: 'select', label: 'Heading level', options: [{ label: 'H1 · page heading', value: 'h1' }, { label: 'H2 · section', value: 'h2' }, { label: 'H3 · subsection', value: 'h3' }, { label: 'H4 · detail', value: 'h4' }] }, size: { type: 'radio', label: 'Heading size', options: [{ label: 'Small', value: 'small' }, { label: 'Medium', value: 'medium' }, { label: 'Large', value: 'large' }] }, align: { type: 'radio', options: alignOptions }, appearance: appearanceField('Heading appearance') }, render: Heading },
    Paragraph: { label: 'Paragraph', defaultProps: paragraph, fields: { text: { type: 'textarea', label: 'Paragraph text' }, align: { type: 'radio', options: alignOptions }, appearance: appearanceField('Paragraph appearance') }, render: Paragraph },
    Image: { label: 'Image', defaultProps: image, fields: { image: { type: 'custom', render: ({ value, onChange }) => <ImageField value={value} onChange={onChange}/> }, alt: { type: 'text', label: 'Image description (leave empty only for decoration)' }, ratio: { type: 'radio', label: 'Image proportions', options: [{ label: 'Square', value: 'square' }, { label: 'Landscape', value: 'landscape' }, { label: 'Portrait', value: 'portrait' }] }, radius: { type: 'radio', label: 'Image corners', options: [{ label: 'Square', value: 'none' }, { label: 'Soft', value: 'soft' }, { label: 'Round', value: 'round' }] }, appearance: appearanceField('Image appearance', ['background','borderColor','borderWidth','radius','paddingX','paddingY','maxWidth','minHeight','aspectRatio']) }, render: Image },
    Button: { label: 'Button', defaultProps: button, fields: { label: { type: 'text', label: 'Button label' }, destination: { type: 'custom', label: 'Action', render: ({ value, onChange }) => <ButtonDestinationField value={value} onChange={onChange}/> }, target: { type: 'custom', render: ({ value, onChange }) => <TargetField project={initial} value={value} onChange={onChange}/> }, icon: { type: 'custom', label: 'Symbol', render: ({ value, onChange }) => <label>Button symbol<select aria-label="Button symbol" value={value ?? ''} onChange={event => onChange(event.target.value ? event.target.value as IconName : undefined)}><option value="">No symbol</option>{ICON_NAMES.map(name => <option key={name} value={name}>{name.replaceAll('-', ' ')}</option>)}</select></label> }, iconPosition: { type: 'radio', label: 'Symbol position', options: [{ label: 'Before label', value: 'start' }, { label: 'After label', value: 'end' }] }, variant: { type: 'custom', render: ({ value, onChange }) => <ButtonDesignField value={value} onChange={onChange}/> }, shape: { type: 'radio', label: 'Button shape', options: [{ label: 'Square', value: 'square' }, { label: 'Rounded', value: 'rounded' }, { label: 'Pill', value: 'pill' }] }, motion: { type: 'radio', label: 'Button motion', options: [{ label: 'None', value: 'none' }, { label: 'Gentle lift', value: 'lift' }, { label: 'Moving arrow', value: 'arrow' }, { label: 'Press', value: 'press' }, { label: 'Surface sweep', value: 'sweep' }] }, appearance: appearanceField('Button appearance') }, render: props => <Button {...props} href="/"/> },
    Icon: { label: 'Icon / linked symbol', defaultProps: icon, fields: { name: { type: 'select', label: 'Symbol', options: ICON_NAMES.map(name => ({ label: name.replaceAll('-', ' '), value: name })) }, label: { type: 'text', label: 'Accessible description' }, decorative: { type: 'radio', label: 'Meaning', options: [{ label: 'Meaningful', value: false }, { label: 'Decoration only', value: true }] }, size: { type: 'custom', label: 'Icon size', render: ({ value, onChange }) => <ResponsiveNumber label="icon size" value={value} onChange={onChange} min={12} max={160}/> }, destination: { type: 'custom', label: 'Link action', render: ({ value, onChange }) => <ButtonDestinationField subject="Icon" value={value} onChange={onChange}/> }, target: { type: 'custom', label: 'Page or section', render: ({ value, onChange }) => <IconTargetField project={initial} value={value} onChange={onChange}/> }, appearance: appearanceField('Icon appearance', ['color','background','borderColor','borderWidth','radius','paddingX','paddingY','maxWidth','minHeight']) }, render: props => <Icon {...props} href={iconHref(initial, props) || undefined}/> }
  }
};
export function createConfig(project: Project, pageId: string, editing = true): typeof config {
  const homeTarget = { pageId: project.pages.find(page => page.path === '/')!.id, anchor: '#top' };
  const retargetDefaults = (items: Slot): Slot => items.map(node => ({ ...node, props: { ...node.props,
    ...(node.type === 'Button' || node.type === 'Icon' ? { target: homeTarget } : {}),
    ...(['Section', 'Columns', 'Column'].includes(node.type) ? { items: retargetDefaults(node.props.items) } : {})
  } }));
  return { ...config,
    components: { ...config.components,
      ServiceCollection: {...config.components.ServiceCollection,render:props=><ServiceCollection {...props} items={publicServices(project)}/>},
      ArticleCollection: {...config.components.ArticleCollection,render:props=><ArticleCollection {...props} items={publicArticles(project)}/>},
      PortfolioCollection: {...config.components.PortfolioCollection,render:props=><PortfolioCollection {...props} items={publicPortfolio(project)}/>},
      Section: { ...config.components.Section, defaultProps: { ...config.components.Section.defaultProps!, items: retargetDefaults(config.components.Section.defaultProps!.items) } },
      Columns: { ...config.components.Columns, defaultProps: { ...config.components.Columns.defaultProps!, items: retargetDefaults(config.components.Columns.defaultProps!.items) } },
      Button: { ...config.components.Button, defaultProps: { ...config.components.Button.defaultProps!, target: homeTarget },
      fields: { ...config.components.Button.fields!, destination: { type: 'custom', render: ({ value, onChange }) => <ButtonDestinationField value={value} onChange={onChange} project={project}/> }, target: { type: 'custom', render: ({ value, onChange }) => <TargetField project={project} value={value} onChange={onChange}/> } },
      render: props => <Button {...props} href={buttonHref(project, props) || '#'}/>
    },
      Icon: { ...config.components.Icon, defaultProps: { ...config.components.Icon.defaultProps!, target: homeTarget },
      fields: { ...config.components.Icon.fields!, destination: { type: 'custom', render: ({ value, onChange }) => <ButtonDestinationField subject="Icon" value={value} onChange={onChange} project={project}/> }, target: { type: 'custom', render: ({ value, onChange }) => <IconTargetField project={project} value={value} onChange={onChange}/> } },
      render: props => <Icon {...props} href={iconHref(project, props) || undefined}/>
    } },
    root: { ...config.root, render: ({ body: Body, accent, font }) => <><style>{siteCss}</style>
    <main id="top" className="site" data-font={font} onClickCapture={editing ? event => { if ((event.target as HTMLElement).closest?.('a[href]')) event.preventDefault(); } : undefined} style={themeStyle({ ...project.theme, accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : project.theme.accent, font })}>
      {project.shared.header.enabled && project.pages.find(page => page.id === pageId)?.showHeader !== false && <Header {...project.shared.header.props} href={headerHref(project) || '/'} links={navigationLinks(project)} activePageId={pageId}/>}
      <Body style={{ height: 'auto' }}/>
      {project.shared.footer.enabled && project.pages.find(page => page.id === pageId)?.showFooter !== false && <Footer {...project.shared.footer.props}/>}
    </main></> } };
}
function editorNodes(nodes: BodyNode[] | { id: string; type: string; props: object; children?: unknown[] }[]): Slot {
  return nodes.map(node => ({ type: node.type, props: { ...node.props, id: node.id, ...('children' in node ? { items: editorNodes(node.children as BodyNode[]) } : {}) } }));
}
function canonicalNodes(nodes: Slot): unknown[] {
  return nodes.map(node => {
    const { id, ...props } = node.props;
    if (['Section', 'Columns', 'Column'].includes(node.type)) {
      const { items, ...settings } = props;
      if (!Array.isArray(items)) throw new Error('Layout content is missing.');
      return { id, type: node.type, props: settings, children: canonicalNodes(items) };
    }
    return { id, type: node.type, props };
  });
}
export function toEditor(p: Project, pageId = p.pages[0].id): EditorData {
  const page = p.pages.find(page => page.id === pageId);
  if (!page) throw new Error('Page not found.');
  return { root: { props: { name: p.name, accent: p.theme.accent, font: p.theme.font, title: page.title, description: page.description, body: editorNodes(page.nodes) as EditorData['content'] } }, content: [] };
}
export function fromEditor(data: EditorData, previous: Project, pageId = previous.pages[0].id): Project {
  if (!data.root.props) throw new Error('Page settings are missing.');
  const previousPage = previous.pages.find(page => page.id === pageId);
  if (!previousPage) throw new Error('Page not found.');
  if (data.content.length) throw new Error('Place page sections in the page body.');
  const settings = data.root.props;
  const nodes = canonicalNodes(settings.body).map(raw => {
    const node = raw as BodyNode;
    const prior = previousPage.nodes.find(candidate => candidate.id === node.id && candidate.type === node.type);
    return prior?.reusable ? { ...node, reusable: prior.reusable } : node;
  });
  return projectSchema.parse({ ...previous, name: settings.name, updatedAt: new Date().toISOString(), theme: { ...previous.theme, accent: settings.accent, font: settings.font }, pages: previous.pages.map(page => page.id === pageId ? { ...page, title: settings.title, description: settings.description, nodes } : page) });
}

