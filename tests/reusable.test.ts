import { describe, expect, it } from 'vitest';
import { addPage } from '../src/project/pages';
import { newProject } from '../src/project/templates';
import { projectSchema, walkNodes, type BodyNode, type Project } from '../src/project/schema';
import { detachReusableInstance, insertReusableComponent, publishReusableComponent, removeReusableComponent, reusableInstanceChanged, saveReusableComponent } from '../src/project/reusable';

function projectWithSection(): { project: Project; sourceId: string } {
  const project = addPage(addPage(newProject(), 'About', '/about'), 'Work', '/work');
  const sourceId = crypto.randomUUID();
  const section: BodyNode = {
    id: sourceId, type: 'Section',
    props: { padding: { mobile: 24 }, width: 'content', tone: 'plain', anchor: '#c-invitation' },
    children: [{ id: crypto.randomUUID(), type: 'Heading', props: { text: 'Talk to us', level: 'h2', size: 'medium', align: 'left' } }],
  };
  project.pages[0].nodes.push(section);
  return { project: projectSchema.parse(project), sourceId };
}

function section(project: Project, pageId: string, rootId?: string) {
  const roots = project.pages.find(page => page.id === pageId)!.nodes.filter(node => node.type === 'Section');
  const root = roots.find(node => !rootId || node.id === rootId);
  if (!root || root.type !== 'Section') throw new Error('Missing test section.');
  return root;
}

function heading(root: ReturnType<typeof section>) {
  const node = root.children[0];
  if (node.type !== 'Heading') throw new Error('Missing test heading.');
  return node;
}

describe('reusable website components', () => {
  it('saves a blueprint and inserts independent ID-mapped copies with unique same-page anchors', async () => {
    const { project, sourceId } = projectWithSection();
    const original = JSON.stringify(project);
    const saved = await saveReusableComponent(project, 'home', sourceId, '  Invitation  ');
    expect(JSON.stringify(project)).toBe(original);
    expect(saved.project.components[0].name).toBe('Invitation');
    expect(section(saved.project, 'home').reusable?.revision).toBe(1);
    let result = await insertReusableComponent(saved.project, saved.componentId, 'home');
    result = await insertReusableComponent(result, saved.componentId, 'home');
    expect(projectSchema.parse(result)).toEqual(result);
    const roots = result.pages[0].nodes.filter(node => node.type === 'Section');
    expect(roots.map(root => root.type === 'Section' && root.props.anchor)).toEqual(['#c-invitation', '#c-invitation-2', '#c-invitation-3']);
    const ids = result.pages.flatMap(page => walkNodes(page.nodes).map(node => node.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const root of roots) expect(await reusableInstanceChanged(result, 'home', root.id)).toBe(false);
  });

  it('updates clean copies, protects locally edited ones, and requires explicit overwrite', async () => {
    const { project, sourceId } = projectWithSection();
    const saved = await saveReusableComponent(project, 'home', sourceId, 'Invitation');
    let result = await insertReusableComponent(saved.project, saved.componentId, project.pages[1].id);
    result = await insertReusableComponent(result, saved.componentId, project.pages[2].id);
    const aboutId = result.pages[1].nodes.at(-1)!.id, workId = result.pages[2].nodes.at(-1)!.id;
    heading(section(result, 'home')).props.text = 'New public invitation';
    heading(section(result, project.pages[1].id, aboutId)).props.text = 'Private about edit';
    expect(await reusableInstanceChanged(result, project.pages[1].id, aboutId)).toBe(true);
    result = await publishReusableComponent(result, saved.componentId, 'home', sourceId, 1);
    expect(heading(section(result, project.pages[2].id, workId)).props.text).toBe('New public invitation');
    expect(heading(section(result, project.pages[1].id, aboutId)).props.text).toBe('Private about edit');
    expect(section(result, project.pages[1].id, aboutId).reusable?.revision).toBe(1);
    expect(result.components[0].revision).toBe(2);
    await expect(publishReusableComponent(result, saved.componentId, 'home', sourceId, 1)).rejects.toThrow('changed');
    result = await publishReusableComponent(result, saved.componentId, 'home', sourceId, 2, { overwriteChangedInstances: true });
    expect(heading(section(result, project.pages[1].id, aboutId)).props.text).toBe('New public invitation');
    expect(section(result, project.pages[1].id, aboutId).reusable?.revision).toBe(3);
    expect(await reusableInstanceChanged(result, project.pages[1].id, aboutId)).toBe(false);
  });

  it('detaches or removes links without deleting page content', async () => {
    const { project, sourceId } = projectWithSection();
    const saved = await saveReusableComponent(project, 'home', sourceId, 'Invitation');
    let result = await insertReusableComponent(saved.project, saved.componentId, project.pages[1].id);
    const aboutId = result.pages[1].nodes.at(-1)!.id;
    expect(() => removeReusableComponent(result, saved.componentId)).toThrow('Detach');
    result = detachReusableInstance(result, project.pages[1].id, aboutId);
    expect(section(result, project.pages[1].id, aboutId).reusable).toBeUndefined();
    result = removeReusableComponent(result, saved.componentId, { detachInstances: true });
    expect(result.components).toHaveLength(0);
    expect(section(result, 'home').reusable).toBeUndefined();
    expect(heading(section(result, project.pages[1].id, aboutId)).props.text).toBe('Talk to us');
  });
});
