import { useState } from 'react';
import { pathForName, resizeNode, subtreeIds, updateNode, updatePage } from '../doc/ops';
import { mapSrc } from '../render/element';
import { readImageFile } from './images';
import { SAMPLE_CODE } from './actions';
import { BLEND_MODES, CURSORS, ENTER_TYPES, fontFamilySchema, HOVER_TYPES, LOOP_TYPES, pathSchema, SCROLL_TYPES, siteSettingsSchema, type EmbedNode, type SiteSettings, type Constraints, type Motion, type Effect, type FrameNode, type Layout, type Paint, type SiteNode, type TextNode, type TextStyle } from '../doc/schema';
import { setSizing, sizingOptions } from './autolayout';
import { detachInstance, instancesOf } from '../doc/components';
import { pageOf } from '../doc/ops';
import { INPUT_TYPES, linkSchema, type Page, type SiteDoc, type Variable } from '../doc/schema';
import { guessInputType } from '../doc/interactive';
import { addVariable, removeVariable, updateVariable } from '../doc/variables';
import { duplicateSelection } from './actions';
import { overrideSummary } from './breakpointView';
import { FONTS } from './fonts';
import { shapeD } from './vector';
import { toggleAutoLayout } from './actions';
import { ColorField, IconButton, NumberField, Section, Segmented, Select, TextField, type Gesture } from './controls';
import { AlignBottom, AlignCenterHorizontal, AlignCenterVertical, AlignLeft, AlignRight, AlignTop, ArrowsHorizontal, ArrowsVertical, BoundingBox, Columns, Eye, EyeSlash, FrameCorners, Minus, Plus, Rows, SelectionPlus, SquaresFour, Trash, X } from './icons';
import { align, distribute, topLevelSelection, wrapSelection, type Measure } from './arrange';
import { deleteSelection } from './actions';
import { useEditor, type EditorStore } from './store';

const FRAME_TAGS = [['div', 'Div'], ['button', 'Button (clickable)'], ['section', 'Section'], ['header', 'Header'], ['footer', 'Footer'], ['nav', 'Navigation'], ['main', 'Main'], ['article', 'Article'], ['aside', 'Aside']] as const;
const TEXT_TAGS = [['p', 'Paragraph'], ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['h4', 'Heading 4'], ['h5', 'Heading 5'], ['h6', 'Heading 6'], ['span', 'Inline text'], ['input', 'Input field'], ['textarea', 'Text area (multi-line)']] as const;
const INPUT_LABELS = { text: 'Text', email: 'Email', password: 'Password', tel: 'Phone number', number: 'Number', search: 'Search', url: 'Web address' } as const;
const WEIGHTS = [[100, 'Thin'], [200, 'Extra light'], [300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold'], [900, 'Black']] as const;
const TYPE_LABEL: Record<SiteNode['type'], string> = { frame: 'Frame', text: 'Text', rect: 'Rectangle', ellipse: 'Ellipse', image: 'Image', vector: 'Vector', embed: 'Embed' };

/** Align / distribute bar for freely positioned layers (a single layer aligns within its parent). */
function AlignBar({ store, measure, count }: { store: EditorStore; measure: Measure; count: number }) {
  const run = (edge: Parameters<typeof align>[2]) => align(store, measure, edge);
  return (
    <div className="ed-align" role="toolbar" aria-label="Alignment">
      <IconButton label="Align left" shortcut="Alt+A" onClick={() => run('left')}><AlignLeft size={16} /></IconButton>
      <IconButton label="Align horizontal centers" shortcut="Alt+H" onClick={() => run('hcenter')}><AlignCenterHorizontal size={16} /></IconButton>
      <IconButton label="Align right" shortcut="Alt+D" onClick={() => run('right')}><AlignRight size={16} /></IconButton>
      <IconButton label="Align top" shortcut="Alt+W" onClick={() => run('top')}><AlignTop size={16} /></IconButton>
      <IconButton label="Align vertical centers" shortcut="Alt+V" onClick={() => run('vcenter')}><AlignCenterVertical size={16} /></IconButton>
      <IconButton label="Align bottom" shortcut="Alt+S" onClick={() => run('bottom')}><AlignBottom size={16} /></IconButton>
      <IconButton label="Distribute horizontal spacing" shortcut="Alt+Shift+H" disabled={count < 3} onClick={() => distribute(store, measure, 'h')}><ArrowsHorizontal size={16} /></IconButton>
      <IconButton label="Distribute vertical spacing" shortcut="Alt+Shift+V" disabled={count < 3} onClick={() => distribute(store, measure, 'v')}><ArrowsVertical size={16} /></IconButton>
    </div>
  );
}

export function DesignPanel({ store, measure, onReplaceImage, onCode }: { store: EditorStore; measure: Measure; onReplaceImage: (id: string) => void; onCode: (id: string) => void }) {
  const selection = useEditor(store, state => state.selection);
  const doc = useEditor(store, state => state.doc);
  const pageId = useEditor(store, state => state.pageId);
  const gesture: Gesture = { begin: () => store.beginGesture(), end: () => store.endGesture() };
  const [showMinMax, setShowMinMax] = useState(false);
  const breakpoint = useEditor(store, state => state.breakpoint);

  if (selection.length > 1) {
    const ids = topLevelSelection(doc, selection);
    const sameParent = ids.length > 0 && ids.every(id => doc.nodes[id].parentId === doc.nodes[ids[0]].parentId);
    return (
      <div className="ed-panel-body">
        <AlignBar store={store} measure={measure} count={ids.length} />
        <Section title={`${selection.length} layers selected`}>
          <div className="ed-grid2">
            <button type="button" className="ed-btn" disabled={!sameParent} onClick={() => wrapSelection(store, measure, 'group')} title="Group selection (Ctrl+G)"><BoundingBox size={14} /> Group</button>
            <button type="button" className="ed-btn" disabled={!sameParent} onClick={() => wrapSelection(store, measure, 'frame')} title="Frame selection (Ctrl+Alt+G)"><FrameCorners size={14} /> Frame</button>
          </div>
          <button type="button" className="ed-btn" onClick={() => deleteSelection(store)}><Trash size={14} /> Delete</button>
          {!sameParent && <p className="ed-hint">Layers from different frames can be aligned, but only layers in the same frame can be grouped.</p>}
          <p className="ed-hint"><SelectionPlus size={12} /> Shift-click or drag a marquee to change the selection.</p>
        </Section>
      </div>
    );
  }
  const node = selection.length === 1 ? doc.nodes[selection[0]] : undefined;
  if (!node) {
    const page = doc.pages.find(value => value.id === pageId) ?? doc.pages[0];
    const setPage = (patch: Parameters<typeof updatePage>[2]) => store.commit(current => updatePage(current, page.id, patch));
    return (
      <div className="ed-panel-body">
        <Section title="Page">
          <TextField label="Name" value={page.name} onChange={name => setPage({ name: name.trim().slice(0, 60) || page.name })} />
          <TextField label="Address" value={page.path} onChange={path => setPage({ path })}
            validate={path => (page.path === '/' && path !== '/' ? 'The home page always lives at /.' : pathSchema.safeParse(path).success ? null : 'Use a path such as /about or /work/design.')} />
          <button type="button" className="ed-btn" onClick={() => onCode(page.rootId)} title="HTML + CSS or React code for this page">{'</>'} Copy page code</button>
          {page.path !== '/' && <button type="button" className="ed-link-btn" onClick={() => setPage({ path: pathForName({ ...doc, pages: doc.pages.filter(p => p.id !== page.id) }, page.name) })}>Use address from name</button>}
        </Section>
        <Section title="Search & sharing">
          <TextField label="Title" value={page.title} placeholder={page.name} onChange={title => setPage({ title: title.slice(0, 120) })} />
          <TextField label="Description" value={page.description} multiline onChange={description => setPage({ description: description.slice(0, 320) })} />
        </Section>
        <Section title="Site">
          <TextField label="Site name" value={doc.name} onChange={name => store.commit(current => ({ ...current, name: name.trim().slice(0, 120) || current.name }))} />
        </Section>
        <SiteSettingsSection store={store} doc={doc} />
        <ColorsSection store={store} doc={doc} gesture={gesture} />
        <p className="ed-hint ed-pad">Select a layer on the canvas or in Layers to edit it.</p>
      </div>
    );
  }

  const isRoot = doc.pages.some(page => page.rootId === node.id);
  const parent = node.parentId ? doc.nodes[node.parentId] : null;
  const parentFlow = parent?.type === 'frame' && parent.layout.mode !== 'none';
  const inFlow = parentFlow && !node.absolute;
  const patch = (value: Partial<SiteNode> & Record<string, unknown>) => store.commit(current => updateNode(current, node.id, value));
  const sizing = (axis: 'h' | 'v', mode: 'fixed' | 'hug' | 'fill') => store.commit(current => setSizing(current, node.id, axis, mode));
  const sizeOptions = (axis: 'h' | 'v') => sizingOptions(doc, node.id, axis).map(mode => [mode, { fixed: 'Fixed', hug: 'Hug', fill: 'Fill' }[mode]] as const);
  const hasMinMax = [node.minWidth, node.maxWidth, node.minHeight, node.maxHeight].some(value => value !== null);

  return (
    <div className="ed-panel-body" key={node.id}>
      {!isRoot && !inFlow && <AlignBar store={store} measure={measure} count={1} />}
      {breakpoint !== 'desktop' && <BreakpointNote store={store} node={node} breakpoint={breakpoint} />}
      <Section title={TYPE_LABEL[node.type]}>
        <TextField label="Name" value={node.name} onChange={name => patch({ name: name.trim().slice(0, 120) || node.name })} />
        <button type="button" className="ed-btn" onClick={() => onCode(node.id)} title="HTML + CSS or React code for this layer">{'</>'} Copy code</button>
        {node.type === 'frame' && <Select label="HTML element" value={node.tag} options={FRAME_TAGS} onChange={tag => patch({ tag })} title="Semantic element used on the website" />}
        {node.type === 'text' && <Select label="HTML element" value={node.tag} options={TEXT_TAGS} title="Headings help search engines and screen readers. Input fields can be typed into on the site."
          onChange={tag => patch(tag === 'input' ? { tag, inputType: node.inputType ?? guessInputType(node.text + ' ' + node.name) } : { tag })} />}
        {node.type === 'text' && node.tag === 'input' && <Select label="Field type" value={node.inputType ?? 'text'} options={INPUT_TYPES.map(type => [type, INPUT_LABELS[type]] as const)} onChange={inputType => patch({ inputType })} title="Phones show the matching keyboard; passwords are hidden while typing" />}
        {node.type === 'text' && (node.tag === 'input' || node.tag === 'textarea') && <p className="ed-hint">Visitors can type here on the site. The text is shown as the placeholder.</p>}
        {node.type === 'frame' && node.tag === 'button' && !node.link && <p className="ed-hint">Clickable on the site. Choose what it does under Link.</p>}
      </Section>

      <Section title="Position & size">
        {!isRoot && (
          <div className="ed-grid2">
            <NumberField label="X" value={node.x} disabled={inFlow} title={inFlow ? 'Positioned by auto layout' : undefined} gesture={gesture} onChange={x => patch({ x })} />
            <NumberField label="Y" value={node.y} disabled={inFlow} title={inFlow ? 'Positioned by auto layout' : undefined} gesture={gesture} onChange={y => patch({ y })} />
          </div>
        )}
        <div className="ed-size-row">
          <NumberField label="W" value={node.width} min={1} disabled={isRoot} title={isRoot ? 'Pages always span the browser width' : node.sizing.h !== 'fixed' ? 'Typing a width makes it fixed' : undefined} gesture={gesture}
            onChange={width => store.commit(current => resizeNode(updateNode(current, node.id, { sizing: { ...current.nodes[node.id].sizing, h: 'fixed' } }), node.id, { width }))} />
          <Select value={node.sizing.h} options={sizeOptions('h')} disabled={isRoot} onChange={mode => sizing('h', mode)} title="Width: fixed, hug contents, or fill the container" />
        </div>
        <div className="ed-size-row">
          <NumberField label="H" value={node.height} min={1} gesture={gesture} title={node.sizing.v !== 'fixed' ? 'Typing a height makes it fixed' : undefined}
            onChange={height => store.commit(current => resizeNode(updateNode(current, node.id, { sizing: { ...current.nodes[node.id].sizing, v: 'fixed' } }), node.id, { height }))} />
          <Select value={node.sizing.v} options={sizeOptions('v')} onChange={mode => sizing('v', mode)} title="Height: fixed, hug contents, or fill the container" />
        </div>
        {(hasMinMax || showMinMax) ? (
          <div className="ed-grid2" aria-label="Minimum and maximum size">
            {([['minWidth', 'Min W'], ['maxWidth', 'Max W'], ['minHeight', 'Min H'], ['maxHeight', 'Max H']] as const).map(([key, label]) => (
              <div className="ed-minmax" key={key}>
                <NumberField label={label} value={node[key] ?? 0} mixed={node[key] === null} min={0} gesture={gesture} onChange={value => patch({ [key]: value })} wide />
                {node[key] !== null && <IconButton label={'Remove ' + label.toLowerCase()} onClick={() => patch({ [key]: null })}><X size={12} /></IconButton>}
              </div>
            ))}
          </div>
        ) : !isRoot && <button type="button" className="ed-link-btn" onClick={() => setShowMinMax(true)}>+ Min / max size</button>}
        {!isRoot && <div className="ed-grid2">
          <NumberField label="↻" value={node.rotation} min={-360} max={360} suffix="°" title="Rotation" gesture={gesture} onChange={rotation => patch({ rotation })} />
          {parentFlow && (
            <label className="ed-check" title="Position this layer freely on top of the auto layout">
              <input type="checkbox" checked={node.absolute} onChange={event => store.commit(current => {
                const absolute = event.target.checked, n = current.nodes[node.id];
                return updateNode(current, node.id, { absolute, ...(absolute ? { sizing: { h: n.sizing.h === 'fill' ? 'fixed' : n.sizing.h, v: n.sizing.v === 'fill' ? 'fixed' : n.sizing.v } } : {}) });
              })} /> Ignore auto layout
            </label>
          )}
        </div>}
        {!isRoot && !inFlow && (
          <div className="ed-constraints">
            <ConstraintBox value={node.constraints} onChange={constraints => patch({ constraints })} />
            <div className="ed-constraint-selects">
              <Select label="Horizontal" value={node.constraints.h} title="How this layer responds when its frame changes width"
                options={[['left', 'Left'], ['right', 'Right'], ['leftRight', 'Left & right'], ['center', 'Center'], ['scale', 'Scale']]} onChange={h => patch({ constraints: { ...node.constraints, h } })} />
              <Select label="Vertical" value={node.constraints.v} title="How this layer responds when its frame changes height"
                options={[['top', 'Top'], ['bottom', 'Bottom'], ['topBottom', 'Top & bottom'], ['center', 'Center'], ['scale', 'Scale']]} onChange={v => patch({ constraints: { ...node.constraints, v } })} />
            </div>
          </div>
        )}
      </Section>

      {node.type === 'frame' && <AutoLayoutSection node={node} patch={patch} gesture={gesture} store={store} measure={measure} />}
      {node.type === 'embed' && <EmbedSection node={node} patch={patch} />}
      {!isRoot && (inFlow || node.type === 'frame') && <ScrollSection node={node} inFlow={!!inFlow} patch={patch} gesture={gesture} />}

      <Section title="Appearance">
        <div className="ed-grid2">
          <NumberField label="◐" value={Math.round(node.opacity * 100)} min={0} max={100} precision={0} suffix="%" title="Opacity" gesture={gesture} onChange={value => patch({ opacity: value / 100 })} />
          {node.type !== 'ellipse' && node.type !== 'text' && (
            <NumberField label="◜" value={node.radius[0]} mixed={new Set(node.radius).size > 1} min={0} title="Corner radius" gesture={gesture} onChange={r => patch({ radius: [r, r, r, r] })} />
          )}
        </div>
        <label className="ed-check"><input type="checkbox" checked={node.visible} onChange={event => patch({ visible: event.target.checked })} /> Visible</label>
        <div className="ed-grid2">
          <Select label="Blend" value={node.blend ?? 'normal'} options={BLEND_MODES.map(mode => [mode, BLEND_LABEL[mode]] as const)} onChange={blend => patch({ blend: blend === 'normal' ? undefined : blend })} title="How this layer mixes with what is behind it" />
          <Select label="Cursor" value={node.cursor ?? 'auto'} options={CURSORS.map(cursor => [cursor, CURSOR_LABEL[cursor]] as const)} onChange={cursor => patch({ cursor: cursor === 'auto' ? undefined : cursor })} title="Mouse pointer over this layer on the site" />
        </div>
      </Section>

      {node.type === 'text' && <TextSection node={node} patch={patch} gesture={gesture} />}
      {node.type === 'image' && (
        <Section title="Image">
          <TextField label="Alt text" value={node.alt} placeholder="Describe the image for screen readers" onChange={alt => patch({ alt: alt.slice(0, 500) })} />
          <Select label="Scaling" value={node.fit} options={[['cover', 'Fill (crop)'], ['contain', 'Fit'], ['fill', 'Stretch']]} onChange={fit => patch({ fit })} />
          <button type="button" className="ed-btn" onClick={() => onReplaceImage(node.id)}>Replace image…</button>
        </Section>
      )}
      {node.type === 'vector' && node.shape && (
        <Section title={node.shape.kind === 'star' ? 'Star' : 'Polygon'}>
          <div className="ed-grid2">
            <NumberField label="Points" value={node.shape.points} min={3} max={60} precision={0} gesture={gesture} title="Number of corners" wide
              onChange={points => { const shape = { ...node.shape!, points: Math.round(points) }; patch({ shape, path: shapeD(shape) }); }} />
            {node.shape.kind === 'star' && <NumberField label="Inner" suffix="%" value={Math.round(node.shape.inner * 100)} min={5} max={100} precision={0} gesture={gesture} title="How deep the points cut in" wide
              onChange={percent => { const shape = { ...node.shape!, inner: percent / 100 }; patch({ shape, path: shapeD(shape) }); }} />}
          </div>
          <Select label="Shape" value={node.shape.kind} options={[['polygon', 'Polygon'], ['star', 'Star']]} onChange={kind => { const shape = { ...node.shape!, kind }; patch({ shape, path: shapeD(shape) }); }} />
        </Section>
      )}
      <FillSection node={node} patch={patch} gesture={gesture} variables={doc.variables} />
      <StrokeSection node={node} patch={patch} gesture={gesture} />
      <EffectsSection node={node} patch={patch} gesture={gesture} />
      <MotionSection node={node} patch={patch} gesture={gesture} />
      {(node.type === 'frame' || (node.type === 'text' && node.tag !== 'input' && node.tag !== 'textarea')) && !isRoot && <LinkSection node={node} doc={doc} patch={patch} />}
      {node.type === 'frame' && !isRoot && <ComponentSection store={store} node={node} doc={doc} />}
    </div>
  );
}

const MOTION_LABEL: Record<string, string> = {
  rotateIn: 'Rotate in', spinIn: 'Spin in', bounceIn: 'Bounce in', dropIn: 'Drop in', rise: 'Rise', expand: 'Expand',
  marqueeUp: 'Marquee (scroll up)', shake: 'Shake', heartbeat: 'Heartbeat', swing: 'Swing', flash: 'Flash', jelly: 'Jelly', tada: 'Tada', ping: 'Ping (ripple out)', hue: 'Color cycle', glow: 'Glow', shimmer: 'Shimmer (gradient sweep)',
  press: 'Press', pushRight: 'Nudge right', rotate: 'Rotate', shadow: 'Shadow', saturate: 'Saturate', invert: 'Invert',
  none: 'None', fade: 'Fade in', fadeUp: 'Fade up', fadeDown: 'Fade down', slideLeft: 'Slide from right', slideRight: 'Slide from left', zoomIn: 'Zoom in', zoomOut: 'Zoom out', blurIn: 'Blur in', flipIn: 'Flip in', pop: 'Pop',
  float: 'Float', pulse: 'Pulse', breathe: 'Breathe', spin: 'Spin', bounce: 'Bounce', wiggle: 'Wiggle', drift: 'Drift', marquee: 'Marquee (scroll left)',
  lift: 'Lift', grow: 'Grow', shrink: 'Shrink', dim: 'Dim', brighten: 'Brighten', tilt: 'Tilt',
};
const motionOptions = <T extends string>(types: readonly T[]): (readonly [T | 'none', string])[] => (['none', ...types] as (T | 'none')[]).map(type => [type, MOTION_LABEL[type]] as const);

/** Appear, loop and hover animations. They play in Preview and on the live site; the canvas stays still. */
function MotionSection({ node, patch, gesture }: { node: SiteNode; patch: Patch; gesture: Gesture }) {
  const motion: Motion = node.motion ?? {};
  const set = (next: Motion) => {
    const clean = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)) as Motion;
    patch({ motion: Object.keys(clean).length ? clean : undefined });
  };
  const { enter, loop, hover, scroll } = motion;
  return (
    <Section title="Motion">
      <Select label="When it appears" value={enter?.type ?? 'none'} options={motionOptions(ENTER_TYPES)}
        onChange={type => set({ ...motion, enter: type === 'none' ? undefined : { duration: 700, delay: 0, trigger: 'inView', ...enter, type } })} />
      {enter && <>
        <Select value={enter.trigger} options={[['inView', 'When scrolled into view'], ['load', 'When the page loads']]} onChange={trigger => set({ ...motion, enter: { ...enter, trigger } })} title="When the animation starts" />
        <div className="ed-grid2">
          <NumberField label="Time" suffix="ms" value={enter.duration} min={50} max={5000} step={50} precision={0} gesture={gesture} title="Duration" onChange={duration => set({ ...motion, enter: { ...enter, duration: Math.round(duration) } })} wide />
          <NumberField label="Wait" suffix="ms" value={enter.delay} min={0} max={5000} step={50} precision={0} gesture={gesture} title="Delay before it starts" onChange={delay => set({ ...motion, enter: { ...enter, delay: Math.round(delay) } })} wide />
        </div>
      </>}
      <Select label="Repeating" value={loop?.type ?? 'none'} options={motionOptions(LOOP_TYPES)}
        onChange={type => set({ ...motion, loop: type === 'none' ? undefined : { duration: type === 'marquee' ? 20000 : type === 'spin' ? 12000 : 3000, ...loop, type } })} />
      {loop && <NumberField label="Every" suffix="ms" value={loop.duration} min={200} max={120000} step={100} precision={0} gesture={gesture} title="Length of one cycle" onChange={duration => set({ ...motion, loop: { ...loop, duration: Math.round(duration) } })} wide />}
      <Select label="On hover" value={hover?.type ?? 'none'} options={motionOptions(HOVER_TYPES)} onChange={type => set({ ...motion, hover: type === 'none' ? undefined : { type } })} />
      <Select label="While scrolling" value={scroll?.type ?? 'none'} options={(['none', ...SCROLL_TYPES] as const).map(type => [type, SCROLL_LABEL[type]] as const)} title="Follows the page's scroll position (parallax, reveal)"
        onChange={type => set({ ...motion, scroll: type === 'none' ? undefined : { amount: 50, ...scroll, type } })} />
      {scroll && scroll.type !== 'reveal' && <NumberField label="Amount" suffix="%" value={scroll.amount} min={0} max={100} precision={0} gesture={gesture} title="How strong the scroll effect is" onChange={amount => set({ ...motion, scroll: { ...scroll, amount: Math.round(amount) } })} wide />}
      {(enter || loop || hover || scroll) && <p className="ed-hint">Motion plays in Preview and on the live site. The canvas stays still so you can edit.</p>}
    </Section>
  );
}

type Shadow = Extract<Effect, { type: 'dropShadow' | 'innerShadow' }>;
type Blur = Extract<Effect, { type: 'layerBlur' | 'backgroundBlur' }>;
const isShadow = (effect: Effect): effect is Shadow => effect.type === 'dropShadow' || effect.type === 'innerShadow';

type Patch = (value: Partial<SiteNode> & Record<string, unknown>) => boolean;

/** Figma-style constraint box: click edges to pin (Shift-click opposite edges to stretch), center lines to center. */
function ConstraintBox({ value, onChange }: { value: Constraints; onChange: (value: Constraints) => void }) {
  const toggleH = (side: 'left' | 'right', shift: boolean) => {
    const other = side === 'left' ? 'right' : 'left';
    const has = (s: string) => value.h === s || value.h === 'leftRight';
    onChange({ ...value, h: shift && has(other) ? (has(side) && value.h === 'leftRight' ? other : 'leftRight') : side });
  };
  const toggleV = (side: 'top' | 'bottom', shift: boolean) => {
    const other = side === 'top' ? 'bottom' : 'top';
    const has = (s: string) => value.v === s || value.v === 'topBottom';
    onChange({ ...value, v: shift && has(other) ? (has(side) && value.v === 'topBottom' ? other : 'topBottom') : side });
  };
  const on = (active: boolean) => (active ? ' is-on' : '');
  return (
    <div className="ed-cbox" role="group" aria-label="Constraints">
      <span className="ed-cbox-inner" />
      <button type="button" className={'ed-cbox-t' + on(value.v === 'top' || value.v === 'topBottom')} aria-label="Pin to top" title="Pin to top (Shift: top & bottom)" onClick={event => toggleV('top', event.shiftKey)} />
      <button type="button" className={'ed-cbox-b' + on(value.v === 'bottom' || value.v === 'topBottom')} aria-label="Pin to bottom" title="Pin to bottom (Shift: top & bottom)" onClick={event => toggleV('bottom', event.shiftKey)} />
      <button type="button" className={'ed-cbox-l' + on(value.h === 'left' || value.h === 'leftRight')} aria-label="Pin to left" title="Pin to left (Shift: left & right)" onClick={event => toggleH('left', event.shiftKey)} />
      <button type="button" className={'ed-cbox-r' + on(value.h === 'right' || value.h === 'leftRight')} aria-label="Pin to right" title="Pin to right (Shift: left & right)" onClick={event => toggleH('right', event.shiftKey)} />
      <button type="button" className={'ed-cbox-ch' + on(value.h === 'center')} aria-label="Center horizontally" title="Keep centered horizontally" onClick={() => onChange({ ...value, h: 'center' })} />
      <button type="button" className={'ed-cbox-cv' + on(value.v === 'center')} aria-label="Center vertically" title="Keep centered vertically" onClick={() => onChange({ ...value, v: 'center' })} />
    </div>
  );
}

/** 3×3 alignment picker. In space-between mode only the cross-axis choice applies. */
function AlignGrid({ layout, onChange }: { layout: Layout; onChange: (value: Partial<Layout>) => void }) {
  const horizontal = layout.mode === 'horizontal';
  const values = ['start', 'center', 'end'] as const;
  const names = { start: horizontal ? 'left' : 'top', center: 'center', end: horizontal ? 'right' : 'bottom' } as const;
  const crossNames = { start: horizontal ? 'top' : 'left', center: 'middle', end: horizontal ? 'bottom' : 'right' } as const;
  const cross = layout.alignCross === 'baseline' ? 'start' : layout.alignCross;
  return (
    <div className={'ed-agrid' + (layout.alignMain === 'spaceBetween' ? ' is-between' : '') + (horizontal ? ' is-row' : ' is-column')} role="radiogroup" aria-label="Alignment">
      {[0, 1, 2].flatMap(row => [0, 1, 2].map(col => {
        const main = horizontal ? values[col] : values[row], crossValue = horizontal ? values[row] : values[col];
        const active = (layout.alignMain === main || layout.alignMain === 'spaceBetween') && cross === crossValue;
        return (
          <button key={row * 3 + col} type="button" role="radio" aria-checked={active} title={`Align ${crossNames[crossValue]} ${names[main]}`} aria-label={`Align ${crossNames[crossValue]} ${names[main]}`}
            onClick={() => onChange({ alignMain: layout.alignMain === 'spaceBetween' ? 'spaceBetween' : main, alignCross: crossValue })}>
            <span />
          </button>
        );
      }))}
    </div>
  );
}

function AutoLayoutSection({ node, patch, gesture, store, measure }: { node: FrameNode; patch: Patch; gesture: Gesture; store: EditorStore; measure: Measure }) {
  const layout = node.layout;
  const set = (value: Partial<Layout>) => patch({ layout: { ...layout, ...value } });
  const on = layout.mode !== 'none';
  const [top, right, bottom, left] = layout.padding;
  const [sides, setSides] = useState(!(top === bottom && left === right));
  const direction = layout.mode === 'horizontal' && layout.wrap ? 'wrap' : layout.mode;
  return (
    <Section title="Auto layout" action={
      <IconButton label={on ? 'Remove auto layout' : 'Add auto layout'} shortcut="Shift+A" onClick={() => toggleAutoLayout(store, measure)}>{on ? <Minus size={14} /> : <Plus size={14} />}</IconButton>
    }>
      {!on && <p className="ed-hint">Stack this frame’s layers in a row, column or grid that resizes with its content. Shift+A adds it from the current arrangement.</p>}
      {on && <>
        <Segmented label="Direction" value={direction as 'horizontal' | 'vertical' | 'grid' | 'wrap'} onChange={mode => set(mode === 'wrap' ? { mode: 'horizontal', wrap: true } : { mode, wrap: false })} options={[
          ['vertical', <Rows size={15} key="v" />, 'Vertical'], ['horizontal', <Columns size={15} key="h" />, 'Horizontal'],
          ['wrap', <span key="w" className="ed-wrap-icon">↩</span>, 'Wrap'], ['grid', <SquaresFour size={15} key="g" />, 'Grid'],
        ]} />
        <div className="ed-al-row">
          {layout.mode !== 'grid' && <AlignGrid layout={layout} onChange={set} />}
          <div className="ed-al-fields">
            {layout.mode === 'grid'
              ? <NumberField label="Cols" value={layout.gridColumns} min={1} max={12} precision={0} gesture={gesture} onChange={gridColumns => set({ gridColumns: Math.round(gridColumns) })} wide />
              : null}
            {layout.alignMain === 'spaceBetween' && layout.mode !== 'grid'
              ? <button type="button" className="ed-btn ed-auto-gap is-on" title="Space between (auto gap) — click for a fixed gap" onClick={() => set({ alignMain: 'start' })}>Gap: Auto</button>
              : <NumberField label="Gap" value={layout.gap} min={0} gesture={gesture} onChange={gap => set({ gap })} wide title="Space between items" />}
            {layout.mode !== 'grid' && layout.alignMain !== 'spaceBetween' && (
              <button type="button" className="ed-link-btn" title="Spread items with equal space between them" onClick={() => set({ alignMain: 'spaceBetween' })}>Use auto gap</button>
            )}
            {(layout.mode === 'grid' || layout.wrap) && <NumberField label="Rows" title="Gap between rows" value={layout.counterGap ?? layout.gap} min={0} gesture={gesture} onChange={counterGap => set({ counterGap })} wide />}
          </div>
        </div>
        <div className="ed-pad-head">
          <span>Padding</span>
          <IconButton label={sides ? 'Edit horizontal & vertical padding' : 'Edit each side'} onClick={() => setSides(!sides)}><span className="ed-sides-icon">{sides ? '⇔' : '⊞'}</span></IconButton>
        </div>
        {sides ? (
          <div className="ed-grid4" aria-label="Padding">
            {(['Top', 'Right', 'Bottom', 'Left'] as const).map((side, index) => (
              <NumberField key={side} label={side[0]} title={'Padding ' + side.toLowerCase()} value={layout.padding[index]} min={0} gesture={gesture}
                onChange={value => { const padding = [...layout.padding] as Layout['padding']; padding[index] = value; set({ padding }); }} />
            ))}
          </div>
        ) : (
          <div className="ed-grid2" aria-label="Padding">
            <NumberField label="↔" title="Horizontal padding (left & right)" value={left} mixed={left !== right} min={0} gesture={gesture} onChange={value => set({ padding: [top, value, bottom, value] })} />
            <NumberField label="↕" title="Vertical padding (top & bottom)" value={top} mixed={top !== bottom} min={0} gesture={gesture} onChange={value => set({ padding: [value, right, value, left] })} />
          </div>
        )}
      </>}
      <label className="ed-check"><input type="checkbox" checked={node.clip} onChange={event => patch({ clip: event.target.checked })} /> Clip content</label>
    </Section>
  );
}

function TextSection({ node, patch, gesture }: { node: TextNode; patch: Patch; gesture: Gesture }) {
  const style = node.textStyle;
  const set = (value: Partial<TextStyle>) => patch({ textStyle: { ...style, ...value } });
  return (
    <Section title="Text">
      <TextField label="Content" value={node.text} multiline onChange={text => patch({ text })} />
      <Select label="Font" value={style.fontFamily} options={[...new Set([style.fontFamily, ...FONTS])].sort().map(family => [family, family] as const)} onChange={fontFamily => set({ fontFamily })} />
      <TextField label="Other Google font" value="" placeholder="Type a name, e.g. Poppins" onChange={fontFamily => { if (fontFamily.trim()) set({ fontFamily: fontFamily.trim() }); }}
        validate={value => (!value.trim() || fontFamilySchema.safeParse(value.trim()).success ? null : 'Use a font name such as Poppins or Playfair Display.')} />
      <div className="ed-grid2">
        <Select value={style.fontWeight} options={WEIGHTS} onChange={fontWeight => set({ fontWeight })} title="Weight" />
        <NumberField label="Size" value={style.fontSize} min={1} max={1000} gesture={gesture} onChange={fontSize => set({ fontSize })} wide />
      </div>
      <div className="ed-grid2">
        <NumberField label="LH" title="Line height (× font size)" value={style.lineHeight ?? 1.2} min={0.5} max={5} step={0.05} gesture={gesture} onChange={lineHeight => set({ lineHeight })} />
        <NumberField label="LS" title="Letter spacing (px)" value={style.letterSpacing} min={-100} max={100} step={0.1} gesture={gesture} onChange={letterSpacing => set({ letterSpacing })} />
      </div>
      <Segmented label="Alignment" value={style.align} onChange={align => set({ align })} options={[['left', 'L', 'Align left'], ['center', 'C', 'Align center'], ['right', 'R', 'Align right'], ['justify', 'J', 'Justify']]} />
      <div className="ed-toggles">
        <label className="ed-check"><input type="checkbox" checked={style.italic} onChange={event => set({ italic: event.target.checked })} /> Italic</label>
        <label className="ed-check"><input type="checkbox" checked={style.decoration === 'underline'} onChange={event => set({ decoration: event.target.checked ? 'underline' : 'none' })} /> Underline</label>
        <Select value={style.transform} options={[['none', 'Aa'], ['uppercase', 'AA'], ['lowercase', 'aa'], ['capitalize', 'Aa Bb']]} onChange={transform => set({ transform })} title="Letter case" />
      </div>
      <Select label="Max lines" value={String(node.maxLines ?? 'none')} options={[['none', 'No limit'], ...[1, 2, 3, 4, 5, 6, 8, 10].map(n => [String(n), `${n} line${n > 1 ? 's' : ''}, then …`] as const)]}
        onChange={value => patch({ maxLines: value === 'none' ? undefined : Number(value) })} title="Cut long text off with an ellipsis" />
    </Section>
  );
}

/** Layers on the same page that a click can scroll to or show / hide, indented by depth. */
function targetOptions(doc: SiteDoc, node: SiteNode): (readonly [string, string])[] {
  const page = pageOf(doc, node.id);
  if (!page) return [];
  const depth = (id: string) => { let d = 0, current = doc.nodes[id]; while (current?.parentId && current.parentId !== page.rootId) { d++; current = doc.nodes[current.parentId]; } return d; };
  return subtreeIds(doc, page.rootId).filter(id => id !== page.rootId && id !== node.id)
    .map(id => [id, '\u00A0\u00A0'.repeat(depth(id)) + doc.nodes[id].name + (doc.nodes[id].visible ? '' : ' (hidden)')] as const);
}

/** What happens when a visitor clicks this layer. */
function LinkSection({ node, doc, patch }: { node: SiteNode; doc: SiteDoc; patch: Patch }) {
  const link = node.link, pages = doc.pages;
  const targets = targetOptions(doc, node);
  // A sensible first target: the next layer beside this one (an accordion answer, a menu panel).
  const siblings = node.parentId ? doc.nodes[node.parentId].children : [];
  const firstTarget = siblings[siblings.indexOf(node.id) + 1] ?? targets[0]?.[0];
  return (
    <Section title="Link">
      <Select label="When clicked" value={link?.type ?? 'none'} options={[['none', 'Do nothing'], ['page', 'Go to a page'], ['url', 'Open a web address'], ['scroll', 'Scroll to a layer'], ['toggle', 'Show / hide a layer']]}
        onChange={type => patch({ link: type === 'none' ? undefined : type === 'page' ? { type, pageId: pages[0].id } : type === 'url' ? { type, href: 'https://', newTab: true } : firstTarget ? { type, targetId: firstTarget } : undefined })} />
      {(link?.type === 'scroll' || link?.type === 'toggle') && <>
        <Select label="Layer" value={doc.nodes[link.targetId] ? link.targetId : ''} options={[...(doc.nodes[link.targetId] ? [] : [['', 'Pick a layer'] as const]), ...targets]} onChange={targetId => targetId && patch({ link: { ...link, targetId } })} />
        <p className="ed-hint">{link.type === 'scroll' ? 'Scrolls smoothly to that layer.' : 'Each click shows the layer if it is hidden and hides it if it is shown. Uncheck Visible on the layer to start it hidden (menus, pop-ups, answers).'}</p>
      </>}
      {link?.type === 'page' && <Select label="Page" value={pages.some(page => page.id === link.pageId) ? link.pageId : pages[0].id} options={pages.map(page => [page.id, `${page.name} (${page.path})`] as const)} onChange={pageId => patch({ link: { type: 'page', pageId } })} />}
      {link?.type === 'url' && <>
        <TextField label="Address" value={link.href} placeholder="https://example.com" onChange={href => patch({ link: { ...link, href: href.trim() } })}
          validate={value => (linkSchema.safeParse({ type: 'url', href: value.trim(), newTab: true }).success ? null : 'Use an address such as https://example.com, mailto:you@example.com or /about.')} />
        <label className="ed-check"><input type="checkbox" checked={link.newTab} onChange={event => patch({ link: { ...link, newTab: event.target.checked } })} /> Open in a new tab</label>
      </>}
      {link?.type === 'url' && link.href === '#' && <p className="ed-hint">Placeholder link: pick a page or a web address so it goes somewhere.</p>}
      {link && <p className="ed-hint">Clicks work in Preview and on the exported website.</p>}
    </Section>
  );
}

/** Main components and their linked instances. */
function ComponentSection({ store, node, doc }: { store: EditorStore; node: SiteNode; doc: SiteDoc }) {
  if (node.component) {
    const count = instancesOf(doc, node.id).length;
    return (
      <Section title="Component">
        <p className="ed-hint"><strong>◆ Main component</strong> · {count} {count === 1 ? 'instance' : 'instances'}. Changes here update every instance; each instance keeps its own text, place and size.</p>
        <div className="ed-grid2">
          <button type="button" className="ed-btn" onClick={() => duplicateSelection(store)} title="Add a linked copy (Ctrl+D)">Add instance</button>
          <button type="button" className="ed-btn" onClick={() => store.commit(current => updateNode(current, node.id, { component: undefined }))} title="Keep the layers but stop updating instances">Unlink</button>
        </div>
      </Section>
    );
  }
  if (node.instanceOf) {
    const main = doc.nodes[node.instanceOf];
    return (
      <Section title="Component">
        <p className="ed-hint"><strong>◇ Instance</strong>{main ? ` of “${main.name}”` : ''}. It follows its main component. Text you change here is kept.</p>
        <div className="ed-grid2">
          <button type="button" className="ed-btn" disabled={!main?.component} onClick={() => { const page = main && pageOf(doc, main.id); if (page) store.set({ pageId: page.id, selection: [main.id], editingTextId: null }); }}>Go to main</button>
          <button type="button" className="ed-btn" onClick={() => store.commit(current => detachInstance(current, node.id))} title="Turn this instance into ordinary layers">Detach</button>
        </div>
      </Section>
    );
  }
  if (node.sourceId) return <Section title="Component"><p className="ed-hint">Part of an instance. Only text changes are kept here; edit the main component to change the design.</p></Section>;
  return (
    <Section title="Component">
      <button type="button" className="ed-btn" onClick={() => store.commit(current => updateNode(current, node.id, { component: true }))} title="Reuse this frame: instances update when it changes (Ctrl+Alt+K)">◆ Create component</button>
    </Section>
  );
}

/** Site colors (variables), each with a light and a dark value. */
function ColorsSection({ store, doc, gesture }: { store: EditorStore; doc: SiteDoc; gesture: Gesture }) {
  const colors = Object.values(doc.variables ?? {});
  return (
    <Section title="Site colors" action={
      <IconButton label="Add site color" onClick={() => store.commit(current => addVariable(current, `Color ${Object.keys(current.variables ?? {}).length + 1}`, '#2563EB').doc)}><Plus size={14} /></IconButton>
    }>
      {!colors.length && <p className="ed-hint">Name your brand colors once and reuse them on any layer. Each has a light and a dark value, so the site can follow dark mode.</p>}
      {colors.map(color => (
        <div className="ed-var" key={color.id}>
          <div className="ed-paint-row">
            <input className="ed-var-name" aria-label="Color name" defaultValue={color.name} maxLength={60}
              onBlur={event => { const name = event.target.value.trim(); if (name && name !== color.name) store.commit(current => updateVariable(current, color.id, { name })); else event.target.value = color.name; }}
              onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
            <IconButton label={`Remove ${color.name}`} onClick={() => store.commit(current => removeVariable(current, color.id))}><X size={14} /></IconButton>
          </div>
          <div className="ed-var-row"><span>Light</span><ColorField label={`${color.name} light`} value={color.light} gesture={gesture} onChange={light => store.commit(current => updateVariable(current, color.id, { light }))} /></div>
          <div className="ed-var-row"><span>Dark</span><ColorField label={`${color.name} dark`} value={color.dark} gesture={gesture} onChange={dark => store.commit(current => updateVariable(current, color.id, { dark }))} /></div>
        </div>
      ))}
      {colors.length > 0 && <p className="ed-hint">Pick a site color from any layer's Fill. Switch light and dark in Preview.</p>}
    </Section>
  );
}

/** Switch a fill between solid and gradient, keeping its colors. */
function convertPaint(paint: Paint, type: 'solid' | 'linear' | 'radial'): Paint {
  if (paint.type === type || paint.type === 'image') return paint;
  const stops = paint.type === 'solid' ? [{ offset: 0, color: paint.color }, { offset: 1, color: paint.color.slice(0, 7) === '#FFFFFF' ? '#D9D9D9' : '#FFFFFF' }] : paint.stops;
  if (type === 'solid') return { type, color: stops[0].color, visible: paint.visible };
  return type === 'linear' ? { type, angle: paint.type === 'linear' ? paint.angle : 135, stops, visible: paint.visible } : { type, stops, visible: paint.visible };
}

/** Shown while designing for Tablet or Mobile: what this layer changes there, and a reset. */
function BreakpointNote({ store, node, breakpoint }: { store: EditorStore; node: SiteNode; breakpoint: 'tablet' | 'mobile' }) {
  const changed = overrideSummary(node, breakpoint);
  const name = breakpoint === 'tablet' ? 'tablet' : 'phone';
  const reset = () => store.commit(current => {
    const target = current.nodes[node.id];
    const overrides = { ...target.overrides };
    delete overrides[breakpoint];
    return { ...current, nodes: { ...current.nodes, [node.id]: { ...target, overrides } as SiteNode } };
  });
  return (
    <div className="ed-bp-note" role="status">
      <strong>Designing for {name}</strong>
      {changed.length
        ? <><span>This layer changes its {changed.join(', ')} on {breakpoint === 'tablet' ? 'tablet and phone' : 'phone'}.</span><button type="button" className="ed-link-btn" onClick={reset}>Reset to the {breakpoint === 'tablet' ? 'desktop' : 'larger-screen'} design</button></>
        : <span>Changes you make now apply to {breakpoint === 'tablet' ? 'tablet and phone' : 'phone'} only. Text and new layers are shared by all sizes.</span>}
    </div>
  );
}

function FillSection({ node, patch, gesture, variables }: { node: SiteNode; patch: Patch; gesture: Gesture; variables?: Record<string, Variable> }) {
  const colors = Object.values(variables ?? {});
  const fills = node.fills;
  const replace = (index: number, paint: Paint) => patch({ fills: fills.map((value, i) => (i === index ? paint : value)) });
  return (
    <Section title={node.type === 'text' ? 'Text color' : 'Fill'} action={
      <IconButton label="Add fill" onClick={() => patch({ fills: [...fills, { type: 'solid', color: fills.length ? '#00000033' : '#D9D9D9', visible: true }] })}><Plus size={14} /></IconButton>
    }>
      {[...fills].map((paint, index) => ({ paint, index })).reverse().map(({ paint, index }) => (
        <div className="ed-paint" key={index}>
          <div className="ed-paint-row">
            {paint.type === 'image'
              ? <span className="ed-paint-label">Image fill</span>
              : <Select value={paint.type} title="Fill type" options={[['solid', 'Solid color'], ['linear', 'Linear gradient'], ['radial', 'Radial gradient']]} onChange={type => replace(index, convertPaint(paint, type))} />}
            <IconButton label={paint.visible ? 'Hide fill' : 'Show fill'} onClick={() => replace(index, { ...paint, visible: !paint.visible })}>{paint.visible ? <Eye size={14} /> : <EyeSlash size={14} />}</IconButton>
            <IconButton label="Remove fill" onClick={() => patch({ fills: fills.filter((_, i) => i !== index) })}><X size={14} /></IconButton>
          </div>
          {paint.type === 'solid' && <ColorField value={paint.color} gesture={gesture} onChange={color => replace(index, { type: 'solid', color, visible: paint.visible })} />}
          {paint.type === 'solid' && colors.length > 0 && (
            <Select title="Follow a site color" value={paint.variable && variables?.[paint.variable] ? paint.variable : ''} options={[['', 'Custom color'], ...colors.map(color => [color.id, '● ' + color.name] as const)]}
              onChange={id => replace(index, id ? { type: 'solid', color: variables![id].light, visible: paint.visible, variable: id } : { type: 'solid', color: paint.color, visible: paint.visible })} />
          )}
          {(paint.type === 'linear' || paint.type === 'radial') && <>
            <div className="ed-grad-bar" aria-hidden="true" style={{ background: `linear-gradient(90deg, ${[...paint.stops].sort((a, b) => a.offset - b.offset).map(stop => `${stop.color} ${stop.offset * 100}%`).join(', ')})` }} />
            {paint.type === 'linear' && <NumberField label="Angle" suffix="°" value={paint.angle} min={-360} max={360} precision={0} gesture={gesture} onChange={angle => replace(index, { ...paint, angle })} wide />}
            {paint.stops.map((stop, s) => (
              <div className="ed-grad-stop" key={s}>
                <ColorField label={`Stop ${s + 1}`} value={stop.color} gesture={gesture} onChange={color => replace(index, { ...paint, stops: paint.stops.map((value, i) => (i === s ? { ...value, color } : value)) })} />
                <div className="ed-grad-pos">
                  <NumberField label="At" suffix="%" value={Math.round(stop.offset * 100)} min={0} max={100} precision={0} gesture={gesture} title="Position along the gradient" onChange={percent => replace(index, { ...paint, stops: paint.stops.map((value, i) => (i === s ? { ...value, offset: percent / 100 } : value)) })} wide />
                  {paint.stops.length > 2 && <IconButton label={`Remove stop ${s + 1}`} onClick={() => replace(index, { ...paint, stops: paint.stops.filter((_, i) => i !== s) })}><X size={12} /></IconButton>}
                </div>
              </div>
            ))}
            {paint.stops.length < 8 && <button type="button" className="ed-link-btn" onClick={() => replace(index, { ...paint, stops: [...paint.stops, { offset: 1, color: paint.stops.at(-1)!.color }].map((stop, i, all) => ({ ...stop, offset: Math.round((i / (all.length - 1)) * 100) / 100 })) })}>+ Add color stop</button>}
          </>}
        </div>
      ))}
    </Section>
  );
}

function StrokeSection({ node, patch, gesture }: { node: SiteNode; patch: Patch; gesture: Gesture }) {
  const stroke = node.stroke;
  return (
    <Section title="Stroke" action={stroke
      ? <IconButton label="Remove stroke" onClick={() => patch({ stroke: null })}><Minus size={14} /></IconButton>
      : <IconButton label="Add stroke" onClick={() => patch({ stroke: { color: '#000000', weight: 1, align: 'inside', style: 'solid' } })}><Plus size={14} /></IconButton>}>
      {stroke && <>
        <ColorField value={stroke.color} gesture={gesture} onChange={color => patch({ stroke: { ...stroke, color } })} />
        <div className="ed-grid2">
          <NumberField label="W" title="Stroke weight" value={stroke.weight} min={0} max={200} gesture={gesture} onChange={weight => patch({ stroke: { ...stroke, weight } })} />
          <Select value={stroke.align} options={[['inside', 'Inside'], ['center', 'Center'], ['outside', 'Outside']]} onChange={align => patch({ stroke: { ...stroke, align } })} title="Stroke position" />
        </div>
        <Select label="Style" value={stroke.style} options={[['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']]} onChange={style => patch({ stroke: { ...stroke, style } })} />
      </>}
    </Section>
  );
}

function EffectsSection({ node, patch, gesture }: { node: SiteNode; patch: Patch; gesture: Gesture }) {
  const effects = node.effects;
  const replace = (index: number, effect: Effect) => patch({ effects: effects.map((value, i) => (i === index ? effect : value)) });
  return (
    <Section title="Effects" action={
      <IconButton label="Add drop shadow" onClick={() => patch({ effects: [...effects, { type: 'dropShadow', x: 0, y: 4, blur: 12, spread: 0, color: '#00000026', visible: true }] })}><Plus size={14} /></IconButton>
    }>
      {effects.map((effect, index) => (
        <div className="ed-effect" key={index}>
          <div className="ed-paint-row">
            <Select value={effect.type} onChange={type => replace(index, type === 'dropShadow' || type === 'innerShadow'
              ? { type, x: 0, y: 4, blur: 12, spread: 0, color: '#00000026', visible: effect.visible, ...(effect.type === 'dropShadow' || effect.type === 'innerShadow' ? { x: effect.x, y: effect.y, blur: effect.blur, spread: effect.spread, color: effect.color } : {}) }
              : { type, radius: effect.type === 'layerBlur' || effect.type === 'backgroundBlur' ? effect.radius : 8, visible: effect.visible })}
              options={[['dropShadow', 'Drop shadow'], ['innerShadow', 'Inner shadow'], ['layerBlur', 'Layer blur'], ['backgroundBlur', 'Background blur']]} />
            <IconButton label={effect.visible ? 'Hide effect' : 'Show effect'} onClick={() => replace(index, { ...effect, visible: !effect.visible })}>{effect.visible ? <Eye size={14} /> : <EyeSlash size={14} />}</IconButton>
            <IconButton label="Remove effect" onClick={() => patch({ effects: effects.filter((_, i) => i !== index) })}><X size={14} /></IconButton>
          </div>
          {isShadow(effect) ? <>
            <div className="ed-grid4">
              <NumberField label="X" value={effect.x} gesture={gesture} onChange={x => replace(index, { ...effect, x })} />
              <NumberField label="Y" value={effect.y} gesture={gesture} onChange={y => replace(index, { ...effect, y })} />
              <NumberField label="B" title="Blur" value={effect.blur} min={0} gesture={gesture} onChange={blur => replace(index, { ...effect, blur })} />
              <NumberField label="S" title="Spread" value={effect.spread} gesture={gesture} onChange={spread => replace(index, { ...effect, spread })} />
            </div>
            <ColorField value={effect.color} gesture={gesture} onChange={color => replace(index, { ...effect, color })} />
          </> : <NumberField label="Blur" value={(effect as Blur).radius} min={0} max={500} gesture={gesture} onChange={radius => replace(index, { ...(effect as Blur), radius })} wide />}
        </div>
      ))}
    </Section>
  );
}

const BLEND_LABEL: Record<(typeof BLEND_MODES)[number], string> = {
  normal: 'Normal', multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', darken: 'Darken', lighten: 'Lighten', 'color-dodge': 'Color dodge', 'color-burn': 'Color burn',
  'hard-light': 'Hard light', 'soft-light': 'Soft light', difference: 'Difference', exclusion: 'Exclusion', hue: 'Hue', saturation: 'Saturation', color: 'Color', luminosity: 'Luminosity',
};
const CURSOR_LABEL: Record<(typeof CURSORS)[number], string> = {
  auto: 'Automatic', default: 'Arrow', pointer: 'Hand (link)', text: 'Text', move: 'Move', grab: 'Grab', crosshair: 'Crosshair', 'zoom-in': 'Zoom in', help: 'Help', 'not-allowed': 'Not allowed', none: 'Hidden',
};
const SCROLL_LABEL: Record<(typeof SCROLL_TYPES)[number] | 'none', string> = {
  none: 'None', parallax: 'Parallax (moves slower)', fadeIn: 'Fade in', slideUp: 'Slide up', scaleUp: 'Grow in', zoomOut: 'Zoom out', slideLeft: 'Slide in from right',
  slideRight: 'Slide in from left', blurIn: 'Blur in', rotate: 'Rotate', reveal: 'Reveal (wipe up)',
};

/** Sticky layers and scrollable frames. */
function ScrollSection({ node, inFlow, patch, gesture }: { node: SiteNode; inFlow: boolean; patch: Patch; gesture: Gesture }) {
  return (
    <Section title="Scrolling">
      {inFlow && <>
        <label className="ed-check" title="Keep this layer in view while the rest of its frame scrolls past (sticky header, side menu)">
          <input type="checkbox" checked={node.sticky != null} onChange={event => patch({ sticky: event.target.checked ? 0 : null })} /> Stick while scrolling
        </label>
        {node.sticky != null && <NumberField label="Top" suffix="px" value={node.sticky} min={0} max={4000} precision={0} gesture={gesture} title="Distance from the top of the window" onChange={sticky => patch({ sticky: Math.round(sticky) })} wide />}
      </>}
      {node.type === 'frame' && <>
        <Select label="Scroll content" value={node.scroll ?? 'none'} options={[['none', 'No (clip or show)'], ['x', 'Sideways (carousel)'], ['y', 'Up and down'], ['both', 'Both ways']]}
          onChange={scroll => patch({ scroll: scroll === 'none' ? undefined : scroll, snap: scroll === 'none' ? undefined : node.snap })} title="Let visitors scroll what doesn't fit inside this frame" />
        {node.scroll && <label className="ed-check"><input type="checkbox" checked={!!node.snap} onChange={event => patch({ snap: event.target.checked || undefined })} /> Snap to each item</label>}
      </>}
    </Section>
  );
}

/** Videos, maps, web pages and custom code. */
function EmbedSection({ node, patch }: { node: EmbedNode; patch: Patch }) {
  const isMap = node.kind === 'url' && node.url.startsWith('https://www.google.com/maps?q=');
  const kind = node.kind === 'code' ? 'code' : isMap ? 'map' : 'url';
  const place = isMap ? decodeURIComponent(/[?&]q=([^&]*)/.exec(node.url)?.[1] ?? '') : '';
  return (
    <Section title="Embed">
      <Select label="Show" value={kind} options={[['url', 'Video or web page'], ['map', 'Map'], ['code', 'Custom code (HTML, CSS, JS)']]}
        onChange={value => patch(value === 'code' ? { kind: 'code', code: node.code || SAMPLE_CODE } : value === 'map' ? { kind: 'url', url: mapSrc(place || 'Eiffel Tower, Paris') } : { kind: 'url', url: isMap ? '' : node.url })} />
      {kind === 'url' && <TextField label="Address" value={node.url} placeholder="https://www.youtube.com/watch?v=…" onChange={url => patch({ url: url.trim() })}
        validate={value => (!value.trim() || /^https:\/\/[^\s"<>]+$/.test(value.trim()) ? null : 'Use a full https:// address, such as a YouTube or Vimeo link.')} />}
      {kind === 'map' && <TextField label="Place" value={place} placeholder="Street, city or a place name" onChange={value => value.trim() && patch({ url: mapSrc(value) })} />}
      {kind === 'code' && <TextField label="Code" value={node.code} multiline placeholder="<div>Hello</div>" onChange={code => patch({ code: code.slice(0, 100_000) })} />}
      <p className="ed-hint">{kind === 'code' ? 'Runs in a sealed box on the site and in Preview: it cannot read or change the rest of the page.' : 'YouTube and Vimeo links become their video players. Some sites refuse to be shown inside other pages.'}</p>
    </Section>
  );
}

/** Settings for the exported website: transitions, address, icons, extra head code. */
function SiteSettingsSection({ store, doc }: { store: EditorStore; doc: SiteDoc }) {
  const settings: SiteSettings = doc.settings ?? {};
  const set = (value: Partial<SiteSettings>) => store.commit(current => {
    const next = Object.fromEntries(Object.entries({ ...current.settings, ...value }).filter(([, v]) => v !== undefined && v !== '')) as SiteSettings;
    return { ...current, settings: Object.keys(next).length ? next : undefined };
  });
  const pick = (key: 'favicon' | 'socialImage') => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml' });
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const asset = await readImageFile(file);
        store.commit(current => ({ ...current, assets: { ...current.assets, [asset.id]: asset }, settings: { ...current.settings, [key]: asset.id } }));
      } catch (error) { store.notify(error instanceof Error ? error.message : 'That image could not be used.'); }
    };
    input.click();
  };
  const image = (key: 'favicon' | 'socialImage', label: string) => {
    const asset = settings[key] ? doc.assets[settings[key]!] : undefined;
    return (
      <div className="ed-site-image">
        <span>{label}</span>
        {asset && <img src={asset.dataUrl} alt="" />}
        <button type="button" className="ed-btn" onClick={() => pick(key)}>{asset ? 'Replace…' : 'Choose image…'}</button>
        {asset && <IconButton label={'Remove ' + label.toLowerCase()} onClick={() => set({ [key]: undefined })}><X size={12} /></IconButton>}
      </div>
    );
  };
  return (
    <Section title="Publishing">
      <Select label="Page transition" value={settings.transition ?? 'none'} options={[['none', 'None'], ['fade', 'Fade'], ['slide', 'Slide']]} onChange={transition => set({ transition: transition === 'none' ? undefined : transition })} title="Animation when visitors move between pages" />
      <TextField label="Site address" value={settings.siteUrl ?? ''} placeholder="https://www.example.com" onChange={siteUrl => set({ siteUrl: siteUrl.trim() || undefined })}
        validate={value => (!value.trim() || siteSettingsSchema.shape.siteUrl.safeParse(value.trim()).success ? null : 'Use a full address such as https://www.example.com.')} />
      {image('favicon', 'Browser tab icon')}
      {image('socialImage', 'Social preview image')}
      <TextField label="Code in <head>" value={settings.headCode ?? ''} multiline placeholder="Analytics or verification tags" onChange={headCode => set({ headCode: headCode.slice(0, 20_000) || undefined })} />
      <p className="ed-hint">Used by Export: the address adds a sitemap and share links; the icon and image show in browser tabs and link previews.</p>
    </Section>
  );
}
