import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { zipSync, unzipSync } from 'fflate';
import { newProject } from '../src/project/templates';
import { projectSchema } from '../src/project/schema';
import { generateProject, sha256, type Sources } from '../src/export/generate';
import { addPage } from '../src/project/pages';
import { createStudioProject, readStudioProject } from '../src/project/studio-document';
import { createArtboard, createLayer, emptyDesign } from '../src/design/schema';
import { saveReusableComponent, detachReusableInstance } from '../src/project/reusable';
import legacy from './fixtures/project-v1.json';
const sources: Sources = {};
function read(dir: string) { for(const item of readdirSync(dir,{withFileTypes:true})) {
  if (item.name === 'node_modules' || item.name === '.next') continue;
  const file = path.join(dir,item.name); if(item.isDirectory()) read(file); else sources[file.replaceAll('\\','/')] = readFileSync(file,'utf8');
} }
read('templates'); read('src/site'); sources['src/project/schema.ts']=readFileSync('src/project/schema.ts','utf8');
sources['src/project/service-schema.ts']=readFileSync('src/project/service-schema.ts','utf8');
for (const helper of ['portfolio-schema.ts', 'article-schema.ts', 'link-schema.ts', 'icon-schema.ts', 'appearance-schema.ts', 'theme.ts']) sources['src/project/' + helper] = readFileSync('src/project/' + helper, 'utf8');
const decode = (data:Uint8Array)=>new TextDecoder().decode(data);
describe('validated project document',()=>{
  it('rejects executable URLs and unknown props',()=>{
    const p = newProject();
    p.shared.header.props.target.anchor='javascript:alert(1)';
    expect(projectSchema.safeParse(p).success).toBe(false);
    const extra=newProject(); Object.assign(extra.pages[0].nodes[0].props,{onClick:'malicious()'});
    expect(projectSchema.safeParse(extra).success).toBe(false);
  });
  it('rejects impossible responsive columns',()=>{
    const p=newProject(); p.pages[0].nodes.find(n=>n.type==='Services')!.props.desktop=100;
    expect(projectSchema.safeParse(p).success).toBe(false);
  });
  it('rejects duplicate IDs and unsafe asset addresses',()=>{
    const p=newProject(); p.pages[0].nodes[1].id=p.pages[0].nodes[0].id;
    expect(projectSchema.safeParse(p).success).toBe(false);
    const image=newProject(); image.pages[0].nodes.find(n=>n.type==='Hero')!.props.image='https://builder.example/private/file';
    expect(projectSchema.safeParse(image).success).toBe(false);
  });
  it('rejects future schema versions instead of silently damaging them',()=>{
    expect(projectSchema.safeParse({...newProject(),schemaVersion:999}).success).toBe(false);
  });
});
describe('independent source export',()=>{
  it('keeps unused reusable blueprints in the private backup and out of public runtime data', async () => {
    const project = newProject();
    const root = { id: crypto.randomUUID(), type: 'Text' as const, props: { title: 'Unused idea', body: 'PRIVATE_UNUSED_BLUEPRINT', align: 'left' as const } };
    project.pages[0].nodes.push(root);
    const saved = await saveReusableComponent(project, 'home', root.id, 'Private unused section');
    const detached = detachReusableInstance(saved.project, 'home', root.id);
    detached.pages[0].nodes = detached.pages[0].nodes.filter(node => node.id !== root.id);
    const { files } = await generateProject(detached, sources);
    expect(decode(files['project.apl.json'])).toContain('PRIVATE_UNUSED_BLUEPRINT');
    const runtime = JSON.parse(decode(files['site-data.json']));
    expect(runtime.components).toBeUndefined();
    expect(decode(files['site-data.json'])).not.toContain('PRIVATE_UNUSED_BLUEPRINT');
    for (const [file, bytes] of Object.entries(files)) {
      if (file !== 'project.apl.json' && file !== 'export-manifest.json') expect(decode(bytes), file).not.toContain('PRIVATE_UNUSED_BLUEPRINT');
    }
  });
  it('keeps full Design in a private v10 backup while exporting only Website runtime data and assets', async () => {
    const website = newProject();
    const artboard = createArtboard({ id: 'private-artboard' });
    const design = {
      ...emptyDesign(), artboards: [artboard],
      assets: [{ id: 'private-image', name: 'Design-only image', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', width: 1, height: 1 }],
      layers: [createLayer('image', artboard.id, { id: 'private-image-layer', assetId: 'private-image' }), createLayer('text', artboard.id, { id: 'private-text', text: 'Unpublished design exploration' })]
    };
    const studio = createStudioProject(website, design);
    const { files, project } = await generateProject(studio, sources);
    const websiteExport = await generateProject(website, sources);
    expect(project).toEqual(website);
    expect(readStudioProject(JSON.parse(decode(files['project.apl.json'])))).toEqual(studio);
    expect(decode(files['site-data.json'])).toBe(decode(websiteExport.files['site-data.json']));
    expect(Object.keys(files)).toEqual(Object.keys(websiteExport.files));
    for (const [name, bytes] of Object.entries(files)) {
      if (name === 'project.apl.json' || name === 'export-manifest.json') continue;
      expect(bytes, name).toEqual(websiteExport.files[name]);
    }
    expect(Object.keys(files).some(name => /(?:design|studio-document|puck)/.test(name))).toBe(false);
    expect(Object.keys(files).filter(name => name.startsWith('public/assets/'))).toEqual([]);
    const zip = unzipSync(zipSync(files));
    const manifest = JSON.parse(decode(zip['export-manifest.json']));
    for (const [name, hash] of Object.entries(manifest.files)) expect(await sha256(zip[name])).toBe(hash);
    expect(await sha256(new TextEncoder().encode(JSON.stringify(manifest.files)))).toBe(manifest.contentHash);
    expect(JSON.stringify(studio.design)).toBe(JSON.stringify(design));
  }, 15_000); // Two complete exports, ZIP generation, and per-file cryptographic checks.
  it('exports migrated backups and every nested page with metadata and shared layout',async()=>{
    const migrated = await generateProject(legacy,sources);
    expect(migrated.project.schemaVersion).toBe(9);
    const p=addPage(newProject(),'Our approach','/about/approach');
    p.pages[1].nodes.push(p.pages[0].nodes.find(node=>node.type==='Contact')!);
    p.pages[0].nodes=p.pages[0].nodes.filter(node=>node.type!=='Contact');
    p.shared.header.props.target.pageId=p.pages[1].id;
    const {files,modules}=await generateProject(p,sources);
    expect(files['app/about/approach/page.tsx']).toBeDefined();
    expect(decode(files['app/about/approach/page.tsx'])).toContain('../../../site-data.json');
    expect(decode(files['app/about/approach/page.tsx'])).toContain('export const metadata');
    expect(decode(files['src/site/SiteShell.tsx'])).toContain('site.shared.header.props');
    expect(JSON.parse(decode(files['site-navigation.json'])).action).toBe('/about/approach#contact');
    expect(modules).toContain('contact');
  });
  it('omits disabled shared components and blocks empty public pages',async()=>{
    const p=newProject(); p.shared.header.enabled=false; p.shared.footer.enabled=false;
    const {files}=await generateProject(p,sources);
    expect(files['src/site/Header.tsx']).toBeUndefined(); expect(files['src/site/Footer.tsx']).toBeUndefined();
    expect(decode(files['src/site/SiteShell.tsx'])).not.toContain('import Header');
    p.pages[0].nodes=[]; await expect(generateProject(p,sources)).rejects.toThrow('content section');
  });
  it('rejects navigation pointing at a removed section',async()=>{
    const p=newProject(); p.pages[0].nodes=p.pages[0].nodes.filter(n=>n.type!=='Contact');
    await expect(generateProject(p,sources)).rejects.toThrow('missing section');
  });
  it('includes real contact handlers, admin source and migration',async()=>{
    const {files}=await generateProject(newProject(),sources);
    expect(files['app/api/contact/route.ts']).toBeDefined();
    expect(files['app/admin/page.tsx']).toBeDefined();
    expect(files['supabase/migrations/20260926000000_contact.sql']).toBeDefined();
    expect(files['.env.example']).toBeDefined();
    expect(files['scripts/verify.mjs']).toBeDefined();
    expect(files['SETUP.md']).toBeDefined();
    expect(decode(files['app/page.tsx'])).not.toContain('@puckeditor');
  });
  it('removes unused backend, component sources, and their dependencies',async()=>{
    const p=newProject(); p.pages[0].nodes=p.pages[0].nodes.filter(n=>n.type!=='Contact'); p.shared.header.props.target.anchor='#services';
    const {files,modules}=await generateProject(p,sources);
    expect(modules).toEqual([]);
    expect(files['src/site/Contact.tsx']).toBeUndefined();
    expect(files['src/site/Text.tsx']).toBeUndefined();
    expect(Object.keys(files).some(k=>k.startsWith('app/admin')||k.startsWith('app/api/')||k.startsWith('supabase/'))).toBe(false);
    expect(decode(files['package.json'])).not.toContain('@supabase');
    expect(decode(files['package-lock.json'])).not.toContain('node_modules/@supabase');
  });
  it('keeps user text in data rather than turning it into source code',async()=>{
    const p=newProject(); const payload='</script><script>alert(1)</script> \"; process.exit(); //';
    p.pages[0].nodes.find(n=>n.type==='Hero')!.props.title=payload;
    const {files}=await generateProject(p,sources);
    expect(decode(files['app/page.tsx'])).not.toContain(payload);
    expect(JSON.parse(decode(files['site-data.json'])).pages[0].nodes.find((n:{type:string})=>n.type==='Hero').props.title).toBe(payload);
  });
  it('packages selected image bytes and replaces their inline data with local paths',async()=>{
    const p=newProject(); const hero=p.pages[0].nodes.find(n=>n.type==='Hero')!;
    hero.props.image='data:image/png;base64,iVBORw0KGgo=';
    const {files}=await generateProject(p,sources);
    const file='public/assets/'+hero.id+'.png';
    expect(Array.from(files[file])).toEqual([137,80,78,71,13,10,26,10]);
    expect(JSON.parse(decode(files['site-data.json'])).pages[0].nodes.find((n:{type:string})=>n.type==='Hero').props.image).toBe('/assets/'+hero.id+'.png');
  });
  it('produces deterministic, hash-checked ZIP contents',async()=>{
    const p=newProject(); const a=await generateProject(p,sources); const b=await generateProject(p,sources);
    expect(decode(a.files['export-manifest.json'])).toEqual(decode(b.files['export-manifest.json']));
    const zip=unzipSync(zipSync(a.files)); const manifest=JSON.parse(decode(zip['export-manifest.json']));
    for(const [file,hash] of Object.entries(manifest.files)) expect(await sha256(zip[file])).toBe(hash);
    expect(manifest.status).toBe('generated-verification-required');
  });
  it('rejects an unsafe generated path',async()=>{
    await expect(generateProject(newProject(),{...sources,'templates/base/../../outside.txt':'bad'})).rejects.toThrow('Unsafe export path');
  });
  it('fails explicitly if dependency locking was not completed',async()=>{
    const copy={...sources}; delete copy['templates/base/package-lock.json'];
    await expect(generateProject(newProject(),copy)).rejects.toThrow('lock is missing');
  });
});
