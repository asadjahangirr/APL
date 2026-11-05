import { useEffect, useRef, type ReactNode } from 'react';
export default function Dialog({ title, close, children, wide = false }: { title: string; close: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return <dialog ref={ref} className={'dialog settings-dialog' + (wide ? ' wide-dialog' : '')} aria-label={title} onCancel={event => { event.preventDefault(); close(); }}>
    <div className="dialog-heading"><h2>{title}</h2><button type="button" onClick={close} aria-label={'Close ' + title}>Close</button></div>
    {children}
  </dialog>;
}
