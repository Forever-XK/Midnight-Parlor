import { motion, useReducedMotion } from 'framer-motion';
import { heavyPlayTiming, type HeavyPlay } from '@/config/playAnimations';

/** A local table contact, in addition to the existing full effect. */
export default function HeavyPlayImpact({ type }: { type: HeavyPlay }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  const delay = heavyPlayTiming(type).impactMs / 1000;
  return <div className="ddz-heavy-contact" aria-hidden="true">
    <motion.div className="ddz-heavy-shock" initial={{ opacity: 0, scale: .25 }}
      animate={{ opacity: [0, .95, .5, 0], scale: [.25, .8, 1.2, 1.7] }} transition={{ delay, duration: .42 }} />
    {Array.from({ length: 8 }, (_, i) => {
      const angle = i * Math.PI * 2 / 8;
      return <motion.i key={i} className="ddz-heavy-chip"
        initial={{ opacity: 0, x: 0, y: 0 }}
        animate={{ opacity: [0, 1, 0], x: Math.cos(angle) * 100, y: Math.sin(angle) * 24 + 12, rotate: i * 43 }}
        transition={{ delay, duration: .4 }} />;
    })}
  </div>;
}
