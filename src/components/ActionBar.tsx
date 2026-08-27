// 出牌操作栏组件
import { Lightbulb, Ban, Send } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

export default function ActionBar() {
  const { state, mySeat, selectedCards, doPlay, doPass, doHint, loading, isPlayingSnapshots } = useGameStore();

  if (!state || state.phase !== 'playing' || state.currentSeat !== mySeat) return null;

  const hasSelection = selectedCards.size > 0;
  const canPass = !!state.lastValidPlay; // 有上家牌才可不出
  // 无牌可压时，把「不出」替换为「要不起」
  const showYaoBuQi = canPass && state.hasValidPlay === false;
  const disabled = loading || isPlayingSnapshots;

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        disabled={!canPass || disabled}
        onClick={doPass}
        className={cn('btn-ghost', !canPass && 'opacity-30')}
      >
        <Ban className="w-5 h-5" />
        {showYaoBuQi ? '要不起' : '不出'}
      </button>
      <button
        disabled={disabled}
        onClick={doHint}
        className="btn-ghost"
      >
        <Lightbulb className="w-5 h-5" />
        提示
      </button>
      <button
        disabled={!hasSelection || disabled}
        onClick={doPlay}
        className="btn-gold"
      >
        <Send className="w-5 h-5" />
        出牌
      </button>
    </div>
  );
}
