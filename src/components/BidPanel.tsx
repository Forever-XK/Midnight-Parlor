// 叫分面板组件
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';

export default function BidPanel() {
  const { state, mySeat, doBid, loading, isPlayingSnapshots } = useGameStore();
  const isLight = useThemeStore(s => s.theme === 'light');
  if (!state || state.phase !== 'bidding' || state.currentSeat !== mySeat) return null;

  const highest = state.bidState?.highestBid ?? 0;

  const buttons = [
    { bid: 0, label: '不叫', disabled: false },
    { bid: 1, label: '1分', disabled: highest >= 1 },
    { bid: 2, label: '2分', disabled: highest >= 2 },
    { bid: 3, label: '3分', disabled: highest >= 3 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3"
    >
      <div className={cn(
        'font-display text-lg',
        isLight ? 'text-white text-shadow-dark' : 'text-gold-300 text-shadow-gold',
      )}>
        {highest > 0 ? `当前最高 ${highest} 分，请叫分` : '请叫分'}
      </div>
      <div className="flex gap-3">
        {buttons.map((b) => (
          <button
            key={b.bid}
            disabled={b.disabled || loading || isPlayingSnapshots}
            onClick={() => doBid(b.bid)}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-display text-lg transition-all duration-200 border',
              b.bid === 0 ? (isLight
                ? 'bg-white/70 border-amber-700/30 text-amber-800 hover:bg-white/90'
                : 'bg-ink-600/40 border-gold-600/40 text-gold-400 hover:border-gold-500 hover:text-gold-300') :
              b.bid === 3 ? (
                'btn-red !py-2.5 !px-5 !text-base'
              ) : (
                'btn-gold !py-2.5 !px-5 !text-base'
              ),
              b.disabled && 'opacity-30 cursor-not-allowed',
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export function MenzhuaChoicePanel() {
  const { state, mySeat, doMenzhua, loading, isPlayingSnapshots } = useGameStore();
  const isLight = useThemeStore(s => s.theme === 'light');
  if (!state || state.phase !== 'menzhuaChoice' || state.currentSeat !== mySeat) return null;

  const disabled = loading || isPlayingSnapshots;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3"
    >
      <div className={cn(
        'font-display text-lg',
        isLight ? 'text-white text-shadow-dark' : 'text-gold-300 text-shadow-gold',
      )}>
        拿到明牌 · 优先叫牌权
      </div>
      <div className="flex gap-3">
        <button
          disabled={disabled}
          onClick={() => doMenzhua('menzhua')}
          className={cn(
            'btn-red !py-2.5 !px-5 !text-base',
            disabled && 'opacity-30 cursor-not-allowed',
          )}
        >
          闷抓 当地主 翻倍
        </button>
        <button
          disabled={disabled}
          onClick={() => doMenzhua('kanpai')}
          className={cn(
            'btn-gold !py-2.5 !px-5 !text-base',
            disabled && 'opacity-30 cursor-not-allowed',
          )}
        >
          看牌 再叫分
        </button>
      </div>
    </motion.div>
  );
}
