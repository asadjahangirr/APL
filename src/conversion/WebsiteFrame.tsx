import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Render } from '@puckeditor/core';
import { createConfig, toEditor } from '../editor/config';
import type { Project } from '../project/schema';

/** The iframe keeps its real viewport width while its outer view is scaled to fit. */
export default function WebsiteFrame({ project, pageId, width, title }: { project: Project; pageId: string; width: number; title: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(width);
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [height, setHeight] = useState(900);
  const [activePage, setActivePage] = useState(pageId);
  const scale = Math.min(1, available / width);
  useEffect(() => setActivePage(pageId), [pageId, project]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => setAvailable(entries[0].contentRect.width));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const body = frame?.contentDocument?.body;
    if (!ready || !body) return;
    const observer = new ResizeObserver(() => setHeight(Math.min(30000, Math.max(500, body.scrollHeight))));
    observer.observe(body);
    return () => observer.disconnect();
  }, [frame, ready, project, activePage, width]);
  return <div ref={host} className="conversion-frame-host">
    <div style={{ width: width * scale, height: height * scale }}>
      <iframe ref={setFrame} title={title} onLoad={() => setReady(true)}
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        srcDoc="<!doctype html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'></head><body style='margin:0'></body></html>"/>
      {ready && frame?.contentDocument?.body && createPortal(<div onClickCapture={event => {
        const link = (event.target as HTMLElement).closest('a[href]');
        if (!link) return;
        const href = link.getAttribute('href')!;
        const url = new URL(href, 'https://preview.invalid');
        if (url.origin !== 'https://preview.invalid') return;
        event.preventDefault();
        const target = project.pages.find(page => page.path === url.pathname);
        if (target) setActivePage(target.id);
        window.setTimeout(() => frame.contentDocument?.getElementById(url.hash.slice(1) || 'top')?.scrollIntoView(), 0);
      }}><Render key={activePage} config={createConfig(project, activePage, false)} data={toEditor(project, activePage)}/></div>, frame.contentDocument.body)}
    </div>
  </div>;
}
