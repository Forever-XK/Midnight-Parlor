// 手牌分析器 —— 将手牌拆解为最优出牌组合
import type { Card, Play, Rank } from '@shared/types';
import { countByRank, groupByRank } from './cards';

export interface HandGroup {
  play: Play;
  isBomb: boolean;
  isRocket: boolean;
}

function isConsecutive(ranks: number[]): boolean {
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

/**
 * 将手牌拆解为牌组列表。目标是尽量减少出牌轮数。
 * 不做完美搜索（NP 难），采用贪心策略。
 */
export function decomposeHand(hand: Card[]): HandGroup[] {
  if (hand.length === 0) return [];
  const groups: HandGroup[] = [];
  let remaining = [...hand];
  const removeCards = (cards: Card[]) => {
    const ids = new Set(cards.map((c) => c.id));
    remaining = remaining.filter((c) => !ids.has(c.id));
  };

  // 1. 提取火箭
  const hasSmallJ = remaining.some((c) => c.rank === 16);
  const hasBigJ = remaining.some((c) => c.rank === 17);
  if (hasSmallJ && hasBigJ) {
    const rocket: Card[] = [
      remaining.find((c) => c.rank === 16)!,
      remaining.find((c) => c.rank === 17)!,
    ];
    groups.push({ play: { type: 'rocket', cards: rocket, mainRank: 17, length: 1 }, isBomb: false, isRocket: true });
    removeCards(rocket);
  } else {
    // 单独的王作为单张
    if (hasSmallJ) {
      const c = remaining.find((c) => c.rank === 16)!;
      groups.push({ play: { type: 'single', cards: [c], mainRank: 16, length: 1 }, isBomb: false, isRocket: false });
      removeCards([c]);
    }
    if (hasBigJ) {
      const c = remaining.find((c) => c.rank === 17)!;
      groups.push({ play: { type: 'single', cards: [c], mainRank: 17, length: 1 }, isBomb: false, isRocket: false });
      removeCards([c]);
    }
  }

  // 2. 提取炸弹（暂存，最后决定是否作为炸弹保留）
  const counts = countByRank(remaining);
  const bombRanks: number[] = [];
  for (const [r, c] of counts) {
    if (c === 4) bombRanks.push(r);
  }

  // 3. 提取飞机（连续三张）
  const tripleRanks = [...counts.keys()].filter((r) => counts.get(r)! >= 3 && r <= 14 && !bombRanks.includes(r)).sort((a, b) => a - b);
  // 找最长连续序列作为飞机
  let i = 0;
  while (i < tripleRanks.length) {
    let j = i;
    while (j + 1 < tripleRanks.length && tripleRanks[j + 1] === tripleRanks[j] + 1) j++;
    const seqLen = j - i + 1;
    if (seqLen >= 2) {
      const seq = tripleRanks.slice(i, j + 1);
      const cards = seq.flatMap((r) => groupByRank(remaining).get(r)!.slice(0, 3));
      groups.push({ play: { type: 'airplane', cards, mainRank: seq[seq.length - 1] as Rank, length: seqLen }, isBomb: false, isRocket: false });
      removeCards(cards);
    }
    i = j + 1;
  }

  // 4. 重新计算剩余牌
  const counts2 = countByRank(remaining);

  // 5. 提取连对（连续对子）
  const pairRanks = [...counts2.keys()].filter((r) => counts2.get(r)! >= 2 && r <= 14).sort((a, b) => a - b);
  i = 0;
  while (i < pairRanks.length) {
    let j = i;
    while (j + 1 < pairRanks.length && pairRanks[j + 1] === pairRanks[j] + 1) j++;
    const seqLen = j - i + 1;
    if (seqLen >= 3) {
      const seq = pairRanks.slice(i, j + 1);
      const cards = seq.flatMap((r) => groupByRank(remaining).get(r)!.slice(0, 2));
      groups.push({ play: { type: 'pair_straight', cards, mainRank: seq[seq.length - 1] as Rank, length: seqLen }, isBomb: false, isRocket: false });
      removeCards(cards);
    }
    i = j + 1;
  }

  // 6. 提取顺子（连续单张，5+）
  const counts3 = countByRank(remaining);
  const singleRanks = [...counts3.keys()].filter((r) => r <= 14).sort((a, b) => a - b);
  i = 0;
  while (i < singleRanks.length) {
    let j = i;
    while (j + 1 < singleRanks.length && singleRanks[j + 1] === singleRanks[j] + 1) j++;
    const seqLen = j - i + 1;
    if (seqLen >= 5) {
      const seq = singleRanks.slice(i, j + 1);
      const cards = seq.map((r) => groupByRank(remaining).get(r)![0]);
      groups.push({ play: { type: 'straight', cards, mainRank: seq[seq.length - 1] as Rank, length: seqLen }, isBomb: false, isRocket: false });
      removeCards(cards);
    }
    i = j + 1;
  }

  // 7. 剩余的三张、对子、单张
  const counts4 = countByRank(remaining);
  for (const [r, c] of [...counts4.entries()].sort((a, b) => a[0] - b[0])) {
    const cards = groupByRank(remaining).get(r)!.slice(0, c);
    if (c === 4) {
      groups.push({ play: { type: 'bomb', cards, mainRank: r as Rank, length: 1 }, isBomb: true, isRocket: false });
    } else if (c === 3) {
      groups.push({ play: { type: 'triple', cards, mainRank: r as Rank, length: 1 }, isBomb: false, isRocket: false });
    } else if (c === 2) {
      groups.push({ play: { type: 'pair', cards, mainRank: r as Rank, length: 1 }, isBomb: false, isRocket: false });
    } else {
      groups.push({ play: { type: 'single', cards: [cards[0]], mainRank: r as Rank, length: 1 }, isBomb: false, isRocket: false });
    }
  }

  return groups;
}

/**
 * 评估手牌强度（用于叫分）。返回 0~100 的分数。
 */
export function evaluateHand(hand: Card[]): number {
  let score = 0;
  const counts = countByRank(hand);

  // 大王
  if (counts.get(17)) score += 16;
  // 小王
  if (counts.get(16)) score += 12;
  // 双王（火箭）
  if (counts.get(16) && counts.get(17)) score += 10;
  // 2 的张数
  score += (counts.get(15) || 0) * 8;
  // A 的张数
  score += (counts.get(14) || 0) * 5;
  // 炸弹
  for (const [r, c] of counts) {
    if (c === 4 && r <= 15) score += 15;
  }
  // 三张
  for (const [r, c] of counts) {
    if (c === 3 && r <= 15) score += 4;
  }
  // 牌型整齐度：拆解后组数越少越好
  const groups = decomposeHand(hand);
  const roundCount = groups.length;
  if (roundCount <= 3) score += 10;
  else if (roundCount <= 5) score += 5;

  return score;
}

/**
 * 计算手牌的出牌轮数（拆解后组数）
 */
export function estimateRounds(hand: Card[]): number {
  return decomposeHand(hand).length;
}
