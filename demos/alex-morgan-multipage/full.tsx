import {useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Render} from '@puckeditor/core';
import {createConfig,toEditor} from '../../src/editor/config';
import {readProject} from '../../src/project/migrate';
import data from './alex-morgan.apl.json';
const project=readProject(data);
function Portfolio(){
 const readPath=()=>new URLSearchParams(window.location.search).get('page')||'/';
 const [path,setPath]=useState(readPath);
 useEffect(()=>{const back=()=>setPath(readPath());window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[]);
 const page=project.pages.find(p=>p.path===path)||project.pages[0];
 useEffect(()=>{document.title=page.title;const frame=requestAnimationFrame(()=>document.getElementById(location.hash.slice(1)||'top')?.scrollIntoView());return()=>cancelAnimationFrame(frame);},[page]);
 return <div onClickCapture={event=>{
  const link=(event.target as HTMLElement).closest('a[href]');if(!link)return;
  const url=new URL(link.getAttribute('href')!,location.origin+page.path);
  if(url.origin!==location.origin||!project.pages.some(p=>p.path===url.pathname))return;
  event.preventDefault();history.pushState(null,'','?page='+encodeURIComponent(url.pathname)+url.hash);setPath(url.pathname);
  if(url.pathname===path)document.getElementById((url.hash||'#top').slice(1))?.scrollIntoView();
 }}><Render key={page.id} config={createConfig(project,page.id,false)} data={toEditor(project,page.id)}/></div>;
}
createRoot(document.getElementById('root')!).render(<Portfolio/>);
