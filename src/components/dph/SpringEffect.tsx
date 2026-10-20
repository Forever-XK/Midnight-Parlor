import { motion, useReducedMotion } from 'framer-motion';
import { dphAsset } from '@/config/dphTheme';

export { SPRING_EFFECT_MS } from '@/lib/roundPresentation';

export default function SpringEffect({ reverse = false }: { reverse?: boolean }) {
  const reduced = useReducedMotion();
  return <motion.div className="ddz-spring-effect fixed inset-0 z-[55] pointer-events-none" role="status" aria-label={reverse ? '反春，倍数乘2' : '春天，倍数乘2'}
    initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 2.4, times: [0, .12, .85, 1] }}>
    <motion.img className="ddz-spring-glow" src={dphAsset('effects/glow.png')} alt=""
      initial={{ scale: .3 }} animate={{ scale: reduced ? 1 : [ .3, 1.2, 1.5 ], rotate: reduced ? 0 : 30 }} transition={{ duration: 2.4 }} />
    {[0, 1].map(i => <motion.div key={i} className="ddz-spring-ring"
      initial={{ scale: .2, opacity: 0 }} animate={{ scale: reduced ? 1 : [ .2, 1.5 + i * .3 ], opacity: [0, .9, 0] }}
      transition={{ duration: 2, delay: i * .18 }} />)}
    {!reduced && Array.from({ length: 24 }, (_, i) => {
      const angle = i * Math.PI * 2 / 24;
      return <motion.span key={i} className="ddz-spring-petal" style={{ background: i % 3 === 0 ? '#ffd39e' : '#f4dce8' }}
        initial={{ x: 0, y: 0, opacity: 0, rotate: i * 27 }}
        animate={{ x: Math.cos(angle) * (170 + i % 4 * 35), y: Math.sin(angle) * 190 + 70, opacity: [0, 1, 0], rotate: i * 27 + 210 }}
        transition={{ duration: 2.1, delay: i % 4 * .06 }} />;
    })}
    <motion.div className="ddz-spring-title" initial={{ scale: .4, y: 20 }} animate={{ scale: reduced ? 1 : [ .4, 1.12, 1 ], y: 0 }} transition={{ duration: .6 }}>
      <span className="ddz-spring-flower">✿</span><strong>{reverse ? '反 春' : '春 天'}</strong>
      <small>{reverse ? '农民逆转 · 地主仅出一手' : '一气呵成 · 农民未出一牌'}</small>
      <motion.b initial={{ opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .55 }}>倍数 ×2</motion.b>
    </motion.div>
  </motion.div>;
}
