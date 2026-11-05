import { fingerprint } from '../conversion/fingerprint';
import { projectSchema, walkNodes, type BodyNode, type Project, type ReusableComponent, type ReusableInstance, type SitePage } from './schema';

function pageById(project: Project, pageId: string): SitePage {
  const page = project.pages.find(candidate => candidate.id === pageId);
  if (!page) throw new Error('Page not found.');
  return page;
}

function rootById(page: SitePage, nodeId: string): BodyNode {
  const root = page.nodes.find(candidate => candidate.id === nodeId);
  if (!root) throw new Error('Section not found on this page.');
  return root;
}

function componentById(project: Project, componentId: string): ReusableComponent {
  const component = project.components.find(candidate => candidate.id === componentId);
  if (!component) throw new Error('Reusable component not found.');
  return component;
}

function withoutLink(node: BodyNode): BodyNode {
  const copy = structuredClone(node);
  delete copy.reusable;
  return copy;
}

function withChanges(project: Project, pages: SitePage[], components: ReusableComponent[]): Project {
  return projectSchema.parse({ ...project, pages, components, updatedAt: new Date().toISOString() });
}

/** The blueprint's IDs are private. A copy receives its own stable public IDs. */
function materialize(blueprint: BodyNode, previousIds: Record<string, string> = {}): { node: BodyNode; nodeIds: Record<string, string> } {
  const node = withoutLink(blueprint);
  const nodeIds: Record<string, string> = {};
  for (const part of walkNodes([node])) {
    const blueprintId = part.id;
    const publicId = previousIds[blueprintId] ?? crypto.randomUUID();
    part.id = publicId;
    nodeIds[blueprintId] = publicId;
  }
  return { node, nodeIds };
}

/** Keep existing blueprint identities when a linked copy gains or loses children. */
function sourceBlueprint(source: BodyNode, previousIds: Record<string, string>): { node: BodyNode; nodeIds: Record<string, string> } {
  const node = withoutLink(source);
  const originalIds = walkNodes([node]).map(part => part.id);
  const reverse = new Map(Object.entries(previousIds).map(([blueprintId, publicId]) => [publicId, blueprintId]));
  const nodeIds: Record<string, string> = {};
  walkNodes([node]).forEach((part, index) => {
    const blueprintId = reverse.get(originalIds[index]) ?? crypto.randomUUID();
    part.id = blueprintId;
    nodeIds[blueprintId] = originalIds[index];
  });
  return { node, nodeIds };
}

function uniqueAnchor(node: BodyNode, page: SitePage, replacedRootId?: string): BodyNode {
  if (node.type !== 'Section' || !node.props.anchor) return node;
  const used = new Set(page.nodes.filter(root => root.id !== replacedRootId && root.type === 'Section').flatMap(root => root.type === 'Section' && root.props.anchor ? [root.props.anchor] : []));
  if (!used.has(node.props.anchor)) return node;
  const previous = page.nodes.find(root => root.id === replacedRootId);
  if (previous?.type === 'Section' && previous.props.anchor && !used.has(previous.props.anchor)) {
    node.props.anchor = previous.props.anchor;
    return node;
  }
  const base = node.props.anchor.slice(0, 90).replace(/-$/, '');
  for (let suffix = 2; suffix <= 1000; suffix++) {
    const anchor = base + '-' + suffix;
    if (!used.has(anchor)) { node.props.anchor = anchor; return node; }
  }
  throw new Error('This page has too many sections with the same anchor.');
}

async function link(node: BodyNode, componentId: string, revision: number, nodeIds: Record<string, string>): Promise<BodyNode> {
  const clean = withoutLink(node);
  const reusable: ReusableInstance = { componentId, revision, nodeIds, fingerprint: await fingerprint(clean) };
  return { ...clean, reusable } as BodyNode;
}

async function changed(node: BodyNode): Promise<boolean> {
  if (!node.reusable) throw new Error('This section is not a linked component.');
  return await fingerprint(withoutLink(node)) !== node.reusable.fingerprint;
}

export async function reusableInstanceChanged(project: Project, pageId: string, nodeId: string): Promise<boolean> {
  const page = pageById(projectSchema.parse(project), pageId);
  return changed(rootById(page, nodeId));
}

export async function saveReusableComponent(project: Project, pageId: string, nodeId: string, name: string): Promise<{ project: Project; componentId: string }> {
  const current = projectSchema.parse(project);
  const page = pageById(current, pageId), source = rootById(page, nodeId);
  if (source.reusable) throw new Error('Detach this linked copy before saving it as a new component.');
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 80) throw new Error('Give the component a name of up to 80 characters.');
  if (current.components.some(component => component.name.toLowerCase() === cleanName.toLowerCase())) throw new Error('A reusable component already has that name.');
  const componentId = crypto.randomUUID(), blueprint = withoutLink(source);
  const nodeIds = Object.fromEntries(walkNodes([blueprint]).map(part => [part.id, part.id]));
  const component: ReusableComponent = { id: componentId, name: cleanName, revision: 1, sourcePageId: pageId, node: blueprint };
  const linked = await link(source, componentId, 1, nodeIds);
  const pages = current.pages.map(candidate => candidate.id === pageId ? { ...candidate, nodes: candidate.nodes.map(node => node.id === nodeId ? linked : node) } : candidate);
  return { project: withChanges(current, pages, [...current.components, component]), componentId };
}

export async function insertReusableComponent(project: Project, componentId: string, pageId: string, index?: number): Promise<Project> {
  const current = projectSchema.parse(project);
  const component = componentById(current, componentId), page = pageById(current, pageId);
  const position = index ?? page.nodes.length;
  if (!Number.isInteger(position) || position < 0 || position > page.nodes.length) throw new Error('Choose a valid position on the page.');
  const materialized = materialize(component.node);
  uniqueAnchor(materialized.node, page);
  const linked = await link(materialized.node, componentId, component.revision, materialized.nodeIds);
  const pages = current.pages.map(candidate => candidate.id === pageId ? { ...candidate, nodes: [...candidate.nodes.slice(0, position), linked, ...candidate.nodes.slice(position)] } : candidate);
  return withChanges(current, pages, current.components);
}

export async function publishReusableComponent(
  project: Project, componentId: string, sourcePageId: string, sourceNodeId: string, expectedRevision: number,
  options: { overwriteChangedInstances?: boolean } = {},
): Promise<Project> {
  const current = projectSchema.parse(project), component = componentById(current, componentId);
  if (component.revision !== expectedRevision) throw new Error('This component changed. Review its latest revision before updating copies.');
  if (component.revision >= 1_000_000) throw new Error('This component has reached its revision limit.');
  const source = rootById(pageById(current, sourcePageId), sourceNodeId);
  if (source.reusable?.componentId !== componentId) throw new Error('Choose a linked copy of this component as the update source.');
  const canonical = sourceBlueprint(source, source.reusable.nodeIds);
  const revision = component.revision + 1;
  const updated: ReusableComponent = { ...component, node: canonical.node, sourcePageId, revision };
  const pages: SitePage[] = [];
  for (const page of current.pages) {
    const nodes = [...page.nodes];
    for (let index = 0; index < nodes.length; index++) {
      const root = nodes[index];
      if (root.reusable?.componentId !== componentId) continue;
      if (page.id === sourcePageId && root.id === sourceNodeId) {
        nodes[index] = await link(root, componentId, revision, canonical.nodeIds);
      } else {
        if (!options.overwriteChangedInstances && await changed(root)) continue;
        const materialized = materialize(canonical.node, root.reusable.nodeIds);
        uniqueAnchor(materialized.node, { ...page, nodes }, root.id);
        nodes[index] = await link(materialized.node, componentId, revision, materialized.nodeIds);
      }
    }
    pages.push({ ...page, nodes });
  }
  return withChanges(current, pages, current.components.map(item => item.id === componentId ? updated : item));
}

export function detachReusableInstance(project: Project, pageId: string, nodeId: string): Project {
  const current = projectSchema.parse(project);
  const page = pageById(current, pageId), root = rootById(page, nodeId);
  if (!root.reusable) throw new Error('This section is already independent.');
  const pages = current.pages.map(candidate => candidate.id === pageId ? { ...candidate, nodes: candidate.nodes.map(node => node.id === nodeId ? withoutLink(node) : node) } : candidate);
  return withChanges(current, pages, current.components);
}

export function removeReusableComponent(project: Project, componentId: string, options: { detachInstances?: boolean } = {}): Project {
  const current = projectSchema.parse(project);
  componentById(current, componentId);
  const linkedCount = current.pages.reduce((count, page) => count + page.nodes.filter(node => node.reusable?.componentId === componentId).length, 0);
  if (linkedCount && !options.detachInstances) throw new Error('Detach its linked copies before removing this component.');
  const pages = current.pages.map(page => ({ ...page, nodes: page.nodes.map(node => node.reusable?.componentId === componentId ? withoutLink(node) : node) }));
  return withChanges(current, pages, current.components.filter(component => component.id !== componentId));
}
