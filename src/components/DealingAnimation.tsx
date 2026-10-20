// 发牌动画 —— 牌从中央牌堆飞向三位玩家，从左至右轮流发牌
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Card } from '@shared/types';
import { usesPacketDeal } from '@shared/gameModes';
import { dealKey } from '@shared/dealPresentation';
import { useGameStore } from '@/store/gameStore';
import { useThemeStore } from '@/store/themeStore';
import { sound } from '@/lib/soundManager';
import PlayingCard from './PlayingCard';
import { cn } from '@/lib/utils';
import { dphAsset } from '@/config/dphTheme';
import PacketDealingAnimation from './PacketDealingAnimation';
import { sortCardsDesc } from '@/lib/cards';
import { shuffledCards } from '@/lib/packetDeal';
import { CLASSIC_DEAL, PACKET_DEAL } from '@/config/dealAnimations';
import { boundsInTable, measureHandTargets, type Point } from '@/lib/cardGeometry';

interface DealItem {
  key: string;
  card: Card;
  seat: number;
  delay: number;    // ms
  sortedIndex: number;
  stackIndex: number; // 该座位已发的第几张（用于错开堆叠）
}

// 各座位相对屏幕中央的目标偏移（占遮罩容器的比例）。
// 旧实现用 vw/vh（物理视口单位）：手机旋转/紧凑缩放模式下遮罩实际是
// 缩放后的设计画布，vw/vh 与它完全脱节导致飞牌目标错位甚至飞出画布。
// 改为按遮罩实测尺寸换算像素，任何布局（桌面/旋转/紧凑）都正确。
const TARGET_FRAC: Record<number, { x: number; y: number; rotate: number }> = {
  0: { x: -0.05, y: 0.22, rotate: 0 },       // 玩家：底部
  1: { x: 0.26, y: -0.18, rotate: 8 },       // 右上 AI
  2: { x: -0.26, y: -0.18, rotate: -8 },     // 左上 AI
};

const DEAL_INTERVAL = CLASSIC_DEAL.cardGap * 1000;   // 每张牌间隔（ms）
const FLY_DURATION = CLASSIC_DEAL.flight;   // 飞行时长（s）
const STACK_SPREAD = 20;    // 每张牌在目标位置的错开量（px）

export default function DealingAnimation() {
  const state = useGameStore(s => s.state);
  const mySeat = useGameStore(s => s.mySeat);
  const finishDealing = useGameStore(s => s.finishDealing);
  if (state && usesPacketDeal(state.mode)) return <PacketDealingAnimation
    key={dealKey(state)} players={state.players} mySeat={mySeat} gameId={dealKey(state)} onDone={finishDealing}
    laiziRanks={state.laiziRank != null ? [state.laiziRank] : []} />;
  return <ClassicDealingAnimation />;
}

function ClassicDealingAnimation() {
  const state = useGameStore((s) => s.state);
  const finishDealing = useGameStore((s) => s.finishDealing);
  const mySeat = useGameStore((s) => s.mySeat);
  const isLight = useThemeStore((s) => s.theme === 'light');
  const [dealtCount, setDealtCount] = useState(0);
  const [sorting, setSorting] = useState(false);
  const [handTargets, setHandTargets] = useState<Map<string, Point>>(new Map());

  // 遮罩容器实测尺寸：飞牌目标按容器比例换算（覆盖旋转/紧凑缩放等所有布局）
  const overlayRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [mingTarget, setMingTarget] = useState<Point | null>(null);
  useEffect(() => {
    const overlay = overlayRef.current;
    const marker = state?.mingCardSeat == null ? null : document.querySelector<HTMLElement>(`[data-ming-card-seat="${state.mingCardSeat}"]`);
    if (!overlay || !marker || !box.w) return;
    const bounds = boundsInTable(marker.getBoundingClientRect(), overlay.getBoundingClientRect(), box.w, box.h,
      document.body.classList.contains('ddz-rotated'));
    setMingTarget({ x: bounds.x + bounds.width / 2 - box.w / 2, y: bounds.y + bounds.height / 2 - box.h / 2 });
  }, [box.w, box.h, state?.mingCardSeat]);
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // 显示位置：我的座位固定在底部，下家(右)、上家(左)；联机模式下按 mySeat 换算
  const targetPx = (seat: number) => {
    const rel = ((seat - mySeat) % 3 + 3) % 3; // 0=我(底部), 1=下家(右), 2=上家(左)
    const frac = TARGET_FRAC[rel];
    return {
      x: frac.x * box.w,
      y: frac.y * box.h,
      rotate: frac.rotate,
    };
  };

  // 闷抓模式：除预先公示的明牌外，全桌飞牌显示背面，哪怕是自己的。
  // （用户在 menzhuaChoice 点"看牌"或"闷抓"后，PlayerHand 区域再渲染真实明牌。）
  // 非闷抓模式（classic / unshuffled / laizi / tiandilaizi）：允许用玩家手牌真实内容做动画，
  // 只要 state.hand 已下发（非 undefined），就用真实牌面渲染，避免梅花3占位。
  const isMenzhua = state?.mode === 'menzhua';

  // Freeze the random display order and each card's final sorted slot.
  // Opponent hands are never read; blind-bid mode uses backs for every seat.
  const [sequence] = useState<DealItem[]>(() => {
    if (!state) return [];
    const ranks = [state.laiziRank, state.tianLaiziRank, state.diLaiziRank].filter((rank): rank is number => rank != null);
    const hands: (Card[] | undefined)[] = state.players.map((p) => {
      if (isMenzhua) return undefined;   // 闷抓：强制走 dummy 分支，不碰真实手
      if (p.seat === mySeat && p.hand?.length) return sortCardsDesc(p.hand, ranks);
      return undefined;
    });
    const mixed = hands.map((hand, seat) => hand ? shuffledCards(hand, `${dealKey(state)}:classic:${seat}`) : undefined);
    const counts: number[] = state.players.map((p) => p.cardCount ?? 17);
    const items: DealItem[] = [];
    const seatCounter: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
    const maxRounds = Math.max(17, ...counts);
    for (let i = 0; i < maxRounds; i++) {
      // 每轮从左到右：seat 2（左上）→ seat 0（底部）→ seat 1（右上）
      for (const seat of [2, 0, 1]) {
        if (i >= counts[seat]) continue;
        const realCard = isMenzhua && state.mingCardSeat === seat && i === 8 ? state.mingCard : mixed[seat]?.[i];
        const card: Card = realCard ?? { id: `deal-${seat}-${i}`, suit: 'club', rank: 3 };
        items.push({
          key: `${seat}-${i}-${card.id}`,
          card,
          seat,
          delay: items.length * DEAL_INTERVAL,
          stackIndex: seatCounter[seat]++,
          sortedIndex: realCard && hands[seat] ? hands[seat]!.findIndex(c => c.id === realCard.id) : i,
        });
      }
    }
    return items;
  });

  const total = sequence.length;

  // 发牌音效
  useEffect(() => { sound.deal(); }, []);

  const ready = box.w > 0;
  useEffect(() => {
    if (!ready || total === 0) return;
    const lastDelay = sequence[total - 1].delay;
    const sortAt = lastDelay + FLY_DURATION * 1000 + CLASSIC_DEAL.pause * 1000;
    const sort = setTimeout(() => {
      if (overlayRef.current) setHandTargets(measureHandTargets(overlayRef.current));
      setSorting(true); sound.selectCard();
    }, sortAt);
    const timer = setTimeout(finishDealing, sortAt + (PACKET_DEAL.sort + PACKET_DEAL.settle) * 1000);
    return () => { clearTimeout(sort); clearTimeout(timer); };
  }, [ready, total, sequence, finishDealing]);

  return (
    <motion.div
      ref={overlayRef}
      data-stage={sorting ? 'sorting' : 'dealing'}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none dph-dealing"
      style={{ backgroundImage: `linear-gradient(#34304d66,#34304d99),url(${dphAsset('backgrounds/courtyard.jpg')})` }}
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

      {/* 飞行的牌（等容器尺寸测好后再生效动画目标，避免首帧飞向中心） */}
      {box.w > 0 && sequence.map((item) => {
        const isHuman = item.seat === mySeat;
        // 闷抓模式：只有公示明牌正面朝上，其余手牌始终保密。
        // 其它模式：自己显示真实牌面，对手始终显示牌背
        const isMing = isMenzhua && item.card.id === state?.mingCard?.id;
        const target = isMing && mingTarget ? { ...mingTarget, rotate: 0 } : targetPx(item.seat);
        const showFace = isMing || (!isMenzhua && isHuman);
        const stackX = isMing ? 0 : item.stackIndex * STACK_SPREAD;
        const stackY = 0;
        const handCount = sequence.filter(card => card.seat === item.seat).length;
        const step = Math.min(36, Math.max(12, (box.w * .72 - 64) / Math.max(1, handCount - 1)));
        const destination = handTargets.get(item.card.id) ?? { x: (item.sortedIndex - (handCount - 1) / 2) * step - 32, y: box.h / 2 - 110 };
        const finalX = isMing ? target.x : isHuman ? destination.x + 32 : target.x + item.sortedIndex * STACK_SPREAD;
        const finalY = isMing ? target.y : isHuman ? destination.y + 45 : target.y;
        const coord = (value: number) => `calc(-50% + ${value.toFixed(1)}px)`;
        return (
          <motion.div
            key={item.key}
            className="absolute left-1/2 top-1/2"
            data-deal-card={item.card.id}
            data-deal-seat={item.seat}
            data-sorted-index={item.sortedIndex}
            style={{ zIndex: isMing ? 100 : 10 + (sorting ? item.sortedIndex : item.stackIndex), filter: isMing ? 'drop-shadow(0 0 12px #ffe8a1)' : undefined }}
            initial={{ x: '-50%', y: '-50%', opacity: 0, scale: 0.6, rotate: 0 }}
            animate={sorting ? {
              x: [coord(target.x + stackX), coord(finalX), coord(finalX)],
              y: [coord(target.y + stackY), coord(finalY - 28), coord(finalY)],
              opacity: 1, scale: 1, scaleX: isHuman && !isMing ? 64 / 48 : 1, scaleY: isHuman && !isMing ? 90 / 68 : 1, rotate: 0,
            } : {
              x: coord(target.x + stackX), y: coord(target.y + stackY),
              opacity: [0, 1, 1, isHuman ? 1 : .85], scale: 1, rotate: target.rotate,
            }}
            transition={sorting ? { duration: PACKET_DEAL.sort, times: [0, .6, 1], ease: [.2, .7, .2, 1] } : {
              duration: FLY_DURATION, delay: item.delay / 1000, ease: 'easeOut',
            }}
            onAnimationComplete={() => { if (!sorting) setDealtCount(c => c + 1); }}
          >
            <PlayingCard card={item.card} faceDown={!showFace} size="sm" />
          </motion.div>
        );
      })}

      {/* 进度提示 */}
      <div className={cn(
        "absolute bottom-8 left-1/2 -translate-x-1/2 text-sm font-main",
        isLight ? 'text-amber-700/60' : 'text-gold-400/50',
      )}>
        {sorting ? '整理手牌…' : `发牌中... ${Math.min(dealtCount, total)}/${total}`}
      </div>
    </motion.div>
  );
}
