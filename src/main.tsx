import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './studio.css';
import './studio/studio-shell.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
