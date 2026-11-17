import { remapLink } from './interactive';
import { getNode, newId, subtreeIds } from './ops';
import type { SiteDoc, SiteNode } from './schema';

/**
 * Components: a frame marked `component` is a main component. Instances are
 * linked copies of it (`instanceOf` on the copy's root, `sourceId` on its
 * layers). Whenever a main component changes, every instance is rebuilt from
 * it; an instance keeps its own place, size, name and the text of its text layers.
 */

/** Layers of an instance root that are not taken from the main component. */
const OWN = ['x', 'y', 'width', 'height', 'sizing', 'absolute', 'constraints', 'visible', 'locked', 'name', 'rotation', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const;

/** A new instance of a main component: nodes with fresh ids, root first (root.parentId is null). */
export function instantiate(doc: SiteDoc, mainId: string, idFactory: () => string = newId): SiteNode[] {
  const ids = subtreeIds(doc, mainId);
  const map = new Map(ids.map(id => [id, idFactory()]));
  return ids.map(id => {
    const node = getNode(doc, id);
    const copy = { ...structuredClone(node), id: map.get(id)!, parentId: id === mainId ? null : map.get(node.parentId!)!, children: node.children.map(child => map.get(child)!) } as SiteNode;
    delete copy.component;
    if (id === mainId) copy.instanceOf = mainId; else copy.sourceId = id;
    return copy;
  });
}

export const instancesOf = (doc: SiteDoc, mainId: string): SiteNode[] => Object.values(doc.nodes).filter(node => node.instanceOf === mainId);

/** Rebuild one instance from its main component, reusing layer ids where the layer still exists. */
function rebuild(doc: SiteDoc, instanceId: string, mainId: string): SiteDoc {
  const instance = doc.nodes[instanceId];
  const old = subtreeIds(doc, instanceId).map(id => doc.nodes[id]);
  const bySource = new Map(old.map(node => [node.id === instanceId ? mainId : node.sourceId, node] as const));
  const mainIds = subtreeIds(doc, mainId);
  const map = new Map(mainIds.map(id => [id, bySource.get(id)?.id ?? newId()]));
  const nodes = { ...doc.nodes };
  for (const node of old) delete nodes[node.id];
  for (const id of mainIds) {
    const source = doc.nodes[id], previous = bySource.get(id);
    const copy = { ...structuredClone(source), id: map.get(id)!, parentId: id === mainId ? instance.parentId : map.get(source.parentId!)!, children: source.children.map(child => map.get(child)!) } as SiteNode;
    delete copy.component;
    if (id === mainId) {
      copy.instanceOf = mainId;
      for (const key of OWN) (copy as Record<string, unknown>)[key] = instance[key];
    } else copy.sourceId = id;
    // Instances keep their own wording.
    if (copy.type === 'text' && previous?.type === 'text') copy.text = previous.text;
    nodes[copy.id] = remapLink(copy, map);
  }
  return { ...doc, nodes };
}

/** After an edit: bring every instance of a changed main component up to date. */
export function syncComponents(previous: SiteDoc, next: SiteDoc): SiteDoc {
  if (previous === next) return next;
  let doc = next;
  for (const main of Object.values(next.nodes)) {
    if (!main.component) continue;
    const ids = subtreeIds(next, main.id);
    const before = previous.nodes[main.id];
    const changed = !before || ids.some(id => next.nodes[id] !== previous.nodes[id]) || ids.length !== subtreeIds(previous, main.id).length;
    if (!changed) continue;
    for (const instance of instancesOf(doc, main.id)) {
      // An instance placed inside its own main component would never stop growing.
      if (ids.includes(instance.id)) continue;
      doc = rebuild(doc, instance.id, main.id);
    }
  }
  return doc;
}

/** Turn an instance into ordinary layers. */
export function detachInstance(doc: SiteDoc, instanceId: string): SiteDoc {
  const nodes = { ...doc.nodes };
  for (const id of subtreeIds(doc, instanceId)) {
    const copy = { ...nodes[id] } as SiteNode;
    delete copy.instanceOf; delete copy.sourceId;
    nodes[id] = copy;
  }
  return { ...doc, nodes };
}
