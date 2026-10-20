import { useEffect, useRef } from 'react';
import Personalization from './Personalization';

/** The same personalization workspace is available without leaving a game. */
export default function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('button')?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,summary,[tabindex="0"]') ?? [])].filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  if (!open) return null;
  return <div className="personalization-scrim" onClick={onClose}>
    <div ref={panel} className="personalization-dialog" role="dialog" aria-modal="true" aria-label="个性化" onClick={event => event.stopPropagation()}>
      <Personalization onClose={onClose} />
    </div>
  </div>;
}
