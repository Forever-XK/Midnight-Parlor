// 癞子多解牌型选择栏：当选牌可构成多种牌型时，让玩家自由选择要打出的牌型
import { Layers } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { useThemeStore } from '@/store/themeStore';
import { PLAY_TYPE_NAME } from '@/lib/playTypes';
import { cn } from '@/lib/utils';

// 牌型主点数显示（10 直接显示 10，其余用 A/2/王等）
const RANK_DISPLAY: Record<number, string> = { 14: 'A', 15: '2' };

function choiceLabel(type: string, mainRank: number, length: number): string {
  const name = PLAY_TYPE_NAME[type] ?? type;
  if (type === 'rocket') return name;
  const rank = RANK_DISPLAY[mainRank] ?? String(mainRank);
  // 炸弹显示张数（天地癞子模式 5+ 张炸弹）
  if (type === 'bomb' && length > 4) return `${name}·${rank}（${length}张）`;
  return `${name}·${rank}`;
}

export default function PlayChoiceBar() {
  const { playChoices, chosenPlayIdx, choosePlay, selectedCards } = useGameStore();
  const isLight = useThemeStore((st) => st.theme === 'light');

  // 仅当选牌有多个合法解时显示
  if (selectedCards.size === 0 || playChoices.length <= 1) return null;

  return (
    <div className={cn(
      'flex items-center justify-center gap-2 flex-wrap px-3 py-2 rounded-xl border',
      isLight
        ? 'bg-white/60 border-amber-700/20'
        : 'bg-ink-700/50 border-gold-600/30',
    )}>
      <span className={cn(
        'flex items-center gap-1 text-xs font-main shrink-0',
        isLight ? 'text-amber-800/60' : 'text-gold-500/70',
      )}>
        <Layers className="w-3.5 h-3.5" />
        选择牌型
      </span>
      {playChoices.map((p, idx) => (
        <button
          key={`${p.type}-${p.mainRank}-${p.length}`}
          disabled={!p.beats}
          onClick={() => choosePlay(idx)}
          title={p.beats ? undefined : '压不过上家牌'}
          className={cn(
            'px-3 py-1 rounded-lg text-sm font-main border transition-all duration-200',
            idx === chosenPlayIdx
              ? (isLight
                ? 'bg-amber-500 text-white border-amber-500 shadow-[0_0_10px_rgba(180,130,20,0.4)]'
                : 'bg-gold-500 text-ink-900 border-gold-400 shadow-gold-glow')
              : p.beats
                ? (isLight
                  ? 'bg-white/70 text-amber-900/70 border-amber-700/20 hover:border-amber-600/50'
                  : 'bg-ink-600/50 text-ivory/70 border-gold-600/30 hover:border-gold-500/50')
                : (isLight
                  ? 'bg-white/40 text-amber-900/30 border-amber-700/10 line-through cursor-not-allowed'
                  : 'bg-ink-600/30 text-ivory/25 border-gold-600/10 line-through cursor-not-allowed'),
          )}
        >
          {choiceLabel(p.type, p.mainRank, p.length)}
          {p.isLaiziBomb && <span className="ml-1 text-[10px] opacity-70">癞</span>}
        </button>
      ))}
    </div>
  );
}
