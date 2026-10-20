import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Card } from '@shared/types';
import PlayingCard from './PlayingCard';
import { boundsInTable } from '@/lib/cardGeometry';
import { sortCardsDesc } from '@/lib/cards';

export const MENZHUA_REVEAL_MS = 1900;

function FlipCard({ card, delay = 0 }: { card: Card; delay?: number }) {
  const [faceUp, setFaceUp] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFaceUp(true), (delay + .225) * 1000);
    return () => clearTimeout(timer);
  }, [delay]);
  // Swap the face exactly at the edge-on point. A single card layer avoids
  // backface compositing differences in scaled/rotated browser viewports.
  return <div className="relative w-16 h-[90px]" data-flip-face={faceUp ? 'front' : 'back'}
    style={{ animation: `ddz-deal-card-flip .45s ease-in-out ${delay}s both` }}>
    <PlayingCard card={card} faceDown={!faceUp} size="md" />
  </div>;
}

export function DealIntro({ kind, card, onDone }: { kind: 'redeal' | 'ming'; card?: Card; onDone: () => void }) {
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    const timer = setTimeout(() => done.current(), kind === 'ming' ? 1400 : 1100);
    return () => clearTimeout(timer);
  }, [kind]);
  return <motion.div className="fixed inset-0 z-[58] flex flex-col items-center justify-center gap-10 pointer-events-none"
    style={{ background: 'radial-gradient(ellipse,#222236d9,#181c2d70)' }}
    role="status" aria-label={kind === 'redeal' ? '无人叫地主，重新发牌' : '闷抓明牌揭晓'}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <div className="font-display text-3xl text-gold-300 text-shadow-gold">{kind === 'redeal' ? '无人叫地主，重新发牌' : '本局明牌'}</div>
    {kind === 'ming' && card && <div style={{ scale: 1.5, perspective: 700 }}><FlipCard card={card} delay={.15} /></div>}
    {kind === 'ming' && <small className="text-ivory/70">获得明牌的玩家优先选择地主</small>}
  </motion.div>;
}

export function MenzhuaReveal({ cards, onDone }: { cards: Card[]; onDone: () => void }) {
  const [cardsAtStart] = useState(() => cards);
  const root = useRef<HTMLDivElement>(null);
  const done = useRef(onDone); done.current = onDone;
  const [positions, setPositions] = useState<Array<{ card: Card; x: number; y: number }>>([]);
  useLayoutEffect(() => {
    const overlay = root.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const slots = new Map(Array.from(document.querySelectorAll<HTMLElement>('.dph-hand-tray [data-card-id]'))
      .map(slot => [slot.dataset.cardId, slot]));
    const sorted = sortCardsDesc(cardsAtStart);
    const step = Math.min(38, (overlay.clientWidth * .8 - 64) / Math.max(1, sorted.length - 1));
    setPositions(sorted.map((card, index) => {
      const slot = slots.get(card.id);
      const point = slot ? boundsInTable(slot.getBoundingClientRect(), rect, overlay.clientWidth, overlay.clientHeight,
        document.body.classList.contains('ddz-rotated')) : { x: overlay.clientWidth / 2 + (index - (sorted.length - 1) / 2) * step - 32, y: overlay.clientHeight - 125 };
      return { card, x: point.x, y: point.y };
    }));
  // Cards are captured at the presentation barrier; queued network updates
  // must not restart their flip or move their destinations.
  }, [cardsAtStart]);
  useEffect(() => {
    const timer = setTimeout(() => done.current(), MENZHUA_REVEAL_MS);
    return () => clearTimeout(timer);
  }, []);
  return <div ref={root} className="fixed inset-0 z-[58] pointer-events-none" data-stage="menzhua-reveal">
    <motion.div className="absolute top-[40%] left-1/2 rounded-2xl border border-gold-400/40 bg-ink-900/90 px-8 py-5 text-center" style={{ translate: '-50% 0' }}
      role="status" aria-label="无人叫地主，明牌" initial={{ opacity: 0, scale: .8 }} animate={{ opacity: [0, 1, 1, 0], scale: [.8, 1, 1, 1] }}
      transition={{ duration: 1.8, times: [0, .15, .8, 1] }}>
      <strong className="font-display text-2xl text-gold-300">无人叫地主，明牌</strong>
      <p className="text-xs text-ivory/70 mt-2">翻开手牌后继续叫地主</p>
    </motion.div>
    {positions.map(({ card, x, y }, index) => <div key={card.id} className="absolute" style={{ left: x, top: y, zIndex: index, perspective: 700 }}>
      <FlipCard card={card} delay={.7 + index * .025} />
    </div>)}
  </div>;
}
