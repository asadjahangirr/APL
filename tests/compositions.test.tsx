import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {newProject} from '../src/project/templates';
import {readProject} from '../src/project/migrate';
import {legacyV5ProjectSchema} from '../src/project/legacy-v5-schema';
import {projectSchema} from '../src/project/schema';
import {toEditor,fromEditor} from '../src/editor/config';
import {generateProject,type Sources} from '../src/export/generate';
import {headerDesigns,heroDesigns} from '../src/editor/composition-designs';
import {buttonDesigns} from '../src/site/layout-utils';
import Header from '../src/site/Header';
import Hero from '../src/site/Hero';
import Button from '../src/site/Button';
const sources:Sources={};
function read(dir:string){for(const f of readdirSync(dir,{withFileTypes:true})){if(['node_modules','.next'].includes(f.name))continue;const p=path.join(dir,f.name);if(f.isDirectory())read(p);else sources[p.replaceAll('\\','/')]=readFileSync(p,'utf8');}}
read('templates');read('src/site');
read('src/project');
describe('composition catalog and independent exports',()=>{
 it('migrates v5 without changing stored fields, content or IDs',()=>{
  const {components:_components,...historical}=newProject();
  const {articles:_articles,...content}=historical.content;
  const old=legacyV5ProjectSchema.parse({...historical,schemaVersion:5,content}),before=structuredClone(old);
  expect(readProject(old)).toEqual({...before,schemaVersion:9,components:[],content:{...content,articles:[]}});expect(old).toEqual(before);
  expect(()=>readProject({...old,shared:{...old.shared,header:{...old.shared.header,props:{...old.shared.header.props,design:'editorial'}}}})).toThrow();
 });
 it('rejects unsupported recipes and script-shaped settings',()=>{
  const p=newProject();expect(projectSchema.safeParse({...p,shared:{...p.shared,header:{...p.shared.header,props:{...p.shared.header.props,design:'<script>'}}}}).success).toBe(false);
 });
 for(const header of headerDesigns)it('preserves '+header.label+' navigation and the exact export data',async()=>{
  const p=newProject();p.shared.header.props.design=header.value;
  p.pages=heroDesigns.map((hero,i)=>({id:i===0?'home':'page'+i,name:hero.label,path:i===0?'/':'/page-'+i,title:hero.label,description:'',inNavigation:true,nodes:[
    {id:'hero'+i,type:'Hero',props:{eyebrow:'Studio',title:'A useful website',description:'Your own words',image:'',imageAlt:'',layout:hero.value,motion:'unveil'}},
    {id:'section'+i,type:'Section',props:{padding:{mobile:24},width:'content',tone:'plain'},children:buttonDesigns.map((b,j)=>({id:'button'+i+'-'+j,type:'Button',props:{label:b.label,target:{pageId:'home',anchor:'#top'},variant:b.value,shape:'pill',motion:'sweep'}}))}
  ]}));
  p.shared.header.props.target={pageId:'home',anchor:'#top'};
  const valid=projectSchema.parse(p);const roundtrip=fromEditor(toEditor(valid),valid);
  expect(roundtrip.pages).toEqual(valid.pages);expect(roundtrip.shared).toEqual(valid.shared);
  const {files,modules}=await generateProject(valid,sources);
  const data=JSON.parse(new TextDecoder().decode(files['site-data.json']));
  expect(data.pages).toEqual(valid.pages);expect(data.shared.header.props.design).toBe(header.value);
  expect(modules).not.toContain('contact');expect(files['app/api/contact/route.ts']).toBeUndefined();
  expect(new TextDecoder().decode(files['src/site/Header.tsx'])).toBe(sources['src/site/Header.tsx']);
  expect(new TextDecoder().decode(files['src/site/Hero.tsx'])).toBe(sources['src/site/Hero.tsx']);
  expect(new TextDecoder().decode(files['src/site/Button.tsx'])).toBe(sources['src/site/Button.tsx']);
  const html=renderToStaticMarkup(<Header {...p.shared.header.props} href="/#top" links={[{id:'home',label:'Home',href:'/'},{id:'work',label:'Work',href:'/work'}]} activePageId="work"/>);
  expect(html).toContain('aria-current="page"');expect(html).toContain('href="/work"');expect(html).toContain('<details');
 });
 it('escapes authored text and keeps explicit link destinations in every button',()=>{
  for(const b of buttonDesigns){const html=renderToStaticMarkup(<Button id="b" label={'<script>alert(1)</script>'} target={{pageId:'home',anchor:'#top'}} href="/work" variant={b.value} shape="rounded" motion="arrow"/>);expect(html).not.toContain('<script>');expect(html).toContain('href="/work"');}
 });
 it('keeps titles and alternative text in all hero recipes, with or without images',()=>{
  for(const h of heroDesigns)for(const image of ['', '/assets/portrait.png']){const html=renderToStaticMarkup(<Hero eyebrow="About" title="Your own story" description="Independent work." image={image} imageAlt="Designer in the studio" layout={h.value}/>);expect(html).toContain('<h1>Your own story</h1>');if(image)expect(html).toContain('alt="Designer in the studio"');else expect(html).not.toContain('<img');}
 });
});
