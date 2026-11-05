import { useId } from 'react';
import type { Project } from '../project/schema';
import { themeStyle } from '../project/theme';
import type { DesignDocument, DesignLayer } from '../design/schema';

/** A small, decorative preview; the canvas remains the authoritative rendering. */
function DesignCover({ design }: { design: DesignDocument }) {
  const prefix = 'design-cover-' + useId().replace(/[^A-Za-z0-9_-]/g, '');
  const board = design.artboards[0];
  const colors = new Map(design.colors.map(style => [style.id, style.value]));
  const typeStyles = new Map(design.typeStyles.map(style => [style.id, style]));
  const assets = new Map(design.assets.map(asset => [asset.id, asset]));
  const children = new Map<string | null, DesignLayer[]>();
  for (const layer of design.layers) {
    if (layer.artboardId !== board.id) continue;
    const siblings = children.get(layer.parentId) || [];
    siblings.push(layer); children.set(layer.parentId, siblings);
  }
  function renderLayer(layer: DesignLayer, origin = { x: 0, y: 0 }) {
    if (!layer.visible) return null;
    const fill = layer.colorStyleId ? colors.get(layer.colorStyleId) ?? layer.fill : layer.fill;
    const typography = layer.typeStyleId ? typeStyles.get(layer.typeStyleId) : undefined;
    const fontSize = typography?.fontSize ?? layer.fontSize;
    const lineHeight = typography?.lineHeight ?? layer.lineHeight;
    const clip = prefix + '-' + layer.id;
    const common = { fill, stroke: layer.stroke, strokeWidth: layer.strokeWidth };
    const radius = Math.min(layer.radius, layer.width / 2, layer.height / 2);
    const asset = layer.assetId ? assets.get(layer.assetId) : undefined;
    // Text wrapping is approximate at thumbnail size. No hidden HTML or foreign
    // document is needed; SVG text escapes authored content through React.
    const maxCharacters = Math.max(1, Math.floor(layer.width / (fontSize * 0.55)));
    const lines: string[] = [];
    if (layer.type === 'text') {
      for (const paragraph of layer.text.split('\n')) {
        let current = '';
        for (const word of paragraph.split(/\s+/)) {
          if (current && current.length + word.length + 1 > maxCharacters) { lines.push(current); current = word; }
          else current = current ? current + ' ' + word : word;
        }
        lines.push(current);
      }
    }
    return <g key={layer.id} transform={`translate(${layer.x - origin.x} ${layer.y - origin.y}) rotate(${layer.rotation})`} opacity={layer.opacity}>
      {(layer.type === 'frame' || layer.type === 'image' || layer.type === 'text') && <defs><clipPath id={clip}><rect width={layer.width} height={layer.height} rx={layer.type === 'text' ? 0 : radius}/></clipPath></defs>}
      {(layer.type === 'frame' || layer.type === 'rectangle') && <rect width={layer.width} height={layer.height} rx={radius} {...common}/>}
      {layer.type === 'ellipse' && <ellipse cx={layer.width / 2} cy={layer.height / 2} rx={layer.width / 2} ry={layer.height / 2} {...common}/>}
      {layer.type === 'image' && <><rect width={layer.width} height={layer.height} rx={radius} fill="#e4e9e2"/>{asset && /^data:image\/(png|jpeg|webp);base64,/.test(asset.dataUrl) && <image href={asset.dataUrl} width={layer.width} height={layer.height} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`}/>}<rect width={layer.width} height={layer.height} rx={radius} fill="none" stroke={layer.stroke} strokeWidth={layer.strokeWidth}/></>}
      {layer.type === 'text' && <g clipPath={`url(#${clip})`}><text {...common} fontFamily={typography?.fontFamily ?? layer.fontFamily} fontSize={fontSize} fontWeight={typography?.fontWeight ?? layer.fontWeight} textAnchor={layer.textAlign === 'center' ? 'middle' : layer.textAlign === 'right' ? 'end' : 'start'}>{lines.slice(0, Math.ceil(layer.height / (fontSize * lineHeight)) + 1).map((line, index) => <tspan key={index} x={layer.textAlign === 'center' ? layer.width / 2 : layer.textAlign === 'right' ? layer.width : 0} y={fontSize * 0.85 + index * fontSize * lineHeight}>{line}</tspan>)}</text></g>}
      <g clipPath={layer.type === 'frame' ? `url(#${clip})` : undefined}>{(children.get(layer.id) || []).map(child => renderLayer(child, layer))}</g>
    </g>;
  }
  const boardClip = prefix + '-artboard';
  return <div className="project-cover design-project-cover" aria-hidden="true" style={{ position: 'relative', padding: 0, display: 'block', background: '#e9ece6' }}>
    <svg viewBox={`0 0 ${board.width} ${board.height}`} preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}>
      <defs><clipPath id={boardClip}><rect width={board.width} height={board.height}/></clipPath></defs>
      <rect width={board.width} height={board.height} fill={board.background}/>
      <g clipPath={`url(#${boardClip})`}>{(children.get(null) || []).map(layer => renderLayer(layer))}</g>
    </svg>
    <span style={{ position: 'absolute', left: 12, bottom: 12, maxWidth: 'calc(100% - 24px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '5px 8px', background: '#fcfbf7e8', color: '#292d27', font: '9px Arial, sans-serif', border: '1px solid #d6d8cc' }}>Design / {board.name}</span>
  </div>;
}

export default function ProjectCover({ project, design }: { project: Project; design?: DesignDocument }) {
  if (design?.artboards.length) return <DesignCover design={design}/>;
  const home = project.pages.find(p => p.path === '/')!;
  const hero = home.nodes.find(n => n.type === 'Hero');
  const image = hero?.props.image || home.nodes.flatMap(n => n.type === 'Section' ? n.children : []).flatMap(n => n.type === 'Columns' ? n.children.flatMap(c => c.children) : [n]).find(n => n.type === 'Image')?.props;
  const imageUrl = typeof image === 'string' ? image : image && 'image' in image ? image.image : '';
  return <div className="project-cover" style={themeStyle(project.theme)} data-font={project.theme.font} aria-hidden="true">
    <div className="cover-header"><strong>{project.shared.header.props.brand}</strong><span>Independent / Original</span></div>
    <div className={'cover-body' + (!imageUrl ? ' cover-type' : '')}><div><small>{hero?.props.eyebrow || 'YOUR NEXT CHAPTER'}</small><p>{hero?.props.title || home.title}</p><span>{hero?.props.description || home.description}</span></div>{imageUrl && <img src={imageUrl} alt="" loading="lazy" />}</div>
    <div className="cover-rule" />
  </div>;
}
