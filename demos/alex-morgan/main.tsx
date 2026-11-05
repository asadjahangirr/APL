import React from 'react';
import { createRoot } from 'react-dom/client';
import Preview from '../../src/editor/Preview';
import { readProject } from '../../src/project/migrate';
import data from './alex-morgan.apl.json';
import '@puckeditor/core/puck.css';
import '../../src/studio.css';
const project=readProject(data);
createRoot(document.getElementById('root')!).render(<Preview project={project} initialPageId="home" close={()=>{ window.location.href='/'; }}/>);
