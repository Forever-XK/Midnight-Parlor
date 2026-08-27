// 记牌器：显示除玩家手牌外，场上各点数剩余张数
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/themeStore';

// 点数列表：从大到小（大王→小王→2→A→K→...→3）
const RANKS = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3];

function rankLabel(rank: number): string {
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  if (rank === 15) return '2';
  if (rank >= 16) return '王';
  return String(rank);
}

interface CardCounterProps {
  remaining: number[]; // index 0..14 ↔ rank 17..3（从大到小）
  laiziRanks?: number[];
}

export default function CardCounter({ remaining, laiziRanks }: CardCounterProps) {
  const isLight = useThemeStore(s => s.theme === 'light');
  const laiziSet = new Set(laiziRanks ?? []);

  return (
    <div className={cn(
      'flex items-center gap-1 rounded-lg backdrop-blur-sm border px-2.5 py-1.5 shadow-card',
      isLight
        ? 'bg-white/80 border-amber-700/20'
        : 'bg-ink-800/70 border-gold-600/30',
    )}>
      {RANKS.map((rank, i) => {
        const isBigJoker = rank === 17;
        const isJoker = rank >= 16;
        const isLaizi = laiziSet.has(rank);
        const count = remaining[i] ?? 0;
        return (
          <div key={rank} className="flex flex-col items-center gap-0.5 min-w-[15px]">
            <span
              className={cn(
                'text-[9px] leading-none font-jpq',
                isLaizi ? (isLight ? 'text-red-600' : 'text-gold-300') :
                isBigJoker ? (isLight ? 'text-red-600' : 'text-vermilion-400') :
                isJoker ? (isLight ? 'text-gray-500' : 'text-ivory/60') :
                (isLight ? 'text-amber-900/70' : 'text-ivory/70'),
              )}
            >
              {rankLabel(rank)}
            </span>
            <span
              className={cn(
                'font-jpq text-sm leading-none',
                isLaizi ? (isLight ? 'text-red-500' : 'text-vermilion-300') :
                count === 4 ? (isLight ? 'text-red-600 font-bold' : 'text-vermilion-400 font-bold') :
                (isLight ? 'text-amber-800' : 'text-gold-300'),
              )}
            >
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
