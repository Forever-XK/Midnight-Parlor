import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Card } from '@shared/types';
import { cardFlightPose, type CardBounds } from '@/lib/cardGeometry';
import { takeHandOrigin } from '@/lib/cardFlight';
import PlayingCard from './PlayingCard';
import { heavyCardMotion, heavyPlayTiming, type HeavyPlay } from '@/config/playAnimations';

interface Props {
  card: Card;
  effRank?: number;
  gameId: string;
  seat?: number;
  index: number;
  heavy?: HeavyPlay;
  count?: number;
  onFlightStart?: () => void;
}

export default function PlayedCard({ card, effRank, gameId, seat, index, heavy, count = 1, onFlightStart }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const source = useRef<CardBounds | undefined>();
  const [pose, setPose] = useState<ReturnType<typeof cardFlightPose> | null>(null);
  const reduced = useReducedMotion();
  const flightCallback = useRef(onFlightStart);
  flightCallback.current = onFlightStart;
  const announced = useRef(false);
  useLayoutEffect(() => {
    const target = element.current;
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    source.current ??= takeHandOrigin(gameId, card.id);
    // Other seats fly from their visible, face-down hand stacks. No private
    // opponent card data is needed to construct this starting position.
    const scope = target.closest('.personalization-stage') ?? target.closest('.dph-table') ?? document;
    const stack = seat == null ? null : scope.querySelector(`[data-seat-hand="${seat}"]`);
    if (!source.current && stack) {
      const from = stack.getBoundingClientRect();
      source.current = { left: from.left + (from.width - bounds.width) / 2,
        top: from.top + (from.height - bounds.height) / 2, width: bounds.width, height: bounds.height };
    }
    if (source.current) setPose(cardFlightPose(source.current, bounds, target.offsetWidth,
      document.body.classList.contains('ddz-rotated')));
    // The same layout commit starts the cards and their effect, before paint.
    // StrictMode and subsequent layout updates must not announce it twice.
    if (!announced.current) {
      announced.current = true;
      flightCallback.current?.();
    }
  }, [card.id, gameId, seat]);

  const fly = pose && !reduced;
  const slam = heavy && !reduced;
  const timing = heavy ? heavyPlayTiming(heavy) : null;
  return <motion.div ref={element} className={`relative shrink-0 ${heavy ? 'w-16 h-[90px] ddz-heavy-card' : 'w-12 h-[68px]'}`}
    style={heavy ? { transformPerspective: 700, zIndex: 20 + index } : undefined}
    data-played-card={card.id} data-flight-origin={pose ? 'hand' : 'fade'} data-heavy-play={heavy}
    initial={{ opacity: 0 }}
    animate={slam ? heavyCardMotion(pose ?? { x: 0, y: 70, scale: 1 }, heavy, index, count) : fly ? { x: [pose.x, pose.x * .88, 0], y: [pose.y, pose.y - 38, 0],
      scale: [pose.scale, pose.scale * 1.08, 1], rotate: [0, -4, 0], opacity: 1 } : { opacity: 1 }}
    transition={slam && timing ? { duration: timing.duration, times: timing.times, ease: ['easeOut', 'easeOut', 'easeInOut', 'easeIn', 'easeOut', 'easeOut'] }
      : fly ? { duration: .5, delay: Math.min(index * .018, .14), times: [0, .28, 1], ease: [.2, .65, .25, 1] } : { duration: .15 }}>
    <PlayingCard card={card} effRank={effRank} size={heavy ? 'md' : 'sm'} />
  </motion.div>;
}
