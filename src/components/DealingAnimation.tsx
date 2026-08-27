// 发牌动画 —— 牌从中央牌堆飞向三位玩家，从左至右轮流发牌
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Card } from '@shared/types';
import { useGameStore } from '@/store/gameStore';
import { useThemeStore } from '@/store/themeStore';
import { sound } from '@/lib/soundManager';
import { getCardLabel, getSuitLabel, isRedCard, isJoker } from '@/lib/cards';
import { cn } from '@/lib/utils';

interface DealItem {
  key: string;
  card: Card;
  seat: number;
  delay: number;    // ms
  stackIndex: number; // 该座位已发的第几张（用于错开堆叠）
}

// 各座位相对屏幕中央的目标偏移（vw/vh 单位，适配不同屏幕）
const TARGET_OFFSET: Record<number, { x: string; y: string; rotate: number }> = {
  0: { x: '-5vw', y: '22vh', rotate: 0 },       // 玩家：底部
  1: { x: '26vw', y: '-18vh', rotate: 8 },      // 右上 AI
  2: { x: '-26vw', y: '-18vh', rotate: -8 },    // 左上 AI
};

const DEAL_INTERVAL = 72;   // 每张牌间隔（ms）
const FLY_DURATION = 0.4;   // 飞行时长（s）
const STACK_SPREAD = 20;    // 每张牌在目标位置的错开量（px）

export default function DealingAnimation() {
  const state = useGameStore((s) => s.state);
  const finishDealing = useGameStore((s) => s.finishDealing);
  const mySeat = useGameStore((s) => s.mySeat);
  const isLight = useThemeStore((s) => s.theme === 'light');
  const [dealtCount, setDealtCount] = useState(0);

  // 显示位置：我的座位固定在底部，下家(右)、上家(左)；联机模式下按 mySeat 换算
  const displayTarget = (seat: number) => {
    const rel = ((seat - mySeat) % 3 + 3) % 3; // 0=我(底部), 1=下家(右), 2=上家(左)
    return TARGET_OFFSET[rel];
  };

  // 闷抓模式：全桌暗牌。飞行的牌全部显示背面，哪怕是自己的。
  // （用户在 menzhuaChoice 点"看牌"或"闷抓"后，PlayerHand 区域再渲染真实明牌。）
  // 非闷抓模式（classic / unshuffled / laizi / tiandilaizi）：允许用玩家手牌真实内容做动画，
  // 只要 state.hand 已下发（非 undefined），就用真实牌面渲染，避免梅花3占位。
  const isMenzhua = state?.mode === 'menzhua';

  // 生成发牌序列：对 menzhua / 非 menzhua 采用两套策略：
  //   - menzhua：绝对不读 state.hand，只用 cardCount 生成 dummy + 全程背面
  //     （防止任何跨局残留 / 联机他座视角泄漏）
  //   - 其它模式：若某座位 hand 已存在且长度 > 0（通常仅自己座位明牌），使用真实 Card；
  //     否则退回到 dummy。保证视觉上和经典模式体验一致（看到自己的牌按正确顺序发出来）。
  const [sequence] = useState<DealItem[]>(() => {
    if (!state) return [];
    const hands: (Card[] | undefined)[] = state.players.map((p, seat) => {
      if (isMenzhua) return undefined;   // 闷抓：强制走 dummy 分支，不碰真实手
      if (p.hand && p.hand.length > 0) return p.hand;
      return undefined;
    });
    const counts: number[] = state.players.map((p) => p.cardCount ?? 17);
    const items: DealItem[] = [];
    const seatCounter: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
    const maxRounds = Math.max(17, ...counts);
    for (let i = 0; i < maxRounds; i++) {
      // 每轮从左到右：seat 2（左上）→ seat 0（底部）→ seat 1（右上）
      for (const seat of [2, 0, 1]) {
        if (i >= counts[seat]) continue;
        const realCard = hands[seat]?.[i];
        const card: Card = realCard ?? { id: `deal-${seat}-${i}`, suit: 'club', rank: 3 };
        items.push({
          key: `${seat}-${i}-${card.id}`,
          card,
          seat,
          delay: items.length * DEAL_INTERVAL,
          stackIndex: seatCounter[seat]++,
        });
      }
    }
    return items;
  });

  const total = sequence.length;

  // 发牌音效
  useEffect(() => { sound.deal(); }, []);

  useEffect(() => {
    if (total === 0) return;
    const lastDelay = sequence[total - 1].delay;
    const totalMs = lastDelay + FLY_DURATION * 1000 + 150;
    const timer = setTimeout(() => {
      finishDealing();
    }, totalMs);
    return () => clearTimeout(timer);
  }, [total, sequence, finishDealing]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none felt-texture"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* 顶部聚光灯 */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{
          background: isLight
            ? 'radial-gradient(ellipse at top, rgba(180,140,80,0.08), transparent 70%)'
            : 'radial-gradient(ellipse at top, rgba(255,235,180,0.08), transparent 70%)',
        }}
      />
      {/* 中央牌堆 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="relative"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          <div className={cn(
            "w-14 h-20 rounded-lg border shadow-2xl",
            isLight
              ? 'bg-gradient-to-br from-amber-700 to-amber-900 border-amber-600/40'
              : 'bg-gradient-to-br from-emerald-800 to-emerald-950 border-gold-600/40',
          )} />
          <div className={cn(
            "absolute inset-0 w-14 h-20 rounded-lg border shadow-card translate-x-1 -translate-y-1",
            isLight
              ? 'bg-gradient-to-br from-amber-700 to-amber-900 border-amber-600/40'
              : 'bg-gradient-to-br from-emerald-800 to-emerald-950 border-gold-600/40',
          )} />
          <div className={cn(
            "absolute inset-0 w-14 h-20 rounded-lg border shadow-card translate-x-0.5 -translate-y-0.5",
            isLight
              ? 'bg-gradient-to-br from-amber-700 to-amber-900 border-amber-600/40'
              : 'bg-gradient-to-br from-emerald-800 to-emerald-950 border-gold-600/40',
          )} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-xs font-main", isLight ? 'text-amber-200/40' : 'text-gold-500/40')}>
              牌堆
            </span>
          </div>
        </motion.div>
      </div>

      {/* 飞行的牌 */}
      {sequence.map((item) => {
        const target = displayTarget(item.seat);
        const isHuman = item.seat === mySeat;
        // 闷抓模式：所有座位都发背面（不能查看手牌）
        // 其它模式：仅自己座位正面（牌值仍是 dummy，不泄密），AI 座位背面
        const showFace = !isMenzhua && isHuman;
        const stackX = item.stackIndex * STACK_SPREAD;
        const stackY = 0;
        return (
          <motion.div
            key={item.key}
            className="absolute left-1/2 top-1/2"
            initial={{ x: '-50%', y: '-50%', opacity: 0, scale: 0.6, rotate: 0 }}
            animate={{
              x: `calc(-50% + ${target.x} + ${stackX}px)`,
              y: `calc(-50% + ${target.y} + ${stackY}px)`,
              opacity: [0, 1, 1, isHuman ? 1 : 0.85],
              scale: 1,
              rotate: target.rotate,
            }}
            transition={{
              duration: FLY_DURATION,
              delay: item.delay / 1000,
              ease: 'easeOut',
            }}
            onAnimationComplete={() => setDealtCount((c) => c + 1)}
          >
            {showFace ? (
              // 玩家牌：正面朝上（左上角点数+小花色，偏右下大花色）
              <div
                className={cn(
                  "relative w-12 h-[68px] rounded-lg border font-card overflow-hidden",
                  isLight
                    ? 'bg-gradient-to-b from-amber-50 to-amber-100/80 border-amber-400/60 shadow-md'
                    : 'border-gold-600/40 shadow-card-hover',
                )}
                style={!isLight ? { background: 'linear-gradient(180deg, #fdfaf0 0%, #f8f4e8 100%)' } : {}}
              >
                {isJoker(item.card) ? (
// 大小王：左上角竖写 JOKER + 右下角图案
<>
  {/* 左上角：竖写 JOKER（保持不变） */}
  <div className={cn(
    "absolute top-1 left-1 flex flex-col items-center font-jpq text-[8px] font-bold",
    item.card.rank === 17
      ? (isLight ? 'text-red-700' : 'text-vermilion-500')
      : (isLight ? 'text-amber-950' : 'text-ink-800'),
  )}
  style={{ lineHeight: 0.9 }}>
    {'JOKER'.split('').map((ch, idx) => <span key={idx}>{ch}</span>)}
  </div>

  {/* 右下角：大 Joker 图案（与普通牌大花色同位置） */}
  <div
    className="absolute flex items-end justify-end pointer-events-none"
    style={{ right: '6px', bottom: '4px' }}
  >
    <span className={cn(
      "text-2xl leading-none",
      item.card.rank === 17
        ? (isLight ? 'text-red-700' : 'text-vermilion-500')
        : (isLight ? 'text-amber-950' : 'text-ink-800'),
    )} style={{ opacity: 0.85 }}>
      {item.card.rank === 17 ? '♚' : '♛'}
    </span>
  </div>
</>
                ) : (
                  // 普通牌
                  <>
                    {/* 左上角：点数 + 小花色 */}
                    <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none">
                      <span className={cn(
                        "text-sm font-bold",
                        isRedCard(item.card)
                          ? (isLight ? 'text-red-700' : 'text-vermilion-500')
                          : (isLight ? 'text-amber-950' : 'text-ink-800'),
                      )}>
                        {getCardLabel(item.card)}
                      </span>
                      <span className={cn(
                        "text-[10px]",
                        isRedCard(item.card)
                          ? (isLight ? 'text-red-700' : 'text-vermilion-500')
                          : (isLight ? 'text-amber-950' : 'text-ink-800'),
                      )}>
                        {getSuitLabel(item.card)}
                      </span>
                    </div>
                    {/* 偏右下角：大花色 */}
                    <div className="absolute flex items-end justify-end pointer-events-none" style={{ right: '6px', bottom: '4px' }}>
                      <span className={cn(
                        "text-2xl leading-none",
                        isRedCard(item.card)
                          ? (isLight ? 'text-red-700' : 'text-vermilion-500')
                          : (isLight ? 'text-amber-950' : 'text-ink-800'),
                      )} style={{ opacity: 0.85 }}>
                        {getSuitLabel(item.card)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              // AI 牌：背面朝下
              <div
                className={cn(
                  "w-12 h-[68px] rounded-lg border shadow-card",
                  isLight
                    ? 'bg-gradient-to-br from-amber-700 via-amber-800 to-amber-900 border-amber-600/50'
                    : 'border-gold-600/40',
                )}
                style={!isLight ? { background: 'linear-gradient(135deg, #0f6048 0%, #0a4d3a 50%, #063326 100%)' } : {}}
              >
                <div className="w-full h-full rounded-lg flex items-center justify-center">
                  <span className={cn("text-xs font-main", isLight ? 'text-amber-200/30' : 'text-gold-500/30')}>♦</span>
                </div>
              </div>
            )}
          </motion.div>
        );
      })}

      {/* 进度提示 */}
      <div className={cn(
        "absolute bottom-8 left-1/2 -translate-x-1/2 text-sm font-main",
        isLight ? 'text-amber-700/60' : 'text-gold-400/50',
      )}>
        发牌中... {Math.min(dealtCount, total)}/{total}
      </div>
    </motion.div>
  );
}
