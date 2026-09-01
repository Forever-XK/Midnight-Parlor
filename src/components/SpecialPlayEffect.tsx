// 炸弹/王炸出牌特效 —— 全屏覆盖层动画（不阻挡操作，pointer-events-none）
// 触发时机与语音/爆炸音同拍（gameStore 逐快照应用 state，本组件监视新出现的特殊牌）
import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SpecialPlayEffectData {
  type: 'bomb' | 'rocket';
  key: string; // 去重用的牌唯一标识
}

interface SpecialPlayEffectProps {
  effect: SpecialPlayEffectData | null;
  onDone: () => void;
}

// ---------- 炸弹：全屏红闪 + 大字 + 冲击波环 + 碎片飞散 + 震屏 ----------
function BombBurst() {
  // 碎片粒子：固定随机参数（组件挂载即出，一次性动画）
  const shards = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      const dist = 150 + Math.random() * 130;
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: 5 + Math.random() * 7,
        rotate: Math.random() * 360,
        delay: 0.12 + Math.random() * 0.1,
        gold: i % 3 === 0,
      };
    }), []);

  return (
    <motion.div
      className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center"
      // 震屏：整个覆盖层抖动 = 全屏震动感
      initial={{ x: 0, y: 0 }}
      animate={{
        x: [0, -10, 9, -7, 5, -3, 2, 0],
        y: [0, 6, -5, 4, -3, 2, -1, 0],
      }}
      transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
      exit={{ opacity: 0 }}
    >
      {/* 全屏红闪 */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(200,16,46,0.55), rgba(120,10,30,0.25) 45%, transparent 75%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.35, 0.7, 0] }}
        transition={{ duration: 1.0, times: [0, 0.08, 0.3, 0.55, 1] }}
      />

      {/* 冲击波环 ×3 */}
      {[0, 0.12, 0.24].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-4"
          style={{
            width: 120,
            height: 120,
            borderColor: i === 0 ? 'rgba(212,175,55,0.9)' : 'rgba(200,16,46,0.7)',
            borderStyle: i === 2 ? 'dashed' : 'solid',
          }}
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 3.4, opacity: 0 }}
          transition={{ duration: 0.85, delay: 0.15 + delay, ease: 'easeOut' }}
        />
      ))}

      {/* 碎片飞散 */}
      {shards.map((s, i) => (
        <motion.div
          key={`shard-${i}`}
          className="absolute rounded-sm"
          style={{
            width: s.size,
            height: s.size,
            background: s.gold
              ? 'linear-gradient(135deg, #f5d76e, #d4af37)'
              : 'linear-gradient(135deg, #ff5566, #c8102e)',
            boxShadow: s.gold ? '0 0 8px rgba(212,175,55,0.8)' : '0 0 8px rgba(200,16,46,0.8)',
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: s.x, y: s.y, opacity: 0, rotate: s.rotate }}
          transition={{ duration: 0.75, delay: s.delay, ease: 'easeOut' }}
        />
      ))}

      {/* 「炸弹」大字 */}
      <motion.div
        className="relative font-display text-[120px] leading-none select-none"
        initial={{ scale: 2.6, opacity: 0, filter: 'blur(8px)' }}
        animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.05 }}
        exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.25 } }}
      >
        <span
          className="text-transparent bg-clip-text"
          style={{
            backgroundImage: 'linear-gradient(160deg, #ffe9a8 10%, #f5d76e 35%, #c8102e 75%, #8f0a20 100%)',
            WebkitTextStroke: '2px rgba(255,240,200,0.75)',
            filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.65)) drop-shadow(0 0 24px rgba(200,16,46,0.55))',
          }}
        >
          炸弹
        </span>
        {/* 背光 */}
        <motion.div
          className="absolute inset-0 -z-10 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(200,16,46,0.45), transparent 65%)' }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 1.8, 1.2], opacity: [0, 1, 0.6] }}
          transition={{ duration: 0.7 }}
        />
      </motion.div>
    </motion.div>
  );
}

// ---------- 王炸：火箭升空 + 尾焰粒子 + 顶部爆闪 + 「王炸」金字 ----------
function RocketLaunch() {
  // 尾焰粒子（在火箭上升过程中持续生成）
  const flames = useMemo(() =>
    Array.from({ length: 10 }, () => ({
      dx: -14 + Math.random() * 28,
      size: 6 + Math.random() * 8,
      delay: 0.25 + Math.random() * 1.0,
      dur: 0.45 + Math.random() * 0.25,
    })), []);

  return (
    <motion.div
      className="absolute inset-0 z-[60] pointer-events-none overflow-hidden"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      {/* 夜空底光 */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(13,27,42,0) 40%, rgba(212,175,55,0.10) 75%, rgba(212,175,55,0.22) 100%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />

      {/* 火箭本体：底部中央 → 顶部（bottom 百分比适配任意屏高/紧凑缩放画布） */}
      <motion.div
        className="absolute inset-x-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 1, 0] }}
        transition={{ duration: 1.35, times: [0, 0.1, 0.2, 0.85, 1] }}
      >
        <motion.div
          className="absolute left-1/2"
          style={{ bottom: '12%', x: '-50%' }}
          animate={{ bottom: ['12%', '14%', '86%'] }}
          transition={{ duration: 1.35, times: [0, 0.15, 1], ease: 'easeIn' }}
        >
        {/* 尾焰 */}
        <motion.div
          className="absolute left-1/2 rounded-full"
          style={{
            x: '-50%',
            bottom: -22,
            width: 18,
            height: 34,
            background: 'linear-gradient(to bottom, #fff3c4, #ffb347 45%, rgba(255,80,40,0) 95%)',
            filter: 'blur(2px)',
          }}
          animate={{ scaleY: [1, 1.5, 1.1, 1.6, 1], opacity: [0.9, 1, 0.85, 1, 0.9] }}
          transition={{ duration: 0.32, repeat: Infinity, repeatType: 'mirror' }}
        />
        {/* 火箭（简洁金身） */}
        <svg width="46" height="86" viewBox="0 0 46 86">
          <defs>
            <linearGradient id="rocketBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f8f4e8" />
              <stop offset="55%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#a8862a" />
            </linearGradient>
          </defs>
          {/* 尾翼 */}
          <path d="M6 62 L0 84 L12 76 Z" fill="#c8102e" />
          <path d="M40 62 L46 84 L34 76 Z" fill="#c8102e" />
          {/* 身体 */}
          <path d="M23 0 C33 16 37 34 37 52 L37 70 L9 70 L9 52 C9 34 13 16 23 0 Z" fill="url(#rocketBody)" stroke="#8f6d1f" strokeWidth="1.5" />
          {/* 舷窗 */}
          <circle cx="23" cy="30" r="7" fill="#0d1b2a" stroke="#ffe9a8" strokeWidth="2" />
          <circle cx="23" cy="30" r="3" fill="#63b3d1" opacity="0.85" />
          {/* 头尖光泽 */}
          <path d="M23 0 C27 6 30 12 31.5 18 L14.5 18 C16 12 19 6 23 0 Z" fill="#fffbe8" opacity="0.5" />
        </svg>
        {/* 尾焰散落粒子 */}
        {flames.map((f, i) => (
          <motion.div
            key={`flame-${i}`}
            className="absolute left-1/2 rounded-full"
            style={{
              bottom: -18,
              width: f.size,
              height: f.size,
              background: i % 2 === 0 ? '#ffb347' : '#ff6b3d',
              filter: 'blur(1px)',
            }}
            initial={{ x: 0, y: 0, opacity: 0 }}
            animate={{ x: f.dx, y: 46 + Math.random() * 30, opacity: [0, 1, 0], scale: [1, 0.4] }}
            transition={{ duration: f.dur, delay: f.delay, repeat: Infinity, repeatDelay: 0.05 }}
          />
        ))}
        </motion.div>
      </motion.div>

      {/* 顶部到达爆闪 */}
      <motion.div
        className="absolute left-1/2 top-[8%] rounded-full"
        style={{
          width: 260,
          height: 260,
          x: '-50%',
          y: '-50%',
          background: 'radial-gradient(circle, rgba(255,248,214,0.95), rgba(212,175,55,0.5) 40%, transparent 70%)',
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.6, 1.1], opacity: [0, 1, 0] }}
        transition={{ duration: 0.55, delay: 1.25, ease: 'easeOut' }}
      />
      {/* 爆闪射线 */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 8;
        return (
          <motion.div
            key={`ray-${i}`}
            className="absolute left-1/2 top-[8%]"
            style={{
              width: 110,
              height: 3,
              transformOrigin: 'left center',
              rotate: `${(a * 180) / Math.PI}deg`,
              background: 'linear-gradient(to right, rgba(255,240,180,0.95), transparent)',
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 0.9], opacity: [0, 1, 0] }}
            transition={{ duration: 0.5, delay: 1.28 }}
          />
        );
      })}

      {/* 「王炸」金字 */}
      <motion.div
        className="absolute left-1/2 top-1/2 font-display text-[130px] leading-none select-none"
        style={{ x: '-50%', y: '-50%' }}
        initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.35 }}
        exit={{ scale: 0.92, opacity: 0, transition: { duration: 0.3 } }}
      >
        <span
          className="text-transparent bg-clip-text"
          style={{
            backgroundImage: 'linear-gradient(165deg, #fffbe8 5%, #ffe9a8 30%, #d4af37 60%, #9c7a24 100%)',
            WebkitTextStroke: '2px rgba(255,250,220,0.8)',
            filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.7)) drop-shadow(0 0 28px rgba(212,175,55,0.6))',
          }}
        >
          王炸
        </span>
      </motion.div>
    </motion.div>
  );
}

// ---------- 入口：动画播完自动收场 ----------
export default function SpecialPlayEffect({ effect, onDone }: SpecialPlayEffectProps) {
  // 动画总时长后收场（炸弹 ~1.3s，王炸 ~2.0s）
  useEffect(() => {
    if (!effect) return;
    const duration = effect.type === 'bomb' ? 1300 : 2000;
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [effect, onDone]);

  return (
    <AnimatePresence>
      {effect && (
        <motion.div
          key={effect.key}
          className="fixed inset-0 z-[55] pointer-events-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
        >
          {effect.type === 'bomb' ? <BombBurst /> : <RocketLaunch />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
