import React from 'react';
import { createRoot } from 'react-dom/client';
import { Render } from '@puckeditor/core';
import { createConfig, toEditor } from '../../src/editor/config';
import { readProject } from '../../src/project/migrate';
import data from './alex-morgan.apl.json';
const project=readProject(data);
// Match the builder preview's one-page navigation while hosted below /demos/.
function followLocalLink(event: React.MouseEvent) {
 const href=(event.target as HTMLElement).closest('a[href]')?.getAttribute('href');
 if(href==='/' || href==='/#contact') {
  event.preventDefault();
  document.getElementById(href==='/'?'top':'contact')?.scrollIntoView();
 }
}
createRoot(document.getElementById('root')!).render(<div onClickCapture={followLocalLink}><Render config={createConfig(project,'home',false)} data={toEditor(project,'home')}/></div>);
