// 抽取癞子动画 —— 从牌堆翻出一张牌揭示本局癞子点数
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '@/store/themeStore';
import { sound } from '@/lib/soundManager';
import { cn } from '@/lib/utils';

interface LaiziDrawAnimationProps {
  label: string; // '癞子' | '天癞' | '地癞'
  rank: number;  // 3~15
  onDone: () => void;
}

// 点数 → 显示文本（10 显示为 '10'，J/Q/K/A/2 专名）
function rankText(r: number): string {
  if (r === 11) return 'J';
  if (r === 12) return 'Q';
  if (r === 13) return 'K';
  if (r === 14) return 'A';
  if (r === 15) return '2';
  return String(r);
}

export default function LaiziDrawAnimation({ label, rank, onDone }: LaiziDrawAnimationProps) {
  const isLight = useThemeStore((s) => s.theme === 'light');
  const [exiting, setExiting] = useState(false);

  // 时间轴：淡入 → 牌浮起 → 翻牌 → 展示 → 淡出 → onDone
  // 注意：父组件（Game）会因联机轮询不断重渲染，onDone 内联引用随之变化；
  // 若将其列入依赖会反复重置计时器导致动画卡住，故用 ref 保存、仅初始化一次。
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | undefined;
    sound.double();
    const main = setTimeout(() => {
      setExiting(true);
      hide = setTimeout(() => onDoneRef.current(), 280);
    }, 2600);
    return () => {
      clearTimeout(main);
      if (hide) clearTimeout(hide);
    };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none felt-texture"
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: exiting ? 0.25 : 0.3 }}
    >
      {/* 顶部聚光灯 */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{
          background: isLight
            ? 'radial-gradient(ellipse at top, rgba(255,245,200,0.14), transparent 70%)'
            : 'radial-gradient(ellipse at top, rgba(255,235,180,0.10), transparent 70%)',
        }}
      />

      <div className="relative flex flex-col items-center gap-6">
        {/* 标签胶囊 */}
        <motion.div
          initial={{ opacity: 0, y: -14, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 1.0, duration: 0.35 }}
          className={cn(
            'px-4 py-1.5 rounded-full border font-display text-lg tracking-wide',
            isLight
              ? 'bg-vermilion-600/10 border-vermilion-500/40 text-vermilion-700'
              : 'bg-vermilion-600/20 border-vermilion-400/50 text-vermilion-300',
          )}
        >
          {label} · 本局癞子
        </motion.div>

        {/* 翻牌揭示 */}
        <div className="relative" style={{ perspective: 1000 }}>
          <motion.div
            className="relative"
            style={{ transformStyle: 'preserve-3d' }}
            initial={{ y: 70, scale: 0.5, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
          >
            <motion.div
              className="relative w-24 h-[136px]"
              style={{ transformStyle: 'preserve-3d' }}
              animate={{ rotateY: 180 }}
              transition={{ delay: 0.6, duration: 0.7, type: 'tween', ease: 'easeInOut' }}
            >
              {/* 背面（初始可见） */}
              <div
                className="absolute inset-0 rounded-xl border shadow-card flex items-center justify-center"
                style={{
                  backfaceVisibility: 'hidden',
                  background: isLight
                    ? 'linear-gradient(135deg, #b8860b 0%, #8b6914 40%, #6b4f0f 100%)'
                    : 'linear-gradient(135deg, #0f6048 0%, #0a4d3a 40%, #063326 100%)',
                  borderColor: isLight ? 'rgba(120,80,0,0.4)' : 'rgba(212,175,55,0.4)',
                }}
              >
                <div className="absolute inset-2 rounded-lg border border-white/10" />
                <span className={cn('text-lg font-card', isLight ? 'text-amber-200/30' : 'text-gold-500/30')}>♦</span>
              </div>

              {/* 正面（翻转后显示点数） */}
              <div
                className="absolute inset-0 rounded-xl border flex flex-col items-center justify-center"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: isLight
                    ? 'linear-gradient(180deg, #fffdf4 0%, #f8f4e8 100%)'
                    : 'linear-gradient(180deg, #fdfaf0 0%, #f8f4e8 100%)',
                  borderColor: isLight ? 'rgba(146,96,0,0.5)' : 'rgba(212,175,55,0.5)',
                }}
              >
                <span className={cn(
                  'font-card font-bold leading-none',
                  isLight ? 'text-vermilion-700' : 'text-vermilion-500',
                )} style={{ fontSize: '52px' }}>
                  {rankText(rank)}
                </span>
                <span className={cn('font-card mt-1', isLight ? 'text-vermilion-700/80' : 'text-vermilion-500/80')} style={{ fontSize: '18px' }}>
                  ♦
                </span>
                <span className={cn(
                  'absolute top-2 left-2 text-xs font-card px-1.5 py-0.5 rounded',
                  isLight ? 'bg-vermilion-600/10 text-vermilion-700' : 'bg-vermilion-600/20 text-vermilion-300',
                )}>
                  {label}
                </span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}