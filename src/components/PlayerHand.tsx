// 玩家手牌组件（底部，可点选；支持按住左键滑过多选）
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Card } from '@shared/types';
import { sortCardsDesc } from '@/lib/cards';
import { sound } from '@/lib/soundManager';
import PlayingCard from './PlayingCard';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
  hand: Card[];
  selectedCards: Set<string>;
  onToggleCard: (cardId: string) => void;
  disabled?: boolean;
  laiziRanks?: number[];
}

export default function PlayerHand({ hand, selectedCards, onToggleCard, disabled, laiziRanks }: PlayerHandProps) {
  const sorted = sortCardsDesc(hand, laiziRanks);

  // 计算手牌重叠量：牌少时不重叠（充分展开），牌多时逐渐增加重叠
  // md 尺寸牌宽 = w-16 = 64px；最大总宽 640px
  const CARD_WIDTH = 64;
  const MAX_TOTAL_WIDTH = 640;
  const MAX_OVERLAP = 42;
  const naturalWidth = sorted.length * CARD_WIDTH;
  let overlap = 0;
  if (naturalWidth > MAX_TOTAL_WIDTH && sorted.length > 1) {
    // 总宽度 = CARD_WIDTH + (n-1) * (CARD_WIDTH - overlap) = MAX_TOTAL_WIDTH
    overlap = CARD_WIDTH - (MAX_TOTAL_WIDTH - CARD_WIDTH) / (sorted.length - 1);
  }
  overlap = Math.min(MAX_OVERLAP, Math.max(0, overlap));

  // ===== 滑动多选 =====
  // 按住左键从一张牌开始（翻转一次），滑过其它牌时逐张翻转提起/放下状态；
  // 每张牌在一次按住期间只翻转一次（再滑回不重复翻转），松开左键结束。
  const dragging = useRef(false);                     // 是否处于按住滑动中
  const draggedIds = useRef<Set<string>>(new Set());  // 本次按住已翻转过的牌（去重）
  const [draggingUi, setDraggingUi] = useState(false); // 触发重渲染的高亮状态

  const toggleWithSound = useCallback((cardId: string) => {
    sound.selectCard();
    onToggleCard(cardId);
  }, [onToggleCard]);

  const endDrag = useCallback(() => {
    dragging.current = false;
    draggedIds.current.clear();
    setDraggingUi(false);
  }, []);

  // 全局监听松开左键：即使鼠标移出浏览器窗口/手牌区也能正确结束滑动
  useEffect(() => {
    if (!draggingUi) return;
    const stop = () => endDrag();
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, [draggingUi, endDrag]);

  // ===== 触屏滑动多选（原生事件 + passive:false，才能 preventDefault 阻止页面滚动） =====
  // React 合成 touchmove 为 passive 监听，故挂原生监听；坐标经旋转/缩放变换后
  // 与 elementFromPoint 同一视觉坐标系，命中检测天然正确
  const rowRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef({ toggle: toggleWithSound, endDrag });
  cbRef.current = { toggle: toggleWithSound, endDrag };

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const cardIdFrom = (target: EventTarget | null): string | null => {
      const node = (target as HTMLElement | null)?.closest?.('[data-card-id]');
      return node?.getAttribute('data-card-id') ?? null;
    };
    const onStart = (e: TouchEvent) => {
      if (disabled) return;
      const cardId = cardIdFrom(e.target);
      if (!cardId) return;
      e.preventDefault(); // 阻止合成 mouse 事件与页面滚动
      dragging.current = true;
      draggedIds.current = new Set([cardId]);
      setDraggingUi(true);
      cbRef.current.toggle(cardId);
    };
    const onMove = (e: TouchEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const cardId = cardIdFrom(document.elementFromPoint(t.clientX, t.clientY));
      if (cardId && !draggedIds.current.has(cardId)) {
        draggedIds.current.add(cardId);
        cbRef.current.toggle(cardId);
      }
    };
    const onEnd = () => { if (dragging.current) cbRef.current.endDrag(); };
    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [disabled]);

  const handleCardMouseDown = useCallback((e: React.MouseEvent) => {
    // 仅响应左键；阻止默认行为避免拖动时选中文本
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    const cardId = (e.currentTarget as HTMLElement).dataset.cardId;
    if (!cardId) return;
    dragging.current = true;
    draggedIds.current = new Set([cardId]);
    setDraggingUi(true);
    toggleWithSound(cardId);
  }, [disabled, toggleWithSound]);

  const handleCardMouseEnter = useCallback((cardId: string) => {
    if (disabled || !dragging.current) return;
    // 每张牌在一次按住中只翻转一次
    if (draggedIds.current.has(cardId)) return;
    draggedIds.current.add(cardId);
    toggleWithSound(cardId);
  }, [disabled, toggleWithSound]);

  return (
    <div className="flex items-end justify-center px-4 pb-2 min-h-[112px]">
      <div ref={rowRef} className="flex flex-row items-end" style={{ paddingLeft: `${overlap / 2}px`, touchAction: 'none' }}>
        <AnimatePresence mode="popLayout">
          {sorted.map((card, idx) => {
            const isSelected = selectedCards.has(card.id);
            return (
              <motion.div
                key={card.id}
                layout
                data-card-id={card.id}
                initial={{ y: 40, opacity: 0, rotate: -8 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                exit={{ y: -60, opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3, delay: idx * 0.02 }}
                style={{ marginLeft: idx === 0 ? -overlap / 2 : -overlap }}
                onMouseDown={handleCardMouseDown}
                onMouseEnter={() => handleCardMouseEnter(card.id)}
              >
                <PlayingCard
                  card={card}
                  size="md"
                  selected={isSelected}
                  // 翻转逻辑由 mousedown/mouseenter 处理（支持滑过多选），click 不再重复翻转；
                  // 保留 onClick 以启用 hover 提牌动画
                  onClick={disabled ? undefined : () => { /* 由 mousedown 处理 */ }}
                  laiziRanks={laiziRanks}
                  className={cn(draggingUi && 'brightness-105')}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
