import { designSchema, type DesignDocument, type DesignLayer } from '../design/schema';
import { readImageDimensions } from '../design/image-validation';
import { definitions, projectSchema, routeSchema, type BodyNode, type LeafNode, type Project, type Responsive, type SitePage } from '../project/schema';
import type { ResponsiveAppearance } from '../project/appearance-schema';
import { targetHref } from '../project/pages';
import { CONVERSION_ALGORITHM_VERSION, conversionPlanSchema, conversionRecordSchema, type ConversionDestination, type ConversionItem, type ConversionPlan, type ConversionRecord, type ConversionSection } from './schema';
import { absoluteRotation, ancestors, decorationBounds, effectiveOpacity, isVisible, layerGeometry, subtree } from './geometry';
import { fingerprint, sourceFingerprint, targetFingerprint } from './fingerprint';

export { decorationBounds } from './geometry';
export { sourceFingerprint, targetFingerprint } from './fingerprint';
export type { ConversionPlan, ConversionRecord, ConversionSection, ConversionItem, ConversionDestination } from './schema';
export interface ConversionIssue { id: string; severity: 'warning' | 'error'; code: string; message: string; layerIds: string[] }
export interface ConversionAnalysis { issues: ConversionIssue[]; canCompile: boolean }
export type ConversionComparison = 'current' | 'design-changed' | 'website-changed' | 'both-changed' | 'detached';
export interface ConversionOptions {
  acknowledgedWarnings?: string[];
  rasterizeDecoration?: (design: DesignDocument, artboardId: string, layerIds: string[]) => Promise<string>;
  now?: string;
  idFactory?: () => string;
  overwriteTargetChanges?: boolean;
  replacePageSettings?: boolean;
}
export interface ConversionResult { website: Project; record: ConversionRecord; issues: ConversionIssue[] }
export class ConversionError extends Error {
  constructor(message: string, public readonly issues: ConversionIssue[] = []) { super(message); this.name = 'ConversionError'; }
}
const rgba = (color: string, opacity: number) => {
  if (color === 'transparent' || opacity === 0) return 'transparent';
  const alpha = color.length === 9 ? parseInt(color.slice(7), 16) / 255 : 1;
  return opacity === 1 ? color : color.slice(0, 7) + Math.round(alpha * opacity * 255).toString(16).padStart(2, '0');
};
function fill(design: DesignDocument, layer: DesignLayer): string { return design.colors.find(style => style.id === layer.colorStyleId)?.value ?? layer.fill; }
function typography(design: DesignDocument, layer: DesignLayer) {
  const style = design.typeStyles.find(style => style.id === layer.typeStyleId);
  return { fontFamily: style?.fontFamily ?? layer.fontFamily, fontSize: style?.fontSize ?? layer.fontSize, fontWeight: style?.fontWeight ?? layer.fontWeight, lineHeight: style?.lineHeight ?? layer.lineHeight };
}
function hashKey(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  return (result >>> 0).toString(16).padStart(8, '0');
}
export function sectionAnchor(recordId: string, sectionId: string): string { return '#c-' + hashKey(recordId) + '-' + hashKey(sectionId); }
const ordered = (design: DesignDocument, layers: DesignLayer[]) => [...layers].sort((a, b) => { const left = layerGeometry(design, a).bounds, right = layerGeometry(design, b).bounds; return left.y - right.y || left.x - right.x || a.id.localeCompare(b.id); });
const entries = (plan: ConversionPlan) => plan.sections.flatMap(section => section.columns.flatMap(column => column.items.map(item => ({ section, column, item }))));
const presetFor = (count: number) => count === 4 ? 'quarters' : count === 3 ? 'thirds' : count === 2 ? 'halves' : 'stack';
function nativeAppearance(design: DesignDocument, layer: DesignLayer): ResponsiveAppearance {
  const opacity = effectiveOpacity(design, layer), font = typography(design, layer);
  const common: ResponsiveAppearance = { maxWidth: { mobile: Math.min(layer.width, 360), tablet: Math.min(layer.width, 720), desktop: layer.width }, radius: { mobile: layer.radius }, borderColor: { mobile: rgba(layer.stroke, opacity) }, borderWidth: { mobile: layer.strokeWidth } };
  return layer.type === 'text' ? { ...common, fontFamily: { mobile: font.fontFamily }, fontSize: { mobile: Math.min(font.fontSize, 40), tablet: Math.min(font.fontSize, 64), desktop: font.fontSize }, fontWeight: { mobile: font.fontWeight }, lineHeight: { mobile: font.lineHeight }, color: { mobile: rgba(fill(design, layer), opacity) } } : common;
}

/** Suggestions are a bounded draft. The wizard confirms semantics, order and responsive rules. */
export function suggestConversionPlan(input: DesignDocument, artboardId: string, project: Project): ConversionPlan {
  const design = designSchema.parse(input), website = projectSchema.parse(project);
  const board = design.artboards.find(value => value.id === artboardId);
  if (!board) throw new ConversionError('Choose an existing artboard to convert.');
  const roots = ordered(design, design.layers.filter(layer => layer.artboardId === artboardId && layer.parentId === null && isVisible(design, layer)));
  const groups: { frame: DesignLayer | null; layers: DesignLayer[]; lanes?: DesignLayer[][] }[] = [];
  const content = (root: DesignLayer): DesignLayer[] => ordered(design, design.layers.filter(layer => layer.parentId === root.id && isVisible(design, layer))).flatMap(layer => {
    if (['frame', 'group'].includes(layer.type) && subtree(design, [layer.id]).some(child => isVisible(design, child) && child.type === 'text' && child.text.trim())) return content(layer);
    return [layer];
  });
  let loose: DesignLayer[] = [];
  const flush = () => { if (loose.length) { groups.push({ frame: null, layers: loose }); loose = []; } };
  for (const root of roots) {
    const nested = subtree(design, [root.id]).filter(layer => isVisible(design, layer));
    if ((root.type === 'frame' || root.type === 'group') && nested.some(layer => layer.type === 'text' && layer.text.trim())) {
      flush();
      const branches = design.layers.filter(layer => layer.parentId === root.id && isVisible(design, layer)).sort((a, b) => layerGeometry(design, a).bounds.x - layerGeometry(design, b).bounds.x);
      const separated = branches.length >= 2 && branches.length <= 4 && branches.every(branch => ['frame', 'group'].includes(branch.type)) && branches.every((branch, index) => index === 0 || layerGeometry(design, branches[index - 1]).bounds.x + layerGeometry(design, branches[index - 1]).bounds.width <= layerGeometry(design, branch).bounds.x + 1);
      const lanes = separated ? branches.map(branch => subtree(design, [branch.id]).some(child => isVisible(design, child) && child.type === 'text' && child.text.trim()) ? content(branch) : [branch]) : undefined;
      groups.push({ frame: root, layers: lanes ? lanes.flat() : content(root), ...(lanes ? { lanes } : {}) });
    } else loose.push(root);
  }
  flush();
  if (!groups.length) groups.push({ frame: null, layers: [] });
  const texts = groups.flatMap(group => group.layers).filter(layer => layer.type === 'text' && layer.text.trim());
  const isButton = (layer: DesignLayer) => /\b(button|action|cta|link)\b/i.test(layer.name);
  const headline = [...texts].filter(layer => !isButton(layer)).sort((a, b) => typography(design, b).fontSize - typography(design, a).fontSize)[0]?.id ?? texts[0]?.id;
  let mapped = 0;
  const sections: ConversionSection[] = [];
  for (const [groupIndex, group] of groups.entries()) {
    for (let start = 0; start < Math.max(1, group.layers.length) && sections.length < 30 && mapped < 200; start += 80) {
      const chosen = group.layers.slice(start, start + Math.min(80, 200 - mapped)); mapped += chosen.length;
      const items: ConversionItem[] = chosen.map(layer => layer.type === 'text' ? { layerId: layer.id, role: isButton(layer) && layer.id !== headline ? 'button' : layer.id === headline || typography(design, layer).fontSize >= 28 ? 'heading' : 'paragraph', ...(layer.id === headline ? { level: 'h1' as const } : !isButton(layer) && typography(design, layer).fontSize >= 28 ? { level: 'h2' as const } : {}), appearance: nativeAppearance(design, layer) } : layer.type === 'image' ? { layerId: layer.id, role: 'image', alt: layer.name, appearance: nativeAppearance(design, layer) } : { layerId: layer.id, role: 'decoration' });
      const lanes = group.lanes?.map(lane => items.filter(item => lane.some(layer => layer.id === item.layerId)));
      const columns = lanes && lanes.every(lane => lane.length > 0 && lane.length <= 20) ? lanes.map((lane, index) => ({ id: `column-${groupIndex + 1}-${start / 80 + 1}-${index + 1}`, items: lane })) : Array.from({ length: Math.max(1, Math.ceil(items.length / 20)) }, (_, index) => ({ id: `column-${groupIndex + 1}-${start / 80 + 1}-${index + 1}`, items: items.slice(index * 20, (index + 1) * 20) }));
      const sectionBounds = group.frame ? layerGeometry(design, group.frame).bounds : { x: 0, y: 0, width: board.width, height: board.height };
      const inset = chosen.length ? Math.max(0, Math.min(400, ...chosen.map(layer => layerGeometry(design, layer).bounds.x - sectionBounds.x))) : 32;
      sections.push({ id: `section-${groupIndex + 1}-${start / 80 + 1}`, name: (group.frame?.name ?? 'Content').slice(0, 100), frameId: group.frame?.id ?? null, columns, layout: { mobile: 'stack', tablet: columns.length === 2 ? 'halves' : 'stack', desktop: presetFor(columns.length) }, gap: { mobile: 24, tablet: 32, desktop: 40 }, paddingX: { mobile: 24, tablet: Math.min(inset, 40), desktop: inset }, paddingY: { mobile: 24, tablet: 32, desktop: 40 }, contentGap: { mobile: 16, tablet: 20, desktop: 24 } });
    }
  }
  let path = '/designed-page', suffix = 2;
  while (website.pages.some(page => page.path === path)) path = '/designed-page-' + suffix++;
  return conversionPlanSchema.parse({ version: 1, artboardId, page: { name: board.name.slice(0, 60), path, title: board.name.slice(0, 120), description: '', inNavigation: true, showHeader: false, showFooter: false }, sections, contact: null });
}

/** Analysis never changes source data or silently drops unsupported meaningful content. */
export function analyzeConversion(input: DesignDocument, project: Project, draft: ConversionPlan, options: { targetPageId?: string } = {}): ConversionAnalysis {
  const issues: ConversionIssue[] = [];
  const issue = (severity: ConversionIssue['severity'], code: string, message: string, layerIds: string[] = [], context = '') => { issues.push({ id: code + '-' + hashKey(layerIds.join('|') + context), severity, code, message, layerIds }); };
  const parsedDesign = designSchema.safeParse(input), parsedWebsite = projectSchema.safeParse(project), parsedPlan = conversionPlanSchema.safeParse(draft);
  if (!parsedDesign.success || !parsedWebsite.success || !parsedPlan.success) {
    issue('error', 'invalid-document', (!parsedDesign.success ? parsedDesign.error : !parsedWebsite.success ? parsedWebsite.error : !parsedPlan.success ? parsedPlan.error : null)?.issues[0]?.message ?? 'The conversion input is invalid.');
    return { issues, canCompile: false };
  }
  const design = parsedDesign.data, website = parsedWebsite.data, plan = parsedPlan.data;
  const board = design.artboards.find(value => value.id === plan.artboardId);
  if (!board) { issue('error', 'missing-artboard', 'The source artboard has been deleted.'); return { issues, canCompile: false }; }
  if (!routeSchema.safeParse(plan.page.path).success) issue('error', 'invalid-path', 'Choose a valid website path such as /designed-page.');
  if (website.pages.some(page => page.path === plan.page.path && page.id !== options.targetPageId)) issue('error', 'path-conflict', 'That page path is already used. Choose a new path to preserve the existing page.');
  const mapped = entries(plan), byId = new Map(design.layers.map(layer => [layer.id, layer]));
  const covered = new Set<string>();
  const ownership = new Map<string, string>();
  const contactLayers = subtree(design, plan.contact?.sourceLayerIds ?? []);
  const contactIds = new Set(contactLayers.map(layer => layer.id));
  for (const id of plan.contact?.sourceLayerIds ?? []) if (byId.get(id)?.artboardId !== board.id) issue('error', 'missing-contact-source', 'The contact binding references a missing layer on this artboard.', [id]);
  if (plan.contact) issue('warning', 'contact-binding', 'Contact becomes a real form with fixed name, email and message fields. Confirm this replacement and its labels; editor preview sends no messages.', plan.contact.sourceLayerIds);
  if (plan.contact && (!plan.contact.title.trim() || !plan.contact.button.trim())) issue('error', 'empty-contact-label', 'Give the contact form a clear heading and submit-button label.');
  let headings = 0, outputCount = plan.contact ? 1 : 0;
  for (const section of plan.sections) {
    const frame = section.frameId === null ? null : byId.get(section.frameId);
    if (section.frameId !== null && (!frame || frame.artboardId !== board.id || !['frame', 'group'].includes(frame.type))) issue('error', 'missing-section-frame', 'A section must reference an existing frame/group on the selected artboard.', section.frameId ? [section.frameId] : [], section.id);
    let sectionCount = 0;
    for (const { item } of mapped.filter(entry => entry.section.id === section.id)) {
      const layer = byId.get(item.layerId);
      if (!layer || layer.artboardId !== board.id) { issue('error', 'missing-layer', 'A mapped source layer is missing from this artboard.', [item.layerId]); continue; }
      const claimed = item.role === 'decoration' ? subtree(design, [layer.id]) : [layer];
      for (const child of claimed) covered.add(child.id);
      if (item.role !== 'ignore') for (const child of claimed) {
        if (ownership.has(child.id)) issue('error', 'overlapping-source-mapping', 'This layer is already included through another mapped artwork or content item. Choose one mapping.', [child.id]);
        ownership.set(child.id, layer.id);
      }
      if (item.role !== 'ignore' && claimed.some(child => contactIds.has(child.id))) issue('error', 'duplicate-contact-mapping', 'Remove contact-bound layers from the section mappings so their content is not duplicated.', [layer.id]);
      if (!isVisible(design, layer)) issue('warning', 'hidden-source', 'This mapped layer is hidden in Design. Confirm whether it should be included on the website.', [layer.id]);
      if (item.role === 'ignore') { if (!contactIds.has(layer.id)) issue('warning', 'omitted-layer', 'This layer is explicitly omitted from the website. Review the lost content or artwork.', [layer.id]); continue; }
      sectionCount++; outputCount++;
      if (item.role === 'decoration') {
        if (claimed.some(child => isVisible(design, child) && child.type === 'text' && child.text.trim())) issue('error', 'rasterized-text', 'Artwork containing meaningful text cannot be flattened. Map its text to native headings, paragraphs or buttons instead.', [layer.id]);
        else {
          try { const bounds = decorationBounds(design, board.id, [layer.id]); if (bounds.width / bounds.height < 0.05 || bounds.width / bounds.height > 20) throw new Error('This artwork aspect ratio is outside the supported website image range. Choose a different decorative group.'); }
          catch (error) { issue('error', 'empty-artwork', error instanceof Error ? error.message : 'This artwork cannot be rendered.', [layer.id]); }
          issue('warning', 'decorative-image', 'This decorative artwork becomes a local image. Its geometry stays visual; meaningful text remains editable website text.', [layer.id]);
        }
        continue;
      }
      if (['heading', 'paragraph', 'button'].includes(item.role)) {
        if (layer.type !== 'text') issue('error', 'text-role-mismatch', 'Map a text layer to this heading, paragraph or button role.', [layer.id]);
        else if (!layer.text.trim()) issue('error', 'empty-text', 'Give this website text or button a nonempty label.', [layer.id]);
        else if (layer.text.length > 4000) issue('error', 'text-too-long', 'This text exceeds the website limit of 4,000 characters. Split it into separate source layers; conversion will not truncate it.', [layer.id]);
        if (item.role === 'heading') { if (!item.level) issue('error', 'missing-heading-level', 'Choose a heading level.', [layer.id]); else if (item.level === 'h1') headings++; }
      } else if (item.role === 'image') {
        if (layer.type !== 'image') issue('error', 'image-role-mismatch', 'Map an image layer to the image role, or use Decoration for artwork.', [layer.id]);
        const asset = design.assets.find(asset => asset.id === layer.assetId);
        if (!asset) issue('error', 'missing-image', 'This image has no embedded asset.', [layer.id]);
        else {
          try { const size = readImageDimensions(asset.dataUrl); if (size.width !== asset.width || size.height !== asset.height) throw new Error('Encoded image dimensions do not match its saved metadata.'); }
          catch (error) { issue('error', 'invalid-image', error instanceof Error ? error.message : 'The source image is invalid.', [layer.id]); }
        }
        if (!item.alt?.trim()) issue('error', 'missing-image-alt', 'Describe this meaningful image for people who cannot see it. Use Decoration only for nonessential artwork.', [layer.id]);
        if (!item.appearance?.aspectRatio && (layer.width / layer.height < 0.05 || layer.width / layer.height > 20)) issue('error', 'image-ratio', 'Choose a supported responsive aspect ratio between 0.05 and 20 for this image.', [layer.id]);
        if (effectiveOpacity(design, layer) < 1) issue('warning', 'image-opacity', 'Website images use their original opacity. This translucent image needs an approved appearance change or decorative-image mapping.', [layer.id]);
      }
      if (Math.abs(((absoluteRotation(design, layer) % 360) + 360) % 360) > 1e-6) issue('warning', 'meaningful-rotation', 'This meaningful layer or its parent is rotated. Semantic website flow keeps the content upright; confirm that difference.', [layer.id]);
      if (layerGeometry(design, layer).clipped) issue('warning', 'meaningful-clipping', 'Design clips part of this meaningful content. The website preserves the complete text/image in flow instead of hiding it.', [layer.id]);
      if (ancestors(design, layer).some(parent => parent.id !== section.frameId && parent.type === 'frame')) issue('warning', 'nested-frame', 'Nested frame styling/clipping is simplified into the confirmed section/column layout.', [layer.id]);
      if (item.role === 'button') {
        const destination = item.destination;
        if (!destination) issue('error', 'missing-destination', 'Choose a real destination for this button.', [layer.id]);
        else if (destination.kind === 'section') {
          if (!plan.sections.some(section => section.id === destination.sectionId && section.columns.some(column => column.items.some(item => item.role !== 'ignore'))) && !(destination.sectionId === 'contact' && plan.contact)) issue('error', 'missing-destination', 'This button points to a missing or empty converted section.', [layer.id]);
        } else if (destination.kind === 'page') {
          if (!targetHref(website, { pageId: destination.pageId, anchor: destination.anchor })) issue('error', 'missing-destination', 'This button points to a missing website page or anchor.', [layer.id]);
        } else {
          const result = definitions.Button.safeParse({ label: layer.text, target: { pageId: website.pages[0].id, anchor: '#top' }, variant: 'solid', shape: 'rounded', motion: 'none', destination });
          if (!result.success) issue('error', 'invalid-destination', 'Use a complete HTTP(S) URL without credentials, a bare email address, or a valid phone number.', [layer.id]);
        }
      }
    }
    if (!sectionCount) issue('warning', 'empty-section', 'This section has no mapped output and will be omitted.', [], section.id);
    if (sectionCount && section.columns.length > 1 && section.columns.some(column => column.items.every(item => item.role === 'ignore'))) issue('error', 'empty-column', 'Every column needs mapped website content. Remove an empty column or map its content.', [], section.id);
    for (const breakpoint of ['mobile', 'tablet', 'desktop'] as const) {
      const layout = section.layout[breakpoint] ?? (breakpoint === 'desktop' ? section.layout.tablet : undefined) ?? section.layout.mobile;
      const required = layout === 'stack' ? section.columns.length : layout === 'thirds' ? 3 : layout === 'quarters' ? 4 : 2;
      if (layout !== 'stack' && required !== section.columns.length) issue('error', 'column-count', `The ${breakpoint} layout needs ${required} columns, but this section has ${section.columns.length}.`, [], section.id + breakpoint);
      const inset = section.paddingX[breakpoint] ?? (breakpoint === 'desktop' ? section.paddingX.tablet : undefined) ?? section.paddingX.mobile;
      if (inset * 2 >= (breakpoint === 'mobile' ? 390 : breakpoint === 'tablet' ? 768 : 1280)) issue('error', 'narrow-content', `The ${breakpoint} horizontal padding leaves no usable content space. Reduce it before approval.`, [], section.id + breakpoint);
    }
    for (const column of section.columns) {
      const meaningful = column.items.filter(item => ['heading', 'paragraph', 'button', 'image'].includes(item.role)).flatMap(item => byId.get(item.layerId) ? [byId.get(item.layerId)!] : []);
      for (let i = 0; i < meaningful.length; i++) for (let j = i + 1; j < meaningful.length; j++) {
        const a = layerGeometry(design, meaningful[i]).bounds, b = layerGeometry(design, meaningful[j]).bounds;
        if (Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1) issue('warning', 'overlapping-content', 'These meaningful layers overlap in Design. The confirmed reading order places them separately in website flow.', [meaningful[i].id, meaningful[j].id]);
      }
    }
  }
  if (headings !== 1) issue('error', 'page-heading', 'Choose exactly one H1 page heading; use H2–H4 for other headings.');
  if (!outputCount) issue('error', 'empty-output', 'Map meaningful content or a contact form before creating a page.');
  const omitted = design.layers.filter(layer => layer.artboardId === board.id && isVisible(design, layer) && layer.type !== 'group' && layer.type !== 'frame' && !covered.has(layer.id) && !contactIds.has(layer.id));
  if (omitted.length) issue('warning', 'unmapped-content', 'Visible source layers are outside this conversion plan. Confirm these omissions or add them to the reading order.', omitted.map(layer => layer.id));
  issue('warning', 'responsive-flow', 'Absolute positions become semantic flow. Confirm mobile, tablet and desktop layouts, spacing, text sizes and reading order in the comparison preview.');
  return { issues, canCompile: !issues.some(issue => issue.severity === 'error') };
}

function requireApproval(analysis: ConversionAnalysis, acknowledged: readonly string[]): void {
  const accepted = new Set(acknowledged);
  const unresolved = analysis.issues.filter(issue => issue.severity === 'error' || !accepted.has(issue.id));
  if (unresolved.length) throw new ConversionError(unresolved.some(issue => issue.severity === 'error') ? unresolved.find(issue => issue.severity === 'error')!.message : 'Review and acknowledge each conversion warning before creating the page.', unresolved);
}
function destinationTarget(destination: ConversionDestination | undefined, website: Project, pageId: string, recordId: string) {
  if (!destination) throw new ConversionError('Choose a real button destination.');
  return destination.kind === 'section' ? { target: { pageId, anchor: destination.sectionId === 'contact' ? '#contact' : sectionAnchor(recordId, destination.sectionId) } } : destination.kind === 'page' ? { target: { pageId: destination.pageId, anchor: destination.anchor } } : { target: { pageId, anchor: '#top' }, destination };
}
const inherited = (value: Responsive<number>) => ({ mobile: value.mobile, ...(value.tablet === undefined ? {} : { tablet: value.tablet }), ...(value.desktop === undefined ? {} : { desktop: value.desktop }) });

async function buildRoots(design: DesignDocument, website: Project, plan: ConversionPlan, recordId: string, pageId: string, options: ConversionOptions): Promise<BodyNode[]> {
  const board = design.artboards.find(board => board.id === plan.artboardId)!;
  const nodeId = async (key: string) => 'c-' + recordId.slice(0, 32) + '-' + (await fingerprint(key)).slice(0, 24);
  const roots: BodyNode[] = [];
  for (const section of plan.sections) {
    const frame = design.layers.find(layer => layer.id === section.frameId);
    const columns = [];
    for (const column of section.columns) {
      const children: LeafNode[] = [];
      for (const item of column.items) {
        if (item.role === 'ignore') continue;
        const layer = design.layers.find(layer => layer.id === item.layerId)!;
        const id = await nodeId('item:' + item.layerId);
        let appearance: ResponsiveAppearance = { ...nativeAppearance(design, layer), ...item.appearance };
        if (item.role === 'heading') children.push({ id, type: 'Heading', props: { text: layer.text, level: item.level!, size: 'large', align: layer.textAlign, appearance } });
        else if (item.role === 'paragraph') children.push({ id, type: 'Paragraph', props: { text: layer.text, align: layer.textAlign, appearance } });
        else if (item.role === 'button') {
          appearance = { ...appearance, paddingX: appearance.paddingX ?? { mobile: 20 }, paddingY: appearance.paddingY ?? { mobile: 12 } };
          children.push({ id, type: 'Button', props: { label: layer.text, ...destinationTarget(item.destination, website, pageId, recordId), variant: 'solid', shape: 'rounded', motion: 'none', appearance } });
        } else if (item.role === 'image') {
          const asset = design.assets.find(asset => asset.id === layer.assetId)!;
          appearance = { ...appearance, aspectRatio: appearance.aspectRatio ?? { mobile: layer.width / layer.height } };
          children.push({ id, type: 'Image', props: { image: asset.dataUrl, alt: item.alt!, ratio: layer.width === layer.height ? 'square' : layer.width > layer.height ? 'landscape' : 'portrait', radius: 'none', appearance } });
        } else {
          if (!options.rasterizeDecoration) throw new ConversionError('Decorative artwork needs the visual rasterizer. Map it as Ignore only if you intend to omit it.');
          const bounds = decorationBounds(design, board.id, [layer.id]);
          const dataUrl = await options.rasterizeDecoration(design, board.id, [layer.id]);
          const dimensions = readImageDimensions(dataUrl);
          if (!dataUrl.startsWith('data:image/png;base64,') || dataUrl.length > 3_000_000 || dimensions.width * dimensions.height > 24_000_000) throw new ConversionError('Flattened artwork must be a PNG under the website image limits.');
          const ratio = bounds.width / bounds.height;
          if (ratio < 0.05 || ratio > 20) throw new ConversionError('This artwork aspect ratio is outside the supported website image range. Keep it in Design or choose a different decorative group.');
          appearance = { maxWidth: { mobile: Math.min(bounds.width, 360), tablet: Math.min(bounds.width, 720), desktop: bounds.width }, aspectRatio: { mobile: ratio }, ...item.appearance };
          children.push({ id, type: 'Image', props: { image: dataUrl, alt: '', ratio: ratio === 1 ? 'square' : ratio > 1 ? 'landscape' : 'portrait', radius: 'none', appearance } });
        }
      }
      if (children.length) columns.push({ id: await nodeId('column:' + column.id), type: 'Column' as const, props: { gap: { mobile: 0 }, align: 'start' as const, appearance: { gap: inherited(section.contentGap) } }, children });
    }
    if (!columns.length) continue;
    if (columns.length !== section.columns.length && section.columns.length > 1) throw new ConversionError('Every column in a multi-column section needs website content. Remove empty columns or map their content.');
    const children = section.columns.length === 1 ? columns[0].children : [{ id: await nodeId('columns:' + section.id), type: 'Columns' as const, props: { layout: section.layout, gap: { mobile: 0 }, align: 'start' as const, appearance: { gap: inherited(section.gap) } }, children: columns }];
    roots.push({ id: await nodeId('section:' + section.id), type: 'Section', props: { anchor: sectionAnchor(recordId, section.id), padding: { mobile: 0 }, width: 'full', tone: 'plain', appearance: { background: { mobile: frame ? rgba(fill(design, frame), effectiveOpacity(design, frame)) : board.background }, borderColor: { mobile: frame ? rgba(frame.stroke, effectiveOpacity(design, frame)) : 'transparent' }, borderWidth: { mobile: frame?.strokeWidth ?? 0 }, radius: { mobile: frame?.radius ?? 0 }, paddingX: inherited(section.paddingX), paddingY: inherited(section.paddingY), gap: inherited(section.contentGap), maxWidth: { mobile: 12000 } } }, children });
  }
  if (plan.contact) {
    const source = design.layers.find(layer => plan.contact!.sourceLayerIds.includes(layer.id) && ['frame', 'group'].includes(layer.type));
    const sourceSection = plan.sections.find(section => section.frameId === source?.id);
    roots.push({ id: await nodeId('contact'), type: 'Contact', props: { title: plan.contact.title, description: plan.contact.description, button: plan.contact.button, appearance: { background: { mobile: source ? rgba(fill(design, source), effectiveOpacity(design, source)) : board.background }, fontFamily: { mobile: 'Arial' }, maxWidth: { mobile: source?.width ?? board.width }, paddingX: sourceSection?.paddingX ?? { mobile: 24, tablet: 40, desktop: 64 }, paddingY: sourceSection?.paddingY ?? { mobile: 32, desktop: 64 }, ...plan.contact.appearance }, ...(plan.contact.buttonAppearance ? { buttonAppearance: plan.contact.buttonAppearance } : {}), ...(plan.contact.fieldAppearance ? { fieldAppearance: plan.contact.fieldAppearance } : {}) } });
  }
  return roots;
}
async function compile(input: DesignDocument, project: Project, draft: ConversionPlan, options: ConversionOptions, prior?: ConversionRecord): Promise<ConversionResult> {
  const design = designSchema.parse(input), website = projectSchema.parse(project), plan = conversionPlanSchema.parse(draft);
  const analysis = analyzeConversion(design, website, plan, { targetPageId: prior?.pageId });
  requireApproval(analysis, options.acknowledgedWarnings ?? []);
  const now = options.now ?? new Date().toISOString(), idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const id = prior?.id ?? idFactory(), pageId = prior?.pageId ?? idFactory();
  if (!prior && website.pages.some(page => page.id === pageId)) throw new ConversionError('A generated page identifier already exists. Create a new conversion.');
  const roots = await buildRoots(design, website, plan, id, pageId, options);
  let page: SitePage;
  if (prior) {
    const current = website.pages.find(page => page.id === prior.pageId);
    if (!current || prior.targetRootIds.some(id => !current.nodes.some(node => node.id === id))) throw new ConversionError('This conversion is detached. Create a new page to preserve the remaining website content.');
    const owned = new Set(prior.targetRootIds);
    let nextRoot = 0;
    const nodes: BodyNode[] = [];
    const lastOwned = current.nodes.reduce((last, node, index) => owned.has(node.id) ? index : last, -1);
    current.nodes.forEach((node, index) => {
      if (!owned.has(node.id)) nodes.push(node);
      else if (roots[nextRoot]) nodes.push(roots[nextRoot++]);
      if (index === lastOwned) while (nextRoot < roots.length) nodes.push(roots[nextRoot++]);
    });
    page = { ...current, ...(options.replacePageSettings ? plan.page : {}), nodes };
  } else page = { id: pageId, ...plan.page, nodes: roots };
  const next = projectSchema.parse({ ...website, updatedAt: now, pages: prior ? website.pages.map(value => value.id === pageId ? page : value) : [...website.pages, page] });
  const targetRootIds = roots.map(root => root.id);
  const record = conversionRecordSchema.parse({ version: 1, id, algorithmVersion: CONVERSION_ALGORITHM_VERSION, createdAt: prior?.createdAt ?? now, updatedAt: now, artboardId: plan.artboardId, pageId, targetRootIds, sourceFingerprint: await sourceFingerprint(design, plan.artboardId), targetFingerprint: await targetFingerprint(next, pageId, targetRootIds), plan, acknowledgedWarnings: analysis.issues.filter(issue => issue.severity === 'warning').map(issue => issue.id) });
  return { website: next, record, issues: analysis.issues };
}
export function compileConversion(design: DesignDocument, website: Project, plan: ConversionPlan, options: ConversionOptions = {}): Promise<ConversionResult> { return compile(design, website, plan, options); }
export async function compareConversion(design: DesignDocument, website: Project, provenance: ConversionRecord): Promise<ConversionComparison> {
  const record = conversionRecordSchema.parse(provenance);
  const page = website.pages.find(page => page.id === record.pageId);
  const sourceIds = entries(record.plan).map(entry => entry.item.layerId).concat(record.plan.sections.flatMap(section => section.frameId ? [section.frameId] : []), record.plan.contact?.sourceLayerIds ?? []);
  if (!design.artboards.some(board => board.id === record.artboardId) || sourceIds.some(id => !design.layers.some(layer => layer.id === id && layer.artboardId === record.artboardId)) || !page || record.targetRootIds.some(id => !page.nodes.some(node => node.id === id))) return 'detached';
  const [source, target] = await Promise.all([sourceFingerprint(design, record.artboardId), targetFingerprint(website, record.pageId, record.targetRootIds)]);
  const sourceChanged = source !== record.sourceFingerprint, targetChanged = target !== record.targetFingerprint;
  return sourceChanged && targetChanged ? 'both-changed' : sourceChanged ? 'design-changed' : targetChanged ? 'website-changed' : 'current';
}
export async function updateConversion(design: DesignDocument, website: Project, record: ConversionRecord, plan: ConversionPlan = record.plan, options: ConversionOptions = {}): Promise<ConversionResult> {
  const comparison = await compareConversion(design, website, record);
  if (comparison === 'detached') throw new ConversionError('This conversion is detached. Create a new page instead.');
  if ((comparison === 'website-changed' || comparison === 'both-changed') && !options.overwriteTargetChanges) throw new ConversionError('The converted website sections changed in Build. Save a new page or explicitly confirm replacing only those sections.');
  return compile(design, website, plan, options, conversionRecordSchema.parse(record));
}
