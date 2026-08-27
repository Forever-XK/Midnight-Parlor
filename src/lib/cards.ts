// 卡牌显示工具
import type { Card, Rank } from '@shared/types';

export const RANK_TEXT: Record<number, string> = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '=',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: '🃏', 17: '👑',
};

export const SUIT_SYMBOL: Record<string, string> = {
  spade: '♠', heart: '♥', club: '♣', diamond: '♦', joker: '',
};

export function isRedCard(card: Card): boolean {
  return card.suit === 'heart' || card.suit === 'diamond' || card.rank === 17;
}

export function isJoker(card: Card): boolean {
  return card.suit === 'joker';
}

export function getCardLabel(card: Card): string {
  if (card.rank === 16) return '小王';
  if (card.rank === 17) return '大王';
  return RANK_TEXT[card.rank] || '?';
}

export function getSuitLabel(card: Card): string {
  return SUIT_SYMBOL[card.suit] || '';
}

// 按 rank 降序排列（大牌在左，癞子牌排到最左侧；支持多个癞子点数）
export function sortCardsDesc(cards: Card[], laiziRanks?: number | number[]): Card[] {
  const laiziSet = new Set(Array.isArray(laiziRanks) ? laiziRanks : (laiziRanks != null ? [laiziRanks] : []));
  if (laiziSet.size > 0) {
    return [...cards].sort((a, b) => {
      const aL = laiziSet.has(a.rank);
      const bL = laiziSet.has(b.rank);
      if (aL && !bL) return -1;
      if (!aL && bL) return 1;
      return b.rank - a.rank || a.suit.localeCompare(b.suit);
    });
  }
  return [...cards].sort((a, b) => b.rank - a.rank || a.suit.localeCompare(b.suit));
}

export const RANK_ORDER: Rank[] = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3];
