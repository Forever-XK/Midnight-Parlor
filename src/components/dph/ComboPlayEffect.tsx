import { motion, useReducedMotion } from 'framer-motion';
import { Plane } from 'lucide-react';
import { COMBO_EFFECT_MS } from '@/lib/playEffects';

type Combo = keyof typeof COMBO_EFFECT_MS;
const labels = { straight: ['顺子', 'STRAIGHT'], pair_straight: ['连对', 'PAIRS'], airplane: ['飞机', 'AIRPLANE'] };

/** A readable local flourish, still below bomb/rocket intensity. */
export default function ComboPlayEffect({ type }: { type: Combo }) {
  const reduced = useReducedMotion();
  const duration = COMBO_EFFECT_MS[type] / 1000;
  return <motion.div className={`ddz-combo-effect combo-${type}`} aria-hidden="true"
    initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : .9 }}
    animate={{ opacity: [0, 1, 1, 0], y: 0, scale: reduced ? 1 : [.9, 1.03, 1, 1] }}
    transition={{ duration, times: [0, .14, .8, 1] }}>
    <div className="ddz-combo-art">
      {type === 'airplane' ? <>
        <motion.span className="ddz-plane-trail" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: duration * .7 }} />
        <motion.div className="ddz-combo-plane" initial={{ x: reduced ? 0 : -135, y: reduced ? 0 : 15 }} animate={{ x: reduced ? 0 : 135, y: reduced ? 0 : -22 }} transition={{ duration, ease: 'easeInOut' }}><Plane size={64} strokeWidth={2} /></motion.div>
      </> : Array.from({ length: type === 'straight' ? 6 : 8 }, (_, i) => <motion.span key={i} className="ddz-combo-card"
        initial={{ opacity: 0, y: reduced ? 0 : 15, rotate: reduced ? 0 : -12 }}
        animate={{ opacity: 1, y: 0, rotate: reduced ? 0 : (i - (type === 'straight' ? 2.5 : 3.5)) * 4 }}
        transition={{ delay: i * .035, duration: .22 }}
        style={{ marginLeft: type === 'pair_straight' && i % 2 === 1 ? -11 : 5 }}>{type === 'straight' ? ['3', '4', '5', '6', '7', '8'][i] : ['6', '6', '7', '7', '8', '8', '9', '9'][i]}</motion.span>)}
    </div>
    <div className="ddz-combo-label">{labels[type][0]}<small>{labels[type][1]}</small></div>
  </motion.div>;
}
