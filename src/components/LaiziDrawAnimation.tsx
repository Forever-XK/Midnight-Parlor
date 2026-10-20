// Three full revolutions on the card back, then a final half-turn reveals the wild card.
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { Rank } from '@shared/types';
import { sound } from '@/lib/soundManager';
import { dphAsset } from '@/config/dphTheme';
import { LAIZI_DRAW } from '@/config/dealAnimations';
import PlayingCard from './PlayingCard';

interface LaiziDrawAnimationProps {
  label: string;
  rank: number;
  onDone: () => void;
}
const rankText = (rank: number) => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' }[rank] ?? String(rank));

export default function LaiziDrawAnimation({ label, rank, onDone }: LaiziDrawAnimationProps) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<'spinning' | 'revealed' | 'exiting'>('spinning');
  const done = useRef(onDone);
  done.current = onDone;
  const revealAt = LAIZI_DRAW.enter + (reduced ? .35 : LAIZI_DRAW.spin);
  const exitAt = revealAt + LAIZI_DRAW.flip + LAIZI_DRAW.hold;
  const card = { id: `wild-draw-${label}-${rank}`, suit: 'diamond' as const, rank: rank as Rank };

  useEffect(() => {
    const reveal = setTimeout(() => { setPhase('revealed'); sound.double(); }, revealAt * 1000);
    const exit = setTimeout(() => setPhase('exiting'), exitAt * 1000);
    const finish = setTimeout(() => done.current(), (exitAt + LAIZI_DRAW.exit) * 1000);
    return () => { clearTimeout(reveal); clearTimeout(exit); clearTimeout(finish); };
  }, [revealAt, exitAt]);

  const revealed = phase !== 'spinning';
  return <motion.div className="ddz-wild-draw" data-phase={phase}
    initial={{ opacity: 0 }} animate={{ opacity: phase === 'exiting' ? 0 : 1 }}
    transition={{ duration: LAIZI_DRAW.exit }} role="status" aria-label={`${label}抽取动画`}>
    <div className="ddz-wild-vignette" />
    <div className="ddz-wild-stage">
      <motion.div className="ddz-wild-aura" initial={{ opacity: .2, scale: .7 }}
        animate={{ opacity: revealed ? .9 : .4, scale: revealed ? 1.35 : 1 }} transition={{ duration: .65 }} />
      <div className="ddz-wild-orbit orbit-one" /><div className="ddz-wild-orbit orbit-two" />
      <motion.div className="ddz-wild-beams" initial={{ opacity: 0, scale: .2, rotate: -25 }}
        animate={revealed ? { opacity: [0, .85, .2], scale: [ .2, 1.15, 1.3 ], rotate: 15 } : { opacity: 0 }} transition={{ duration: 1.2 }} />
      {revealed && !reduced && Array.from({ length: 20 }, (_, i) => {
        const angle = i * Math.PI * 2 / 20;
        const radius = 150 + (i % 4) * 26;
        return <motion.img key={i} src={dphAsset('effects/spark.png')} alt="" className="ddz-wild-spark"
          initial={{ x: 0, y: 0, opacity: 0, scale: .2 }}
          animate={{ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, opacity: [0, 1, 0], scale: [ .2, 1, .3 ], rotate: i * 47 }}
          transition={{ duration: 1.2, delay: .15 + (i % 3) * .05, ease: 'easeOut' }} />;
      })}
      <motion.div className="ddz-wild-shockwave" key={revealed ? 'burst' : 'waiting'}
        initial={{ opacity: 0, scale: .3 }} animate={revealed ? { opacity: [0, .8, 0], scale: [ .3, 1.4, 1.8 ] } : { opacity: 0 }} transition={{ duration: 1 }} />
      <motion.div className="ddz-wild-card-enter" initial={{ y: 45, scale: .65, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ duration: LAIZI_DRAW.enter }}>
        <motion.div className="ddz-wild-card-spin" style={{ transformStyle: 'preserve-3d' }}
          initial={{ rotateY: 0, rotateZ: -8 }}
          animate={revealed ? { rotateY: reduced ? 180 : LAIZI_DRAW.turns * 360 + 180, rotateZ: 0 } :
            { rotateY: reduced ? 0 : Array.from({ length: LAIZI_DRAW.turns + 1 }, (_, i) => i * 360), rotateZ: reduced ? 0 : [-8, 5, -5, 0] }}
          transition={revealed ? { duration: LAIZI_DRAW.flip, ease: [.2, .7, .2, 1] } :
            { delay: LAIZI_DRAW.enter, duration: reduced ? .35 : LAIZI_DRAW.spin, ease: 'easeInOut' }}>
          <div className="ddz-wild-card-side"><div className="ddz-wild-card-content"><PlayingCard card={card} faceDown size="lg" /></div></div>
          <div className="ddz-wild-card-side ddz-wild-card-front">
            <div className="ddz-wild-card-content"><PlayingCard card={card} faceDown={!revealed} size="lg" /></div>
            {revealed && <span className="ddz-wild-card-badge">{label}</span>}
          </div>
        </motion.div>
      </motion.div>
      <motion.div className="ddz-wild-caption" initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}>
        <small>{revealed ? 'WILD CARD REVEALED' : 'A LITTLE MAGIC'}</small>
        <h2>{revealed ? `${label} · ${rankText(rank)}` : '好运，正在转动'}</h2>
        <p aria-live="polite">{revealed ? '本局此点数可作为癞子使用' : '即将揭晓本局的百搭好牌'}</p>
      </motion.div>
    </div>
  </motion.div>;
}
