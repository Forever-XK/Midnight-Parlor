import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import type { Card, Seat } from '@shared/types';
import { boundsInTable } from '@/lib/cardGeometry';
import { sound } from '@/lib/soundManager';
import PlayingCard from './PlayingCard';

interface Props {
  cards: Card[];
  revealed: boolean;
  landlordSeat?: Seat;
  mySeat: Seat;
  paused: boolean;
  laiziRanks: number[];
  onTransferChange: (ids: string[]) => void;
}
type Position = ReturnType<typeof boundsInTable>;
type Target = Position & { slot?: HTMLElement };
interface Transfer { root: HTMLElement; cards: Card[]; starts: Position[] }
const FLIP = .42, STAGGER = .08, FLY_AT = .75, FLIGHT = .6, DONE_AT = 1.65;
const dummy: Card = { id: 'unrevealed-bottom', rank: 3, suit: 'club' };

/** Toolbar backs stay mounted through bidding so there is a real flip origin. */
export default function BottomCards({ cards, revealed, landlordSeat, mySeat, paused, laiziRanks, onTransferChange }: Props) {
  const row = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const busy = useRef(onTransferChange);
  busy.current = onTransferChange;
  const [job, setJob] = useState<Transfer | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [landed, setLanded] = useState<string[]>([]);
  const landedRef = useRef(new Set<string>());
  const [stage, setStage] = useState<'waiting' | 'flip' | 'fly' | 'done'>('waiting');
  const reduced = useReducedMotion();

  useEffect(() => {
    if (paused || !revealed || cards.length !== 3 || landlordSeat == null || started.current) return;
    const root = row.current?.closest<HTMLElement>('.dph-table');
    const slots = row.current?.querySelectorAll<HTMLElement>('[data-bottom-slot]');
    if (!root || !slots || slots.length !== 3) return;
    const table = root.getBoundingClientRect();
    const rotated = document.body.classList.contains('ddz-rotated');
    const starts = [...slots].map(slot => boundsInTable(slot.getBoundingClientRect(), table, root.clientWidth, root.clientHeight, rotated));
    started.current = true;
    landedRef.current.clear();
    setLanded([]);
    setJob({ root, cards: [...cards], starts });
    setStage('flip');
    busy.current(landlordSeat === mySeat ? cards.map(card => card.id) : ['opponent-transfer']);
    sound.selectCard();
  }, [cards, revealed, landlordSeat, mySeat, paused]);

  useEffect(() => {
    if (!job) return;
    const fly = setTimeout(() => {
      const table = job.root.getBoundingClientRect();
      const rotated = document.body.classList.contains('ddz-rotated');
      const hand = [...job.root.querySelectorAll<HTMLElement>('.dph-hand-tray [data-card-id]')];
      const stack = job.root.querySelector<HTMLElement>(`[data-seat-hand="${landlordSeat}"]`);
      setTargets(job.cards.map((card, index) => {
        const own = landlordSeat === mySeat ? hand.find(element => element.dataset.cardId === card.id) : null;
        if (own) return { ...boundsInTable((own.firstElementChild ?? own).getBoundingClientRect(), table, job.root.clientWidth, job.root.clientHeight, rotated), slot: own };
        if (stack) {
          const bounds = boundsInTable(stack.getBoundingClientRect(), table, job.root.clientWidth, job.root.clientHeight, rotated);
          return { x: bounds.x + bounds.width / 2 - 24 + (index - 1) * 9,
            y: bounds.y + bounds.height / 2 - 34, width: 48, height: 68 };
        }
        // Hidden/offscreen hand: still finish safely without holding up the game.
        return { ...job.starts[index], y: job.root.clientHeight - 110 };
      }));
      setStage('fly');
    }, FLY_AT * 1000);
    const finish = setTimeout(() => { setStage('done'); setJob(null); busy.current([]); }, DONE_AT * 1000);
    return () => { clearTimeout(fly); clearTimeout(finish); };
  }, [job, landlordSeat, mySeat]);

  return <>
    <div ref={row} className="ddz-bottom-row flex items-center gap-1.5" aria-label="底牌">
      <span className="text-xs font-body text-gold-400/70">底牌</span>
      <div className="flex gap-0.5">{[0, 1, 2].map(index => <div key={index} data-bottom-slot={index} style={{ visibility: job ? 'hidden' : 'visible' }}>
        <PlayingCard card={cards[index] ?? dummy} faceDown={!(revealed && stage === 'done')} size="sm" laiziRanks={laiziRanks} />
      </div>)}</div>
    </div>
    {job && createPortal(<div className="ddz-bottom-transfer absolute inset-0 z-[45] pointer-events-none" data-stage={stage} role="status" aria-label="底牌翻面并飞入地主手牌">
      {job.cards.map((card, index) => {
        const from = job.starts[index], to = targets[index] ?? from;
        const flying = stage === 'fly';
        const slot = targets[index]?.slot;
        if (landed.includes(card.id)) return null;
        // Fly inside the destination card's stacking context. Neighbouring cards
        // then overlap it in hand order, instead of a table-wide overlay covering
        // the entire hand until all three cards disappear at once.
        if (flying && slot) return createPortal(<motion.div
          key={card.id} data-bottom-flying={card.id}
          className="absolute left-0 top-0 pointer-events-none"
          style={{ width: to.width, height: to.height, transformOrigin: 'top left', visibility: 'visible' }}
          initial={{ x: from.x - to.x, y: from.y - to.y, scaleX: from.width / to.width, scaleY: from.height / to.height }}
          animate={{ x: 0, y: [from.y - to.y, reduced ? 0 : -24, 0], scaleX: 1, scaleY: 1 }}
          transition={{ duration: reduced ? .15 : FLIGHT, delay: index * STAGGER, ease: [.2, .65, .2, 1], times: [0, .7, 1] }}
          onAnimationComplete={() => {
            landedRef.current.add(card.id);
            setLanded([...landedRef.current]);
            busy.current(job.cards.filter(item => !landedRef.current.has(item.id)).map(item => item.id));
          }}
        ><PlayingCard card={card} size="md" laiziRanks={laiziRanks} /></motion.div>, slot, card.id);
        return <motion.div key={card.id} className="ddz-bottom-flying-card" data-bottom-flying={card.id}
          style={{ position: 'absolute', left: 0, top: 0, width: 48, height: 68, transformOrigin: 'top left', perspective: 700 }}
          initial={{ x: from.x, y: from.y, scaleX: from.width / 48, scaleY: from.height / 68 }}
          animate={flying ? { x: [from.x, to.x, to.x], y: [from.y, to.y - (reduced ? 0 : 24), to.y],
            scaleX: to.width / 48, scaleY: to.height / 68, opacity: 1 } : { x: from.x, y: from.y }}
          transition={{ duration: reduced ? .15 : FLIGHT, delay: flying ? index * STAGGER : 0, ease: [.2, .65, .2, 1], times: [0, .7, 1] }}>
          <motion.div className="ddz-bottom-flipper" initial={{ rotateY: 0 }} animate={{ rotateY: 180 }}
            transition={{ delay: index * STAGGER, duration: reduced ? .15 : FLIP, ease: 'easeInOut' }}>
            <div className="ddz-bottom-face"><PlayingCard card={card} faceDown size="sm" /></div>
            <div className="ddz-bottom-face ddz-bottom-front"><PlayingCard card={card} size="sm" laiziRanks={laiziRanks} /></div>
          </motion.div>
        </motion.div>;
      })}
    </div>, job.root)}
  </>;
}
