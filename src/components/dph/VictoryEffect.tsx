import { motion, useReducedMotion } from 'framer-motion';
import { Crown, Sprout } from 'lucide-react';
import { VICTORY_EFFECT_MS } from '@/lib/roundPresentation';

/** Local celebration, with the same footprint and intensity as combo effects. */
export default function VictoryEffect({ winner }: { winner: 'landlord' | 'peasant' }) {
  const reduced = useReducedMotion();
  const landlord = winner === 'landlord';
  return <motion.div className={`ddz-victory-effect ${landlord ? 'victory-landlord' : 'victory-peasant'}`}
    role="status" aria-label={landlord ? '地主获胜' : '农民获胜'}
    initial={{ opacity: 0, scale: reduced ? 1 : .85, y: reduced ? 0 : 12 }}
    animate={{ opacity: [0, 1, 1, 0], scale: reduced ? 1 : [.85, 1.04, 1, 1], y: 0 }}
    transition={{ duration: VICTORY_EFFECT_MS / 1000, times: [0, .18, .8, 1] }}>
    <div className="ddz-victory-emblem">{landlord ? <Crown size={52} /> : <><Sprout size={44} /><Sprout size={44} /></>}</div>
    {!reduced && Array.from({ length: 6 }, (_, i) => <motion.span className="ddz-victory-spark" key={i}
      style={{ left: `${16 + i * 13}%`, top: `${25 + i % 2 * 40}%` }}
      initial={{ opacity: 0, scale: .4 }} animate={{ opacity: [0, .9, 0], scale: [.4, 1.1, .7], y: -15 }}
      transition={{ duration: .9, delay: i * .04 }}>✦</motion.span>)}
    <strong>{landlord ? '地主获胜' : '农民获胜'}</strong><small>{landlord ? 'LANDLORD WINS' : 'TEAM VICTORY'}</small>
  </motion.div>;
}
