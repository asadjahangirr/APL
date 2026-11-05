import type { IconName } from '../project/icon-schema';

/** Small, self-contained SVG set shared by preview and independent exports. */
export default function IconGlyph({ name, className }: { name: IconName; className?: string }) {
  const drawing = (() => {
    switch (name) {
      case 'home': return <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></>;
      case 'arrow-left': return <><path d="M20 12H4"/><path d="m10 6-6 6 6 6"/></>;
      case 'arrow-right': return <><path d="M4 12h16"/><path d="m14 6 6 6-6 6"/></>;
      case 'arrow-up-right': return <><path d="M5 19 19 5"/><path d="M7 5h12v12"/></>;
      case 'envelope': return <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>;
      case 'phone': return <path d="M7 3H5a2 2 0 0 0-2 2c0 8.8 7.2 16 16 16a2 2 0 0 0 2-2v-2l-5-2-2-5Z"/>;
      case 'globe': return <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-3 3-4 6-4 9s1 6 4 9M12 3c3 3 4 6 4 9s-1 6-4 9"/></>;
      case 'instagram': return <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></>;
      case 'linkedin': return <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="7.4" cy="8" r=".9" fill="currentColor" stroke="none"/><path d="M7.4 11v6M11.5 17v-6m0 2a3 3 0 0 1 6 0v4"/></>;
      case 'github': return <><path d="M9 19c-4.3 1.3-4.3-2-6-2M15 19c5.7-1.7 5.8-5 5.8-7a7.2 7.2 0 0 0-1.8-4.9c.2-.9.2-2.3-.4-3.5-1.4 0-2.6.8-3.5 1.5a12 12 0 0 0-6.2 0C8 4.4 6.8 3.6 5.4 3.6 4.8 4.8 4.8 6.2 5 7.1A7.2 7.2 0 0 0 3.2 12c0 2 .1 5.3 5.8 7"/><path d="M9 19v-3c0-.8.2-1.3.6-1.7M15 19v-3c0-.8-.2-1.3-.6-1.7"/></>;
      case 'map-pin': return <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>;
      case 'calendar': return <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-14 4h3m4 0h3m-10 4h3"/></>;
      case 'briefcase': return <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13c5 3 13 3 18 0m-9 0v3"/></>;
      case 'check': return <path d="m4 12 5 5L20 6"/>;
    }
  })();
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{drawing}</svg>;
}
