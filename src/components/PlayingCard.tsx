// 扑克牌组件 — 午夜雅集象牙白+金描边风格
import { motion } from 'framer-motion';
import type { Card } from '@shared/types';
import { getCardLabel, getSuitLabel, isRedCard, isJoker, RANK_TEXT } from '@/lib/cards';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/store/themeStore';
import { useCardStyleStore } from '@/store/cardStyleStore';
import { useCardBackStore, getCardBack } from '@/store/cardBackStore';

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
  spade: '🎇',   // 黑桃
  heart: '🎆',   // 红桃
  club: '🎊',    // 梅花
  diamond: '🎉',  // 方片
};

// 象棋风格：花色 → 国际象棋棋子映射（大王 ♔ 小王 ♕ 在 JOKER 分支处理）
const XIANGQI_SUIT: Record<string, string> = {
  spade: '♜',   // 黑桃 = 车
  heart: '♖',   // 红桃 = 车（实心）
  club: '♟',    // 梅花 = 兵
  diamond: '♙',  // 方片 = 兵（实心）
};

export default function PlayingCard({
  card, selected, faceDown, size = 'md', onClick, className, laiziRanks, effRank,
}: PlayingCardProps) {
  const s = SIZE_MAP[size];
  const isLight = useThemeStore((st) => st.theme === 'light');
  const face = useCardStyleStore((st) => st.face);
  const backStyle = useCardBackStore((st) => st.back);

  // 背面
  if (faceDown) {
    const back = getCardBack(backStyle, isLight);
    return (
      <div
        className={cn(
          s.w, s.h, s.radius,
          'border shadow-card select-none overflow-hidden',
          isLight ? 'border-amber-700/40' : 'border-gold-600/40',
          className,
        )}
        style={{ background: back.background! }}
      >
        {/* 背面中央装饰图案 + 内框线 */}
        <div className="w-full h-full flex items-center justify-center relative">
          <div
            className="absolute inset-2 rounded-md border"
            style={{ borderColor: back.innerBorderColor }}
          />
          <span
            className="text-lg font-card"
            style={{ color: back.motifColor, lineHeight: 1 }}
          >
            {back.motif}
          </span>
        </div>
      </div>
    );
  }

  const red = isRedCard(card);
  const isLaizi = laiziRanks != null && laiziRanks.includes(card.rank);
  // 癞子牌充当其他点数（出牌展示）：牌面显示充当点数，左下角标注本体癞子点数
  const converted = effRank != null && effRank !== card.rank;
  const rankLabel = converted ? (RANK_TEXT[effRank] ?? '?') : getCardLabel(card);

  // 暗黑风格：玄黑底 + 鎏金/朱砂角标（不随明暗主题变化）
  const darkFace = face === 'dark';

  // 颜色：暗黑风格红=朱砂、黑=鎏金；普通深色模式墨黑/朱红；浅色模式深棕/深红
  const rankColor = darkFace
    ? (red ? 'text-vermilion-400' : 'text-gold-300')
    : red
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
        // 背景与边框（暗黑风格恒为玄黑底+金描边）
        darkFace
          ? 'border-gold-500/50 shadow-card'
          : isLight
            ? 'bg-gradient-to-b from-amber-50 to-amber-100/80 border-amber-400/60 shadow-md'
            : 'border-gold-600/40 shadow-card',
        // 选中效果
        selected && (darkFace
          ? 'ring-2 ring-gold-400 shadow-gold-glow -translate-y-0.5 border-gold-400'
          : isLight
            ? 'ring-2 ring-amber-500 shadow-lg -translate-y-0.5 border-amber-500'
            : 'ring-2 ring-gold-400 shadow-gold-glow -translate-y-0.5 border-gold-400'),
        // 癞子标记（手牌中的癞子 / 出牌中充当其他点数的癞子）
        (isLaizi || converted) && (isLight && !darkFace ? 'ring-2 ring-red-500 border-red-500' : 'ring-2 ring-vermilion-400 border-vermilion-400'),
        className,
      )}
      style={darkFace
        ? { background: 'linear-gradient(165deg, #262633 0%, #16161f 55%, #0e0e15 100%)' }
        : !isLight
          ? { background: 'linear-gradient(180deg, #fdfaf0 0%, #f8f4e8 100%)' }
          : {}}
    >

      {isJoker(card) ? (
// ===== 大小王 =====
<>
  {/* 左上角：竖写 JOKER（JPQ字体） */}
  <div className={cn(
    'absolute top-1 left-1 flex flex-col items-center leading-none font-jpq',
    s.jokerText,
    card.rank === 17
      ? (darkFace ? 'text-vermilion-400' : isLight ? 'text-red-700' : 'text-vermilion-500')
      : (darkFace ? 'text-gold-300' : isLight ? 'text-amber-950' : 'text-ink-800'),
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
          ? (darkFace ? 'text-vermilion-400' : isLight ? 'text-red-700' : 'text-vermilion-500')
          : (darkFace ? 'text-gold-300' : isLight ? 'text-amber-950' : 'text-ink-800')
      ),
    )} style={{ opacity: 0.85, lineHeight: 1, ...(darkFace ? { filter: 'drop-shadow(0 0 5px rgba(212,175,55,0.4))' } : {}) }}>
      {face === 'fun'
        ? (card.rank === 17 ? '🎭' : '🎎')  // 大王🎭 小王🎎
        : face === 'xiangqi'
          ? (card.rank === 17 ? '♔' : '♕')  // 象棋风格：大王♔ 小王♕
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
                {/* 10 在牌面字体中用「=」表示，此标注用正文字体须转回「10」 */}
                癞{getCardLabel(card) === '=' ? '10' : getCardLabel(card)}
              </span>
            </div>
          )}

          {/* 右下角图案：按牌面风格渲染（大小王始终为 ♚/♛ 不随风格变化） */}
          <div
            className="absolute flex items-end justify-end pointer-events-none"
            style={{ right: '2px', bottom: '2px' }}
          >
            {face === 'dark' ? (
              // 暗黑：幽暗徽章 + 鎏金花色微光
              <div
                className={cn(s.ringBox, 'rounded-full border flex items-center justify-center border-gold-500/30')}
                style={{ background: 'rgba(212,175,55,0.08)' }}
              >
                <span
                  className={cn(s.ringSuit, rankColor)}
                  style={{ opacity: 0.95, lineHeight: 1, filter: 'drop-shadow(0 0 5px rgba(212,175,55,0.45))' }}
                >
                  {getSuitLabel(card)}
                </span>
              </div>
            ) : face === 'ring' ? (
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
            ) : face === 'xiangqi' ? (
              // 象棋：花色对应的国际象棋棋子（沿用 rankColor 上色）
              <span className={cn(s.funEmoji, rankColor)} style={{ opacity: 0.95, lineHeight: 1 }}>
                {XIANGQI_SUIT[card.suit] ?? getSuitLabel(card)}
              </span>
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
