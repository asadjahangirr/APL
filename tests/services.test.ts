import { describe,it,expect } from 'vitest';
import { newProject } from '../src/project/templates';
import { readProject } from '../src/project/migrate';
import { projectSchema } from '../src/project/schema';
import { addServiceCollection,createService,mutateService,publicServices } from '../src/project/services';
import { emptyService } from '../src/project/service-schema';
import { legacyV3ProjectSchema } from '../src/project/legacy-v3-schema';
import { toEditor,fromEditor } from '../src/editor/config';
describe('saved and published services',()=>{
  it('migrates v3 without changing existing sections or the original backup',()=>{const {content:_content,components:_components,...p}=newProject();const old=legacyV3ProjectSchema.parse({...p,schemaVersion:3,theme:{accent:p.theme.accent,font:p.theme.font}});const before=structuredClone(old);const migrated=readProject(old);expect(old).toEqual(before);expect(migrated.schemaVersion).toBe(9);expect(migrated.components).toEqual([]);expect(migrated.pages).toEqual(old.pages);expect(migrated.content.services).toEqual([]);});
  it('saves drafts separately from public snapshots and rejects stale edits',()=>{
    let {project,id}=createService(newProject());
    project=mutateService(project,id,'save',1,{...emptyService(),title:'Strategy',slug:'strategy'});
    expect(publicServices(project)).toEqual([]);
    project=mutateService(project,id,'publish',2);
    const before=structuredClone(project);
    project=mutateService(project,id,'save',3,{...project.content.services[0].draft,title:'Private rewrite'});
    expect(publicServices(project)[0].title).toBe('Strategy');expect(before.content.services[0].draft.title).toBe('Strategy');
    expect(()=>mutateService(project,id,'publish',3)).toThrow(/changed/);
    project=mutateService(project,id,'publish',4);expect(publicServices(project)[0].title).toBe('Private rewrite');
    project=mutateService(project,id,'unpublish',5);expect(publicServices(project)).toEqual([]);expect(project.content.services[0].draft.title).toBe('Private rewrite');
  });
  it('keeps blank drafts private and rejects duplicate published slugs',()=>{let first=createService(newProject());expect(()=>mutateService(first.project,first.id,'publish',1)).toThrow();let p=mutateService(first.project,first.id,'save',1,{...emptyService(),title:'One',slug:'one'});p=mutateService(p,first.id,'publish',2);const second=createService(p);p=mutateService(second.project,second.id,'save',1,{...emptyService(),title:'Two',slug:'one'});expect(()=>mutateService(p,second.id,'publish',2)).toThrow(/unique/);});
  it('reserves service routes only when selected and preserves CMS data through editor changes',()=>{let {project,id}=createService(newProject());project=mutateService(project,id,'save',1,{...emptyService(),title:'Kept draft'});project=addServiceCollection(project,'home');expect(fromEditor(toEditor(project),project).content).toEqual(project.content);expect(()=>projectSchema.parse({...project,pages:[...project.pages,{...project.pages[0],id:'another',path:'/services',nodes:[]}]})).toThrow(/services/);});
});

it('normalizes service UUIDs before checking duplicate identities',()=>{
  const {project}=createService(newProject());const record=project.content.services[0];
  const uppercase={...record,id:record.id.toUpperCase()};
  expect(projectSchema.parse({...project,content:{...project.content,services:[uppercase]}}).content.services[0].id).toBe(record.id);
  expect(()=>projectSchema.parse({...project,content:{...project.content,services:[record,uppercase]}})).toThrow(/unique/);
});
