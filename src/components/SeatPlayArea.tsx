// 单个座位的出牌展示区 —— 显示在对应玩家面前
import { motion, AnimatePresence } from 'framer-motion';
import type { Play } from '@shared/types';
import PlayingCard from './PlayingCard';
import { PLAY_TYPE_NAME } from '@/lib/playTypes';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/themeStore';

interface SeatPlayAreaProps {
  play: Play | null;        // 该座位最近一次出的实际牌（不含 pass）
  isPassing: boolean;       // 该座位最近动作是否为"不出"
  position: 'top' | 'bottom'; // 出牌区位置：top=AI前方，bottom=玩家上方
}

export default function SeatPlayArea({ play, isPassing, position }: SeatPlayAreaProps) {
  const isLight = useThemeStore((s) => s.theme === 'light');
  const hasCards = play && play.cards.length > 0;
  return (
    <div className={cn(
      'flex items-center justify-center min-h-[72px]',
      position === 'top' ? 'pt-1' : 'pb-1',
    )}>
      <AnimatePresence mode="wait">
        {isPassing ? (
          // 不出气泡
          <motion.div
            key="pass"
            initial={{ opacity: 0, scale: 0.7, y: position === 'top' ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={cn(
              "px-3 py-1 rounded-lg border",
              isLight
                ? 'bg-red-100/80 border-red-400/60 shadow-md'
                : 'bg-vermilion-600/25 border-vermilion-500/50 shadow-card'
            )}
          >
            <span className={cn(
              "font-main text-base",
              isLight ? 'text-red-700' : 'text-vermilion-300'
            )}>
              不出
            </span>
          </motion.div>
        ) : hasCards ? (
          // 出牌展示
          <motion.div
            key={`play-${play!.cards.map((c) => c.id).join(',')}`}
            initial={{ opacity: 0, scale: 0.85, y: position === 'top' ? 12 : -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="flex gap-0.5 items-center">
              {(() => {
                // 癞子牌按实际充当的点数排序展示（癞4充当9时排在9的位置）
                const assign = play!.laiziAssign;
                const sorted = [...play!.cards].sort((a, b) =>
                  ((assign?.[b.id] ?? b.rank) - (assign?.[a.id] ?? a.rank)) || a.suit.localeCompare(b.suit));
                return sorted.map((card) => (
                  <PlayingCard key={card.id} card={card} size="sm" effRank={assign?.[card.id]} />
                ));
              })()}
            </div>
            <span className={cn(
              "text-[10px] font-main",
              isLight ? 'text-amber-700/70' : 'text-gold-400/60'
            )}>
              {PLAY_TYPE_NAME[play!.type] || ''}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
