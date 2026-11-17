import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

// The editor is the whole app. /render shows the renderer test page; every other
// address (including old /v2 links) opens the editor.
const Editor = lazy(() => import('./canvas/Editor'));
const RenderDemo = lazy(() => import('./v2/RenderDemo'));
const path = window.location.pathname.replace(/\/+$/, '');
const screen = path === '/render' || path === '/v2/render' ? <RenderDemo /> : <Editor />;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={null}>{screen}</Suspense>
  </React.StrictMode>,
);
