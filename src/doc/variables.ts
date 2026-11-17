import { DocError, newId } from './ops';
import type { Paint, SiteDoc, SiteNode, Variable } from './schema';

/**
 * Color variables: named site colors with a light and a dark value. Fills and
 * strokes can use a variable; changing it updates every layer that uses it.
 */

/** Rewrite every paint and stroke that references `id` (null removes the reference). */
function repaint(doc: SiteDoc, id: string, color: string | null): SiteDoc {
  const fix = (paint: Paint): Paint => {
    if (paint.type !== 'solid' || paint.variable !== id) return paint;
    if (color === null) { const { variable: _removed, ...rest } = paint; return rest; }
    return paint.color === color ? paint : { ...paint, color };
  };
  const nodes: Record<string, SiteNode> = {};
  let touched = false;
  for (const [key, node] of Object.entries(doc.nodes)) {
    const fills = node.fills.map(fix);
    let stroke = node.stroke;
    if (stroke?.variable === id) {
      if (color === null) { const { variable: _removed, ...rest } = stroke; stroke = rest; }
      else if (stroke.color !== color) stroke = { ...stroke, color };
    }
    const changed = stroke !== node.stroke || fills.some((paint, index) => paint !== node.fills[index]);
    nodes[key] = changed ? { ...node, fills, stroke } as SiteNode : node;
    touched ||= changed;
  }
  return touched ? { ...doc, nodes } : doc;
}

export function addVariable(doc: SiteDoc, name: string, color: string): { doc: SiteDoc; id: string } {
  if (Object.keys(doc.variables ?? {}).length >= 200) throw new DocError('A site may have at most 200 colors.');
  const id = newId();
  return { id, doc: { ...doc, variables: { ...doc.variables, [id]: { id, name, light: color, dark: color } } } };
}

export function updateVariable(doc: SiteDoc, id: string, patch: Partial<Omit<Variable, 'id'>>): SiteDoc {
  const current = doc.variables?.[id];
  if (!current) return doc;
  const next = { ...current, ...patch };
  const updated = { ...doc, variables: { ...doc.variables, [id]: next } };
  return next.light === current.light ? updated : repaint(updated, id, next.light);
}

export function removeVariable(doc: SiteDoc, id: string): SiteDoc {
  if (!doc.variables?.[id]) return doc;
  const variables = { ...doc.variables };
  delete variables[id];
  return repaint({ ...doc, variables }, id, null);
}
