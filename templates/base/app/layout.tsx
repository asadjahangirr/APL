import type { ReactNode } from 'react';
import './globals.css';
import site from '../site-data.json';
export const metadata = { title: site.name };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body style={{ margin: 0 }}>{children}</body></html>;
}
