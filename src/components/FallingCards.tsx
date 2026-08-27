// 飘落卡牌背景动画
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';

const SUITS = ['♠', '♥', '♣', '♦'];
const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

interface FloatCard {
  id: number;
  left: number;
  delay: number;
  duration: number;
  suit: string;
  rank: string;
  red: boolean;
  size: number;
  rotate: number;
}

export default function FallingCards({ count = 12 }: { count?: number }) {
  const isLight = useThemeStore((s) => s.theme === 'light');
  const cards = useMemo<FloatCard[]>(() => {
    return Array.from({ length: count }).map((_, i) => {
      const suit = SUITS[i % 4];
      const rank = RANKS[i % RANKS.length];
      return {
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 12 + Math.random() * 10,
        suit,
        rank,
        red: suit === '♥' || suit === '♦',
        size: 28 + Math.random() * 24,
        rotate: Math.random() * 60 - 30,
      };
    });
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {cards.map((c) => (
        <motion.div
          key={c.id}
          initial={{ y: -120, x: 0, opacity: 0, rotate: c.rotate }}
          animate={{
            y: '110vh',
            x: [0, 30, -20, 10, 0],
            opacity: [0, isLight ? 0.12 : 0.15, isLight ? 0.12 : 0.15, isLight ? 0.08 : 0.1, 0],
            rotate: [c.rotate, c.rotate + 40, c.rotate - 20, c.rotate + 60],
          }}
          transition={{
            duration: c.duration,
            delay: c.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
          style={{
            position: 'absolute',
            left: `${c.left}%`,
            width: c.size,
            height: c.size * 1.4,
          }}
        >
          <div
            className={cn(
              "w-full h-full rounded-lg border flex flex-col items-center justify-center",
              isLight ? 'bg-white/60 border-amber-300/30' : ''
            )}
            style={!isLight ? {
              background: 'rgba(248,244,232,0.06)',
              borderColor: 'rgba(212,175,55,0.15)',
              backdropFilter: 'blur(2px)',
            } : { backdropFilter: 'blur(2px)' }}
          >
            <span
              className="font-bold text-sm"
              style={{
                color: isLight
                  ? (c.red ? 'rgba(185,28,28,0.4)' : 'rgba(60,60,60,0.3)')
                  : (c.red ? 'rgba(200,16,46,0.4)' : 'rgba(248,244,232,0.3)')
              }}
            >
              {c.rank}
            </span>
            <span
              className="text-base"
              style={{
                color: isLight
                  ? (c.red ? 'rgba(185,28,28,0.4)' : 'rgba(60,60,60,0.3)')
                  : (c.red ? 'rgba(200,16,46,0.4)' : 'rgba(248,244,232,0.3)')
              }}
            >
              {c.suit}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
