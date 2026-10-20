import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Crown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Seat } from '@shared/types';
import { boundsInTable } from '@/lib/cardGeometry';

interface Props { gameId: string; seat: Seat; paused: boolean; onDone: (gameId: string) => void }
interface Flight { x: number; y: number; targetX: number; targetY: number; scale: number }

/** 先在桌中央亮出皇冠，再飞向实际座位标记；跟随桌面的缩放/旋转。 */
export default function LandlordCrown({ gameId, seat, paused, onDone }: Props) {
  const overlay = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const completed = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;
  const [flight, setFlight] = useState<Flight | null>(null);
  const reduced = useReducedMotion();
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    done.current(gameId);
  }, [gameId]);
  useLayoutEffect(() => {
    if (paused || started.current) return;
    const element = overlay.current;
    const table = element?.closest<HTMLElement>('.dph-table');
    const target = table?.querySelector<HTMLElement>(`[data-landlord-crown-target="${seat}"]`);
    if (!element || !table || !target) { finish(); return; }
    started.current = true;
    const bounds = boundsInTable(target.getBoundingClientRect(), table.getBoundingClientRect(),
      table.clientWidth, table.clientHeight, document.body.classList.contains('ddz-rotated'));
    setFlight({ x: table.clientWidth / 2 - 48, y: table.clientHeight / 2 - 72,
      targetX: bounds.x + bounds.width / 2 - 48, targetY: bounds.y + bounds.height / 2 - 48,
      scale: Math.min(bounds.width, bounds.height) / 96 });
  }, [paused, gameId, seat, finish]);

  const duration = reduced ? .25 : 1.55;
  return <div ref={overlay} className="ddz-coronation" data-coronation-seat={seat} role="status" aria-label="地主就位">
    {flight && <>
      {!reduced && <motion.div className="ddz-coronation-halo" style={{ left: flight.x + 48, top: flight.y + 48 }}
        initial={{ opacity: 0, scale: .5 }} animate={{ opacity: [0, .8, 0], scale: [.5, 1.1, 1.45] }}
        transition={{ duration: .9 }} />}
      <motion.div className="ddz-coronation-crown" initial={{ x: flight.x, y: flight.y + 18, opacity: 0, scale: .6 }}
        animate={{ x: reduced ? flight.targetX : [flight.x, flight.x, flight.targetX],
          y: reduced ? flight.targetY : [flight.y + 18, flight.y, flight.targetY],
          scale: reduced ? flight.scale : [.6, 1.12, flight.scale], rotate: reduced ? 0 : [-12, 0, 0], opacity: [0, 1, 1] }}
        transition={{ duration, times: [0, .55, 1], ease: 'easeInOut' }} onAnimationComplete={finish}>
        <Crown size={96} strokeWidth={1.35} />
      </motion.div>
      <motion.div className="ddz-coronation-title" style={{ left: flight.x + 48, top: flight.y + 112 }}
        initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: reduced ? .2 : 1.1, times: [0, .2, .65, 1] }}>地主就位</motion.div>
    </>}
  </div>;
}
