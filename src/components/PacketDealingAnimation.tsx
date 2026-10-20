import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PlayerPublic, Seat } from '@shared/types';
import { buildPacketDeal, packetDealTimeline } from '@/lib/packetDeal';
import { PACKET_DEAL } from '@/config/dealAnimations';
import { dphAsset } from '@/config/dphTheme';
import { sound } from '@/lib/soundManager';
import PlayingCard from './PlayingCard';
import { measureHandTargets } from '@/lib/cardGeometry';

interface Props {
  players: PlayerPublic[];
  mySeat: Seat;
  gameId: string;
  onDone: () => void;
  laiziRanks?: number[];
}
interface Point { x: number; y: number }

export default function PacketDealingAnimation({ players, mySeat, gameId, onDone, laiziRanks = [] }: Props) {
  // Keep identities and disorder stable across WS updates, rerenders and sorting.
  const [items] = useState(() => buildPacketDeal(players, mySeat, gameId, laiziRanks));
  const [stage, setStage] = useState<'dealing' | 'sorting' | 'settled'>('dealing');
  const [packet, setPacket] = useState(0);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [handTargets, setHandTargets] = useState<Map<string, Point>>(new Map());
  const overlay = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const reduced = useReducedMotion();
  const ready = box.w > 0;
  const { sortAt, doneAt } = packetDealTimeline(items);

  useEffect(() => {
    const element = overlay.current;
    if (!element) return;
    const update = () => setBox({ w: element.clientWidth, h: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready) return;
    sound.deal();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let round = 0; round < 4; round++) {
      timers.push(setTimeout(() => setPacket(round), round * 3 * PACKET_DEAL.packetGap * 1000));
    }
    timers.push(setTimeout(() => {
      const element = overlay.current;
      if (element) setHandTargets(measureHandTargets(element));
      setStage('sorting'); sound.selectCard();
    }, sortAt * 1000));
    timers.push(setTimeout(() => setStage('settled'), (sortAt + PACKET_DEAL.sort) * 1000));
    timers.push(setTimeout(() => done.current(), doneAt * 1000));
    return () => timers.forEach(clearTimeout);
  }, [ready, sortAt, doneAt]);

  return <motion.div ref={overlay} className="ddz-packet-deal dph-dealing" data-stage={stage}
    style={{ backgroundImage: `linear-gradient(#34304d88,#34304d55),url(${dphAsset('backgrounds/courtyard.jpg')})` }}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .25 }}
    role="status" aria-label="不洗牌分批发牌动画">
    <div className="ddz-packet-heading"><small>THE CARDS ARE ON THEIR WAY</small>
      <h2>{stage === 'dealing' ? '好牌，分批登场' : stage === 'sorting' ? '理一理，好戏开场' : '手牌已就绪'}</h2>
      <p>{stage === 'dealing' ? `第 ${packet + 1} 轮 · 每人 ${PACKET_DEAL.batches[packet]} 张` : '按点数从大到小整理手牌'}</p>
    </div>
    <div className="ddz-packet-deck" aria-hidden="true">{[0, 1, 2].map(i => <div key={i} style={{ transform: `translate(${i * 3}px, ${-i * 3}px) rotate(${i * 3 - 3}deg)` }}><PlayingCard card={{ id: 'deck', suit: 'club', rank: 3 }} faceDown size="md" /></div>)}</div>
    {ready && items.map(item => {
      const mine = item.seat === mySeat;
      const relative = (item.seat - mySeat + 3) % 3;
      const count = items.filter(card => card.seat === item.seat).length;
      const width = mine ? 64 : 48;
      const step = mine ? Math.min(36, Math.max(12, (box.w * .72 - width) / Math.max(1, count - 1))) : Math.min(15, box.w * .18 / Math.max(1, count - 1));
      const centerX = mine ? 0 : (relative === 2 ? -.32 : .32) * box.w;
      const centerY = mine ? Math.min(box.h * .30, box.h / 2 - 110) : -box.h * .14;
      const landed = { x: centerX + (item.arrivalIndex - (count - 1) / 2) * step - width / 2,
        y: centerY + item.offsetY };
      const fallback = { x: centerX + (item.sortedIndex - (count - 1) / 2) * step - width / 2,
        y: mine ? box.h / 2 - 110 : centerY };
      const target = mine ? handTargets.get(item.card.id) ?? fallback : fallback;
      const sorting = stage !== 'dealing';
      return <motion.div key={`${item.seat}:${item.card.id}`} className="ddz-packet-card"
        data-seat={item.seat} data-packet={item.packet} data-card-key={item.card.id}
        style={{ zIndex: sorting ? 20 + item.sortedIndex : 20 + item.arrivalIndex }}
        initial={{ x: -width / 2, y: -45, rotate: 0, opacity: 0, scale: .72 }}
        animate={sorting ? { x: [landed.x, target.x, target.x], y: [landed.y, target.y - (reduced ? 0 : 28), target.y],
          rotate: [item.tilt, 0, 0], opacity: 1, scale: 1 } :
          { x: landed.x, y: landed.y, rotate: reduced ? 0 : item.tilt, opacity: [0, 1, 1], scale: 1 }}
        transition={sorting ? { duration: PACKET_DEAL.sort, ease: [.2, .7, .2, 1], times: [0, .6, 1] } :
          { duration: reduced ? .15 : PACKET_DEAL.flight, delay: item.delay, ease: [.2, .7, .2, 1] }}>
        <PlayingCard card={item.card} faceDown={!mine} size={mine ? 'md' : 'sm'} laiziRanks={laiziRanks} />
      </motion.div>;
    })}
    <span className="ddz-packet-seat seat-left">上家</span><span className="ddz-packet-seat seat-right">下家</span>
  </motion.div>;
}
