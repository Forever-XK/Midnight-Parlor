// AI 候选生成：按牌型需求填补缺张，而非枚举 13^N 种癞子赋值。
// 与 rules 共用识别/比较规则；保留原始牌 ID，绝不把虚拟牌写回手牌。
import type { Card, Play, Rank } from '@shared/types';
import { groupByRank } from './cards';
import { canBeat, identifyPlay } from './rules';

export function aiActions(hand: Card[], last: Play | null = null, wildRanks: number[] = [], multiBomb = false): Play[] {
  const wild = new Set(wildRanks);
  const jokers = hand.filter(c => c.rank >= 16);
  const wildCards = hand.filter(c => wild.has(c.rank));
  const natural = groupByRank(hand.filter(c => !wild.has(c.rank)));
  const result: Play[] = [];
  const seen = new Set<string>();
  const add = (cards: Card[], assignment: Record<string, number> = {}) => {
    if (!cards.length) return;
    const allWild = cards.every(c => wild.has(c.rank));
    const effective = allWild ? cards : cards.map(c => ({ ...c, rank: (assignment[c.id] ?? c.rank) as Rank }));
    const p = identifyPlay(effective, { multiBomb });
    if (!p) return;
    p.cards = cards;
    if (p.type === 'bomb' && cards.some(c => wild.has(c.rank))) p.isLaiziBomb = true;
    if (!allWild && Object.keys(assignment).length) p.laiziAssign = assignment;
    if (last && !canBeat(p, last)) return;
    const key = `${p.type}:${p.mainRank}:${p.length}:${cards.map(c => c.id).sort().join(',')}`;
    if (!seen.has(key)) { seen.add(key); result.push(p); }
  };
  // 整手本身已合法时，不让带翼剪枝漏掉直接清手（例如 33344445）。
  add(hand);
  const fill = (parts: Array<[number, number]>): { cards: Card[]; assignment: Record<string, number> } | null => {
    const cards: Card[] = [];
    const assignment: Record<string, number> = {};
    let wi = 0;
    for (const [rank, n] of parts) {
      const available = natural.get(rank) ?? [];
      cards.push(...available.slice(0, n));
      for (let i = available.length; i < n; i++) {
        if (wi >= wildCards.length || rank >= 16) return null;
        const c = wildCards[wi++];
        cards.push(c);
        if (rank !== c.rank) assignment[c.id] = rank;
      }
    }
    return { cards, assignment };
  };
  const body = (parts: Array<[number, number]>, wingCount = 0) => {
    const b = fill(parts);
    if (!b) return;
    add(b.cards, b.assignment);
    if (!wingCount) return;
    const used = new Set(b.cards.map(c => c.id));
    const excluded = new Set(parts.map(([r]) => r));
    const rest = hand.filter(c => !used.has(c.id));
    const counts = groupByRank(rest);
    // 多种翼牌方案：优先散牌、低点牌，也保留带大牌的收尾方案。
    for (const highFirst of [false, true]) {
      const singles = [...rest].sort((a, c) =>
        (highFirst ? c.rank - a.rank :
          (counts.get(a.rank)!.length - counts.get(c.rank)!.length) || a.rank - c.rank));
      if (singles.length >= wingCount) add([...b.cards, ...singles.slice(0, wingCount)], b.assignment);
      const pairs: Card[] = [];
      const pa: Record<string, number> = { ...b.assignment };
      const remainingWild = rest.filter(c => wild.has(c.rank));
      const ranks = Array.from({ length: 13 }, (_, i) => i + 3)
        .filter(r => !excluded.has(r)).sort((a, c) => highFirst ? c - a :
          ((counts.get(a)?.length === 2 ? 0 : 1) - (counts.get(c)?.length === 2 ? 0 : 1)) || a - c);
      for (const rank of ranks) {
        const ns = (counts.get(rank) ?? []).filter(c => !wild.has(c.rank));
        while (ns.length + remainingWild.length >= 2 && pairs.length < wingCount * 2) {
          const chosen = ns.splice(0, 2);
          while (chosen.length < 2) {
            const c = remainingWild.shift()!;
            chosen.push(c);
            if (c.rank !== rank) pa[c.id] = rank;
          }
          pairs.push(...chosen);
        }
        if (pairs.length === wingCount * 2) break;
      }
      if (pairs.length === wingCount * 2) add([...b.cards, ...pairs], pa);
    }
  };
  for (let r = 3; r <= 17; r++) {
    body([[r, 1]]);
    if (r > 15) continue;
    body([[r, 2]]);
    body([[r, 3]], 1);
    body([[r, 4]], 2);
    if (multiBomb) for (let n = 5; n <= Math.min(hand.length, 4 + wildCards.length); n++) body([[r, n]]);
  }
  for (const [multiplicity, minLength] of [[1, 5], [2, 3], [3, 2]]) {
    for (let start = 3; start <= 14; start++) {
      for (let len = minLength; start + len - 1 <= 14 && len * multiplicity <= hand.length; len++) {
        body(Array.from({ length: len }, (_, i) => [start + i, multiplicity] as [number, number]), multiplicity === 3 ? len : 0);
      }
    }
  }
  // 单独打出的癞子只能用本体点数；不同癞子点数不能凭空凑成对子。
  for (const cards of groupByRank(wildCards).values()) for (let n = 1; n <= cards.length; n++) add(cards.slice(0, n));
  if (jokers.length === 2) add(jokers);
  return result;
}
