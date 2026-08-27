// 扑克牌组件 — 午夜雅集象牙白+金描边风格
import { motion } from 'framer-motion';
import type { Card } from '@shared/types';
import { getCardLabel, getSuitLabel, isRedCard, isJoker, RANK_TEXT } from '@/lib/cards';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/themeStore';
import { useCardStyleStore } from '@/store/cardStyleStore';

interface PlayingCardProps {
  card: Card;
  /** 癞子牌实际充当的点数（出牌展示用）：显示为该点数，左下角标注本体癞子点数 */
  effRank?: number;
  selected?: boolean;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
  laiziRanks?: number[];
}

// 尺寸映射 — 宽高比接近真实扑克 (≈0.71)
const SIZE_MAP = {
  sm: {
    w: 'w-12', h: 'h-[68px]',
    corner: 'text-sm leading-none',
    cornerSuit: 'text-[10px] leading-none mt-0.5',
    bigSuit: 'text-3xl',
    ringBox: 'w-8 h-8',
    ringSuit: 'text-lg',
    watermark: 'text-5xl',
    rankChar: 'text-3xl',
    rankChar10: 'text-xl',
    funEmoji: 'text-3xl',
    jokerText: 'text-[8px] leading-[9px]',
    jokerEmoji: 'text-2xl',
    radius: 'rounded-lg',
  },
  md: {
    w: 'w-16', h: 'h-[90px]',
    corner: 'text-lg leading-none',
    cornerSuit: 'text-sm leading-none mt-0.5',
    bigSuit: 'text-5xl',
    ringBox: 'w-10 h-10',
    ringSuit: 'text-2xl',
    watermark: 'text-7xl',
    rankChar: 'text-5xl',
    rankChar10: 'text-3xl',
    funEmoji: 'text-5xl',
    jokerText: 'text-[10px] leading-[11px]',
    jokerEmoji: 'text-4xl',
    radius: 'rounded-xl',
  },
  lg: {
    w: 'w-20', h: 'h-[114px]',
    corner: 'text-2xl leading-none',
    cornerSuit: 'text-lg leading-none mt-1',
    bigSuit: 'text-6xl',
    ringBox: 'w-12 h-12',
    ringSuit: 'text-3xl',
    watermark: 'text-8xl',
    rankChar: 'text-6xl',
    rankChar10: 'text-4xl',
    funEmoji: 'text-6xl',
    jokerText: 'text-xs leading-[13px]',
    jokerEmoji: 'text-5xl',
    radius: 'rounded-xl',
  },
};

// 趣味人物：花色 → 人物 emoji 映射
const FUN_SUIT_EMOJI: Record<string, string> = {
  spade: '⛹️‍♂️',   // 黑桃
  heart: '🏋️‍♀️',   // 红桃
  club: '🤾‍♂️',    // 梅花
  diamond: '🏌️‍♀️',  // 方片
};

export default function PlayingCard({
  card, selected, faceDown, size = 'md', onClick, className, laiziRanks, effRank,
}: PlayingCardProps) {
  const s = SIZE_MAP[size];
  const isLight = useThemeStore((st) => st.theme === 'light');
  const face = useCardStyleStore((st) => st.face);

  // 背面
  if (faceDown) {
    return (
      <div
        className={cn(
          s.w, s.h, s.radius,
          'border shadow-card select-none overflow-hidden',
          isLight ? 'border-amber-700/40' : 'border-gold-600/40',
          className,
        )}
        style={{
          background: isLight
            ? 'linear-gradient(135deg, #b8860b 0%, #8b6914 40%, #6b4f0f 100%)'
            : 'linear-gradient(135deg, #0f6048 0%, #0a4d3a 40%, #063326 100%)',
        }}
      >
        {/* 背面菱形图案 */}
        <div className="w-full h-full flex items-center justify-center relative">
          <div className={cn(
            'absolute inset-2 rounded-md border',
            isLight ? 'border-amber-300/20' : 'border-gold-500/20',
          )} />
          <span className={cn(
            'text-lg font-card',
            isLight ? 'text-amber-200/30' : 'text-gold-500/30',
          )}>♦</span>
        </div>
      </div>
    );
  }

  const red = isRedCard(card);
  const isLaizi = laiziRanks != null && laiziRanks.includes(card.rank);
  // 癞子牌充当其他点数（出牌展示）：牌面显示充当点数，左下角标注本体癞子点数
  const converted = effRank != null && effRank !== card.rank;
  const rankLabel = converted ? (RANK_TEXT[effRank] ?? '?') : getCardLabel(card);

  // 颜色：深色模式用墨黑/朱红，浅色模式用深棕/深红
  const rankColor = red
    ? (isLight ? 'text-red-700' : 'text-vermilion-500')
    : (isLight ? 'text-amber-950' : 'text-ink-800');

  return (
    <motion.div
      onClick={onClick}
      animate={{ y: selected ? -18 : 0 }}
      whileHover={onClick ? { y: selected ? -26 : -8, scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
      className={cn(
        s.w, s.h, s.radius,
        'relative select-none cursor-pointer overflow-hidden font-card',
        'border',
        // 背景与边框
        isLight
          ? 'bg-gradient-to-b from-amber-50 to-amber-100/80 border-amber-400/60 shadow-md'
          : 'border-gold-600/40 shadow-card',
        // 选中效果
        selected && (isLight
          ? 'ring-2 ring-amber-500 shadow-lg -translate-y-0.5 border-amber-500'
          : 'ring-2 ring-gold-400 shadow-gold-glow -translate-y-0.5 border-gold-400'),
        // 癞子标记（手牌中的癞子 / 出牌中充当其他点数的癞子）
        (isLaizi || converted) && (isLight ? 'ring-2 ring-red-500 border-red-500' : 'ring-2 ring-vermilion-400 border-vermilion-400'),
        className,
      )}
      style={!isLight ? { background: 'linear-gradient(180deg, #fdfaf0 0%, #f8f4e8 100%)' } : {}}
    >

      {isJoker(card) ? (
// ===== 大小王 =====
<>
  {/* 左上角：竖写 JOKER（JPQ字体） */}
  <div className={cn(
    'absolute top-1 left-1 flex flex-col items-center leading-none font-jpq',
    s.jokerText,
    card.rank === 17
      ? (isLight ? 'text-red-700' : 'text-vermilion-500')
      : (isLight ? 'text-amber-950' : 'text-ink-800'),
  )}>
    {'JOKER'.split('').map((ch, idx) => (
      <span key={idx} className="font-bold">{ch}</span>
    ))}
  </div>

  {/* 右下角：Joker 图案（趣味人物风格用 🕺/💃，其他风格用 ♚/♛） */}
  <div
    className="absolute flex items-end justify-end pointer-events-none"
    style={{ right: '2px', bottom: '2px' }}
  >
    <span className={cn(
      s.jokerEmoji,
      face === 'fun' ? '' : (
        card.rank === 17
          ? (isLight ? 'text-red-700' : 'text-vermilion-500')
          : (isLight ? 'text-amber-950' : 'text-ink-800')
      ),
    )} style={{ opacity: 0.85, lineHeight: 1 }}>
      {face === 'fun'
        ? (card.rank === 17 ? '🕺' : '💃')  // 大王🕺 小王💃
        : (card.rank === 17 ? '♚' : '♛')}
    </span>
  </div>
</>
      ) : (
        // ===== 普通牌 =====
        <>
          {/* 左上角：点数 + 小花色 */}
          <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
            <span className={cn(s.corner, rankColor, 'font-bold')}>{rankLabel}</span>
            <span className={cn(s.cornerSuit, rankColor)}>{getSuitLabel(card)}</span>
          </div>

          {/* 左下角：癞子本体点数标注（出牌中充当其他点数时） */}
          {converted && (
            <div className="absolute bottom-0.5 left-1 leading-none">
              <span className={cn(
                'font-main font-bold',
                size === 'sm' ? 'text-[9px]' : 'text-xs',
                isLight ? 'text-red-600' : 'text-vermilion-400',
              )}>
                癞{getCardLabel(card)}
              </span>
            </div>
          )}

          {/* 右下角图案：按牌面风格渲染（大小王始终为 ♚/♛ 不随风格变化） */}
          <div
            className="absolute flex items-end justify-end pointer-events-none"
            style={{ right: '2px', bottom: '2px' }}
          >
            {face === 'ring' ? (
              // 圆徽：金环花色徽章
              <div className={cn(
                s.ringBox, 'rounded-full border-2 flex items-center justify-center',
                isLight ? 'border-amber-600/70' : 'border-gold-500/70',
              )}>
                <span className={cn(s.ringSuit, rankColor)} style={{ opacity: 0.9 }}>
                  {getSuitLabel(card)}
                </span>
              </div>
            ) : face === 'watermark' ? (
              // 水印：超大半透明花色（超出部分被裁切）
              <span
                className={cn(s.watermark, rankColor)}
                style={{ opacity: 0.16, lineHeight: 1, marginRight: '-6px', marginBottom: '-10px' }}
              >
                {getSuitLabel(card)}
              </span>
            ) : face === 'rank' ? (
              // 点数：右下角大号点数字符（JPQ 字体，癞子显示充当点数）
              // 10 特殊适配：JPQ 字体无「10」字形（原 Card Characters 用「=」表示），此处直接显示「10」并缩小字号
              rankLabel === '=' ? (
                <span
                  className={cn(rankColor, 'font-bold font-jpq', s.rankChar10)}
                  style={{ opacity: 0.9, letterSpacing: '-0.05em', lineHeight: 1 }}
                >
                  10
                </span>
              ) : (
                <span className={cn(s.rankChar, rankColor, 'font-bold font-jpq')} style={{ opacity: 0.9 }}>
                  {rankLabel}
                </span>
              )
            ) : face === 'fun' ? (
              // 趣味人物：花色对应的人物 emoji
              <span className={s.funEmoji} style={{ opacity: 0.95, lineHeight: 1 }}>
                {FUN_SUIT_EMOJI[card.suit] ?? getSuitLabel(card)}
              </span>
            ) : (
              // 经典：大花色图案（默认）
              <span className={cn(s.bigSuit, rankColor)} style={{ opacity: 0.85 }}>
                {getSuitLabel(card)}
              </span>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
