// 单个座位的出牌展示区 —— 显示在对应玩家面前
import { motion, AnimatePresence } from 'framer-motion';
import type { Card, Play } from '@shared/types';
import PlayingCard from './PlayingCard';
import { sortCardsDesc } from '@/lib/cards';
import PlayedCard from './PlayedCard';
import HeavyPlayImpact from './dph/HeavyPlayImpact';
import { PLAY_TYPE_NAME } from '@/lib/playTypes';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/themeStore';

interface SeatPlayAreaProps {
  gameId: string;
  seat?: number;
  play: Play | null;        // 该座位最近一次出的实际牌（不含 pass）
  isPassing: boolean;       // 该座位最近动作是否为"不出"
  position: 'top' | 'bottom'; // 出牌区位置：top=AI前方，bottom=玩家上方
  onPlayStart?: (play: Play, seat?: number) => void;
  suspended?: boolean; // 发牌/叫分时不挂载出牌动画，也不消耗首手特效。
  bidResult?: number;
  remainingHand?: Card[];
  laiziRanks?: number[];
}

export default function SeatPlayArea({ play, isPassing, position, gameId, seat, onPlayStart, suspended = false, bidResult, remainingHand, laiziRanks }: SeatPlayAreaProps) {
  const isLight = useThemeStore((s) => s.theme === 'light');
  if (bidResult != null) return <div data-play-area-seat={seat} className="flex items-center justify-center min-h-[72px]">
    <motion.div key={`${gameId}:${seat}:${bidResult}`} className={`ddz-bid-result ${bidResult === 0 ? 'ddz-bid-pass' : ''}`}
      data-bid-result={bidResult} role="status" aria-label={`叫分结果：${bidResult === 0 ? '不叫' : `${bidResult}分`}`}
      initial={{ opacity: 0, y: 12, scale: .8 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 21 }}>
      {bidResult === 0 ? '不叫' : <><strong>{bidResult}</strong><span>分</span></>}
    </motion.div>
  </div>;
  if (suspended) return <div data-play-area-seat={seat} className="min-h-[72px]" />;
  const hasCards = play && play.cards.length > 0;
  const heavy = play?.type === 'bomb' || play?.type === 'rocket' ? play.type : undefined;
  if (remainingHand?.length) {
    const hand = sortCardsDesc(remainingHand, laiziRanks);
    const rows = Array.from({ length: Math.ceil(hand.length / 10) }, (_, row) => hand.slice(row * 10, row * 10 + 10));
    return <motion.div className="ddz-seat-remaining" data-remaining-seat={seat} role="status" aria-label={`剩余手牌 ${hand.length} 张`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>
      <small>剩余 {hand.length} 张</small>
      {rows.map((cards, row) => {
        const step = cards.length < 2 ? 48 : Math.min(50, (280 - 48) / (cards.length - 1));
        return <div key={row} className="ddz-seat-remaining-row" style={{ width: 48 + (cards.length - 1) * step }}>
          {cards.map((card, index) => <motion.div key={card.id} data-remaining-card={card.id} style={{ position: 'absolute', left: index * step, zIndex: index }}
            initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }}
            transition={{ duration: .22, delay: (row * 10 + index) * .022 }}>
            <PlayingCard card={card} size="sm" laiziRanks={laiziRanks} />
          </motion.div>)}
        </div>;
      })}
    </motion.div>;
  }
  return (
    <div data-play-area-seat={seat} className={cn(
      'flex items-center justify-center min-h-[72px]',
      position === 'top' ? 'pt-1' : 'pb-1',
    )}>
      <AnimatePresence mode="popLayout">
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
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="flex flex-col items-center gap-0.5"
          >
            <div className={`flex gap-0.5 items-center ${heavy ? 'ddz-heavy-play-row' : ''}`}>
              {heavy && <HeavyPlayImpact type={heavy} />}
              {(() => {
                // 癞子牌按实际充当的点数排序展示（癞4充当9时排在9的位置）
                const assign = play!.laiziAssign;
                const sorted = [...play!.cards].sort((a, b) =>
                  ((assign?.[b.id] ?? b.rank) - (assign?.[a.id] ?? a.rank)) || a.suit.localeCompare(b.suit));
                return sorted.map((card, index) => (
                  <PlayedCard key={card.id} card={card} effRank={assign?.[card.id]} gameId={gameId} seat={seat} index={index}
                    heavy={heavy} count={sorted.length}
                    onFlightStart={index === 0 ? () => onPlayStart?.(play!, seat) : undefined} />
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
