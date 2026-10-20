// 牌型规则引擎 —— 识别牌型、比较大小、查找可压牌型
import type { Card, Play, Rank } from '@shared/types';
import { countByRank, groupByRank } from './cards';

// 判断 rank 序列是否连续（严格递增 1）
function isConsecutive(ranks: number[]): boolean {
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

// 从已排序的 rank 列表中查找长度为 k 的连续子序列，返回该子序列或 null
function findConsecutiveSeq(ranks: number[], k: number): number[] | null {
  if (ranks.length < k) return null;
  const sorted = [...ranks].sort((a, b) => a - b);
  for (let i = 0; i <= sorted.length - k; i++) {
    let ok = true;
    for (let j = 1; j < k; j++) {
      if (sorted[i + j] !== sorted[i + j - 1] + 1) { ok = false; break; }
    }
    if (ok) return sorted.slice(i, i + k);
  }
  return null;
}

// 牌型识别选项
export interface IdentifyOptions {
  multiBomb?: boolean; // 天地癞子模式：允许 4 张以上同点数组成炸弹
}

/**
 * 识别一组牌的牌型。返回 Play 或 null（非法牌型）
 * opts.multiBomb=true 时，四张及以上的同点数都可以组成炸弹（张数越大越强）。
 */
export function identifyPlay(cards: Card[], opts?: IdentifyOptions): Play | null {
  if (!cards || cards.length === 0) return null;
  const sorted = [...cards].sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit));
  const counts = countByRank(sorted);
  const ranks = [...counts.keys()].sort((a, b) => a - b);
  const n = sorted.length;

  // 火箭：双王
  if (n === 2 && counts.get(16) === 1 && counts.get(17) === 1) {
    return { type: 'rocket', cards: sorted, mainRank: 17, length: 1 };
  }

  // 单张
  if (n === 1) {
    return { type: 'single', cards: sorted, mainRank: sorted[0].rank, length: 1 };
  }

  // 对子（同 rank 两张，不含王）
  if (n === 2 && counts.size === 1 && ranks[0] <= 15) {
    return { type: 'pair', cards: sorted, mainRank: ranks[0], length: 1 };
  }

  // 三张
  if (n === 3 && counts.size === 1) {
    return { type: 'triple', cards: sorted, mainRank: ranks[0], length: 1 };
  }

  // 炸弹（四张及以上同点数；天地癞子模式允许 5+ 张，length 记录张数）
  if (counts.size === 1) {
    const cnt = counts.get(ranks[0])!;
    if (cnt === 4 || (opts?.multiBomb && cnt >= 4)) {
      return { type: 'bomb', cards: sorted, mainRank: ranks[0], length: cnt };
    }
  }

  // 三带一
  if (n === 4 && counts.size === 2) {
    const tripleRank = ranks.find((r) => counts.get(r) === 3);
    if (tripleRank !== undefined) {
      return { type: 'triple_single', cards: sorted, mainRank: tripleRank, length: 1 };
    }
  }

  // 三带二
  if (n === 5 && counts.size === 2) {
    const tripleRank = ranks.find((r) => counts.get(r) === 3);
    const pairRank = ranks.find((r) => counts.get(r) === 2);
    if (tripleRank !== undefined && pairRank !== undefined && pairRank <= 15) {
      return { type: 'triple_pair', cards: sorted, mainRank: tripleRank, length: 1 };
    }
  }

  // 四带二（单）：4 张 + 2 张（可为一张对，或两张不同单牌）
  if (n === 6) {
    const fourRank = ranks.find((r) => counts.get(r) === 4);
    if (fourRank !== undefined) {
      const rest = ranks.filter((r) => r !== fourRank);
      const restTotal = rest.reduce((s, r) => s + counts.get(r)!, 0);
      if (restTotal === 2) {
        return { type: 'four_two_single', cards: sorted, mainRank: fourRank, length: 1 };
      }
    }
  }

  // 四带二对：4 张 + 两对（两对可为同点，即 4 张同点视作两对）
  if (n === 8) {
    const fourRank = ranks.find((r) => counts.get(r) === 4);
    if (fourRank !== undefined) {
      const rest = ranks.filter((r) => r !== fourRank);
      const restTotal = rest.reduce((s, r) => s + counts.get(r)!, 0);
      if (restTotal === 4 && rest.every((r) => counts.get(r)! % 2 === 0 && r <= 15)) {
        return { type: 'four_two_pair', cards: sorted, mainRank: fourRank, length: 1 };
      }
    }
  }

  // 顺子：5+ 连续单张，rank 3~14（不含 2/王）
  if (n >= 5 && counts.size === n && ranks.every((r) => r <= 14)) {
    if (isConsecutive(ranks)) {
      return { type: 'straight', cards: sorted, mainRank: ranks[ranks.length - 1], length: n };
    }
  }

  // 连对：3+ 连续对子，rank 3~14
  if (n >= 6 && n % 2 === 0 && counts.size === n / 2 &&
      ranks.every((r) => counts.get(r) === 2 && r <= 14)) {
    if (isConsecutive(ranks)) {
      return { type: 'pair_straight', cards: sorted, mainRank: ranks[ranks.length - 1], length: ranks.length };
    }
  }

  // 飞机（不带翼）：2+ 连续三张，rank 3~14
  if (n >= 6 && n % 3 === 0 && counts.size === n / 3 &&
      ranks.every((r) => counts.get(r) === 3 && r <= 14)) {
    if (isConsecutive(ranks)) {
      return { type: 'airplane', cards: sorted, mainRank: ranks[ranks.length - 1], length: ranks.length };
    }
  }

  // 飞机带单：k 连续三张 + k 单张
  if (n >= 8 && n % 4 === 0) {
    const k = n / 4;
    const tripleRanks = ranks.filter((r) => counts.get(r) >= 3 && r <= 14);
    const seq = findConsecutiveSeq(tripleRanks, k);
    if (seq) {
      // 剩余 k 张作为翼（单张，可同 rank）
      const used = new Set(seq);
      let restCount = 0;
      for (const r of ranks) {
        const c = counts.get(r)!;
        const usedC = used.has(r) ? 3 : 0;
        restCount += c - usedC;
      }
      if (restCount === k) {
        return { type: 'airplane_single', cards: sorted, mainRank: seq[seq.length - 1], length: k };
      }
    }
  }

  // 飞机带对：k 连续三张 + k 对子（对可为同点，即 4 张同点视作两对）
  if (n >= 10 && n % 5 === 0) {
    const k = n / 5;
    const tripleRanks = ranks.filter((r) => counts.get(r) >= 3 && r <= 14);
    const seq = findConsecutiveSeq(tripleRanks, k);
    if (seq) {
      const used = new Set(seq);
      const restRanks = ranks.filter((r) => !used.has(r));
      const restTotal = restRanks.reduce((s, r) => s + counts.get(r)!, 0);
      if (restTotal === 2 * k && restRanks.every((r) => counts.get(r)! % 2 === 0 && r <= 15)) {
        return { type: 'airplane_pair', cards: sorted, mainRank: seq[seq.length - 1], length: k };
      }
    }
  }

  return null;
}

/**
 * 判断 play 是否能压过 last
 */
export function canBeat(play: Play, last: Play): boolean {
  if (play.type === 'rocket') return true;
  if (last.type === 'rocket') return false;
  if (play.type === 'bomb' && last.type !== 'bomb') return true;
  if (last.type === 'bomb' && play.type !== 'bomb') return false;
  if (play.type === 'bomb' && last.type === 'bomb') {
    // 炸弹大小：张数越多越大；张数相同比点数。四张炸遵循癞子规则（硬炸压癞子炸）。
    if (play.length !== last.length) return play.length > last.length;
    if (play.length === 4) {
      const playLaizi = !!play.isLaiziBomb;
      const lastLaizi = !!last.isLaiziBomb;
      if (playLaizi !== lastLaizi) return lastLaizi; // 硬炸压癞子炸，反之不行
    }
    return play.mainRank > last.mainRank;
  }
  // 同型同长度比 mainRank
  if (play.type === last.type && play.length === last.length) {
    return play.mainRank > last.mainRank;
  }
  return false;
}

// ========== 查找可压过 last 的所有牌型 ==========

/** 从手牌中取出指定 rank 的若干张牌 */
function pickByRank(hand: Card[], rank: number, count: number): Card[] {
  return hand.filter((c) => c.rank === rank).slice(0, count);
}

/** 查找所有能压过 last 的炸弹与火箭 */
function findBombsAndRocket(hand: Card[], last: Play, opts?: IdentifyOptions): Play[] {
  const results: Play[] = [];
  const counts = countByRank(hand);
  // 炸弹（四张及以上；天地癞子模式下张数越多越大）
  for (const [rank, cnt] of counts) {
    if (cnt === 4 || (opts?.multiBomb && cnt >= 4)) {
      const cards = pickByRank(hand, rank, cnt);
      const play: Play = { type: 'bomb', cards, mainRank: rank as Rank, length: cnt };
      if (canBeat(play, last)) results.push(play);
    }
  }
  // 火箭
  if (counts.get(16) && counts.get(17)) {
    const cards = [...pickByRank(hand, 16, 1), ...pickByRank(hand, 17, 1)];
    results.push({ type: 'rocket', cards, mainRank: 17, length: 1 });
  }
  return results;
}

/**
 * 查找手牌中所有能压过 lastPlay 的牌型组合。
 * 用于 AI 跟牌与玩家提示。
 */
export function findBeatingPlays(hand: Card[], last: Play, opts?: IdentifyOptions): Play[] {
  if (!last) return [];
  const results: Play[] = [];
  const counts = countByRank(hand);
  const ranks = [...counts.keys()].sort((a, b) => a - b);

  const lastRank = last.mainRank;
  const lastLen = last.length;

  switch (last.type) {
    case 'single':
      for (const r of ranks) {
        if (r > lastRank) {
          results.push({ type: 'single', cards: pickByRank(hand, r, 1), mainRank: r as Rank, length: 1 });
        }
      }
      break;

    case 'pair':
      for (const r of ranks) {
        if (r > lastRank && counts.get(r)! >= 2 && r <= 15) {
          results.push({ type: 'pair', cards: pickByRank(hand, r, 2), mainRank: r as Rank, length: 1 });
        }
      }
      break;

    case 'triple':
      for (const r of ranks) {
        if (r > lastRank && counts.get(r)! >= 3) {
          results.push({ type: 'triple', cards: pickByRank(hand, r, 3), mainRank: r as Rank, length: 1 });
        }
      }
      break;

    case 'triple_single':
      for (const r of ranks) {
        if (r > lastRank && counts.get(r)! >= 3) {
          const triple = pickByRank(hand, r, 3);
          // 找一张单张翼
          for (const sr of ranks) {
            if (sr !== r) {
              const wing = pickByRank(hand, sr, 1);
              results.push({ type: 'triple_single', cards: [...triple, ...wing], mainRank: r as Rank, length: 1 });
              break; // 取最小翼即可，后续策略层会优化
            }
          }
        }
      }
      break;

    case 'triple_pair':
      for (const r of ranks) {
        if (r > lastRank && counts.get(r)! >= 3) {
          const triple = pickByRank(hand, r, 3);
          for (const pr of ranks) {
            if (pr !== r && counts.get(pr)! >= 2 && pr <= 15) {
              const wing = pickByRank(hand, pr, 2);
              results.push({ type: 'triple_pair', cards: [...triple, ...wing], mainRank: r as Rank, length: 1 });
              break;
            }
          }
        }
      }
      break;

    case 'straight': {
      // 查找长度相同的更大顺子
      const validRanks = ranks.filter((r) => counts.get(r)! >= 1 && r <= 14);
      for (let i = 0; i <= validRanks.length - lastLen; i++) {
        const seg = validRanks.slice(i, i + lastLen);
        if (seg.length === lastLen && isConsecutive(seg) && seg[seg.length - 1] > lastRank) {
          const cards = seg.flatMap((r) => pickByRank(hand, r, 1));
          results.push({ type: 'straight', cards, mainRank: seg[seg.length - 1] as Rank, length: lastLen });
        }
      }
      break;
    }

    case 'pair_straight': {
      const validRanks = ranks.filter((r) => counts.get(r)! >= 2 && r <= 14);
      for (let i = 0; i <= validRanks.length - lastLen; i++) {
        const seg = validRanks.slice(i, i + lastLen);
        if (seg.length === lastLen && isConsecutive(seg) && seg[seg.length - 1] > lastRank) {
          const cards = seg.flatMap((r) => pickByRank(hand, r, 2));
          results.push({ type: 'pair_straight', cards, mainRank: seg[seg.length - 1] as Rank, length: lastLen });
        }
      }
      break;
    }

    case 'airplane': {
      const validRanks = ranks.filter((r) => counts.get(r)! >= 3 && r <= 14);
      for (let i = 0; i <= validRanks.length - lastLen; i++) {
        const seg = validRanks.slice(i, i + lastLen);
        if (seg.length === lastLen && isConsecutive(seg) && seg[seg.length - 1] > lastRank) {
          const cards = seg.flatMap((r) => pickByRank(hand, r, 3));
          results.push({ type: 'airplane', cards, mainRank: seg[seg.length - 1] as Rank, length: lastLen });
        }
      }
      break;
    }

    case 'airplane_single': {
      const validRanks = ranks.filter((r) => counts.get(r)! >= 3 && r <= 14);
      for (let i = 0; i <= validRanks.length - lastLen; i++) {
        const seg = validRanks.slice(i, i + lastLen);
        if (seg.length === lastLen && isConsecutive(seg) && seg[seg.length - 1] > lastRank) {
          const usedSet = new Set(seg);
          // 选 lastLen 张单张翼（最小）
          const wings: Card[] = [];
          for (const r of ranks) {
            if (usedSet.has(r)) continue;
            const avail = counts.get(r)!;
            for (let w = 0; w < avail && wings.length < lastLen; w++) {
              wings.push(pickByRank(hand, r, w + 1)[w]);
            }
            if (wings.length >= lastLen) break;
          }
          if (wings.length === lastLen) {
            const cards = [...seg.flatMap((r) => pickByRank(hand, r, 3)), ...wings];
            results.push({ type: 'airplane_single', cards, mainRank: seg[seg.length - 1] as Rank, length: lastLen });
          }
        }
      }
      break;
    }

    case 'airplane_pair': {
      const validRanks = ranks.filter((r) => counts.get(r)! >= 3 && r <= 14);
      for (let i = 0; i <= validRanks.length - lastLen; i++) {
        const seg = validRanks.slice(i, i + lastLen);
        if (seg.length === lastLen && isConsecutive(seg) && seg[seg.length - 1] > lastRank) {
          const usedSet = new Set(seg);
          const pairRanks = ranks.filter((r) => !usedSet.has(r) && counts.get(r)! >= 2 && r <= 15);
          if (pairRanks.length >= lastLen) {
            const wings = pairRanks.slice(0, lastLen).flatMap((r) => pickByRank(hand, r, 2));
            const cards = [...seg.flatMap((r) => pickByRank(hand, r, 3)), ...wings];
            results.push({ type: 'airplane_pair', cards, mainRank: seg[seg.length - 1] as Rank, length: lastLen });
          }
        }
      }
      break;
    }

    case 'four_two_single':
    case 'four_two_pair': {
      // 用更大的四张 + 翼
      for (const r of ranks) {
        if (r > lastRank && counts.get(r)! >= 4) {
          if (last.type === 'four_two_single') {
            const rest = ranks.filter((rr) => rr !== r);
            if (rest.length >= 2) {
              const wings = [...pickByRank(hand, rest[0], 1), ...pickByRank(hand, rest[1], 1)];
              results.push({ type: 'four_two_single', cards: [...pickByRank(hand, r, 4), ...wings], mainRank: r as Rank, length: 1 });
            }
          } else {
            const rest = ranks.filter((rr) => rr !== r && counts.get(rr)! >= 2 && rr <= 15);
            if (rest.length >= 2) {
              const wings = [...pickByRank(hand, rest[0], 2), ...pickByRank(hand, rest[1], 2)];
              results.push({ type: 'four_two_pair', cards: [...pickByRank(hand, r, 4), ...wings], mainRank: r as Rank, length: 1 });
            }
          }
        }
      }
      break;
    }

    case 'bomb':
      // 更大的炸弹已在 findBombsAndRocket 处理
      break;
  }

  // 追加炸弹与火箭（可压任何牌型）
  results.push(...findBombsAndRocket(hand, last, opts));
  return results;
}

/**
 * 查找手牌中所有可能的领出牌型（用于 AI 主动出牌）。
 * 返回精简列表：每种基本牌型取最小的一个，加上炸弹/火箭。
 */
export function findLeadingPlays(hand: Card[], opts?: IdentifyOptions): Play[] {
  const results: Play[] = [];
  const counts = countByRank(hand);
  const ranks = [...counts.keys()].sort((a, b) => a - b);
  const groups = groupByRank(hand);

  // 单张
  for (const r of ranks) {
    results.push({ type: 'single', cards: [groups.get(r)![0]], mainRank: r as Rank, length: 1 });
  }
  // 对子
  for (const r of ranks) {
    if (counts.get(r)! >= 2 && r <= 15) {
      results.push({ type: 'pair', cards: groups.get(r)!.slice(0, 2), mainRank: r as Rank, length: 1 });
    }
  }
  // 三张 / 三带一 / 三带二
  for (const r of ranks) {
    if (counts.get(r)! >= 3) {
      const triple = groups.get(r)!.slice(0, 3);
      results.push({ type: 'triple', cards: triple, mainRank: r as Rank, length: 1 });
      // 三带一
      for (const sr of ranks) {
        if (sr !== r) {
          results.push({ type: 'triple_single', cards: [...triple, groups.get(sr)![0]], mainRank: r as Rank, length: 1 });
          break;
        }
      }
      // 三带二
      for (const pr of ranks) {
        if (pr !== r && counts.get(pr)! >= 2 && pr <= 15) {
          results.push({ type: 'triple_pair', cards: [...triple, ...groups.get(pr)!.slice(0, 2)], mainRank: r as Rank, length: 1 });
          break;
        }
      }
    }
  }
  // 顺子
  const straightRanks = ranks.filter((r) => r <= 14);
  for (let len = 5; len <= straightRanks.length; len++) {
    for (let i = 0; i <= straightRanks.length - len; i++) {
      const seg = straightRanks.slice(i, i + len);
      if (isConsecutive(seg)) {
        const cards = seg.map((r) => groups.get(r)![0]);
        results.push({ type: 'straight', cards, mainRank: seg[seg.length - 1] as Rank, length: len });
      }
    }
  }
  // 连对
  const pairRanks = ranks.filter((r) => counts.get(r)! >= 2 && r <= 14);
  for (let len = 3; len <= pairRanks.length; len++) {
    for (let i = 0; i <= pairRanks.length - len; i++) {
      const seg = pairRanks.slice(i, i + len);
      if (isConsecutive(seg)) {
        const cards = seg.flatMap((r) => groups.get(r)!.slice(0, 2));
        results.push({ type: 'pair_straight', cards, mainRank: seg[seg.length - 1] as Rank, length: len });
      }
    }
  }
  // 飞机
  const tripleRanks = ranks.filter((r) => counts.get(r)! >= 3 && r <= 14);
  for (let len = 2; len <= tripleRanks.length; len++) {
    for (let i = 0; i <= tripleRanks.length - len; i++) {
      const seg = tripleRanks.slice(i, i + len);
      if (isConsecutive(seg)) {
        const cards = seg.flatMap((r) => groups.get(r)!.slice(0, 3));
        results.push({ type: 'airplane', cards, mainRank: seg[seg.length - 1] as Rank, length: len });
      }
    }
  }
  // 炸弹（四张及以上；天地癞子模式下张数越多越大）
  for (const r of ranks) {
    const cnt = counts.get(r)!;
    if (cnt >= 4 && (cnt === 4 || opts?.multiBomb)) {
      results.push({ type: 'bomb', cards: groups.get(r)!.slice(0, cnt), mainRank: r as Rank, length: cnt });
    }
  }
  // 火箭
  if (counts.get(16) && counts.get(17)) {
    results.push({ type: 'rocket', cards: [groups.get(16)![0], groups.get(17)![0]], mainRank: 17, length: 1 });
  }
  return results;
}

// ========== 癞子模式 ==========

const ALL_RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

/**
 * 癞子牌型识别：癞子牌（单个或多个癞子点数）可当作任意非王牌点数。
 * 单独使用时为本体点数。
 */
export function identifyPlayWithLaizi(cards: Card[], laiziRanks: number[], opts?: IdentifyOptions): Play | null {
  const plays = identifyPlaysWithLaizi(cards, laiziRanks, opts);
  return plays.length > 0 ? plays[0] : null;
}

/**
 * 癞子牌型识别（多解）：返回选牌 + 癞子可构成的所有合法牌型（去重，按强度降序）。
 * - 癞子牌单独打出（不与其他点数的牌同出）时，只能视为本体点数，不做癞子转换
 * - 用于玩家自由选择想要打出的牌型（如 3张癞子 + 5 既可当对5，也可当别的组合）
 */
export function identifyPlaysWithLaizi(cards: Card[], laiziRanks: number[], opts?: IdentifyOptions): Play[] {
  if (!cards || cards.length === 0) return [];

  const laiziSet = new Set(laiziRanks);
  const isLaizi = (c: Card) => laiziSet.has(c.rank);
  const laiziCards = cards.filter(isLaizi);
  const normalCards = cards.filter((c) => !isLaizi(c));

  // 无癞子牌，直接用原始识别
  if (laiziCards.length === 0) {
    const p = identifyPlay(cards, opts);
    return p ? [p] : [];
  }

  // 癞子牌不与其他点数的牌同出（仅癞子牌）：只能视为本体点数，不做癞子转换
  if (normalCards.length === 0) {
    const p = identifyPlay(cards, opts);
    return p ? [p] : [];
  }

  // 尝试所有可能的 rank 分配，收集所有合法牌型（按 type|mainRank|length|癞子炸 去重）
  const seen = new Set<string>();
  const allPlays: Play[] = [];
  function backtrack(idx: number, assigned: number[]): void {
    if (idx === laiziCards.length) {
      const modified: Card[] = [...normalCards];
      for (let i = 0; i < laiziCards.length; i++) {
        modified.push({ ...laiziCards[i], rank: assigned[i] as Rank });
      }
      const play = identifyPlay(modified, opts);
      if (play) {
        // 含癞子牌组成的炸弹记为癞子炸（四张炸始终小于硬炸）
        const p: Play = { ...play, cards: [...cards], isLaiziBomb: play.type === 'bomb' };
        // 记录癞子牌实际充当的点数（仅记录与本体点数不同的转换，用于出牌展示）
        const assign: Record<string, number> = {};
        let hasAssign = false;
        for (let i = 0; i < laiziCards.length; i++) {
          if (assigned[i] !== laiziCards[i].rank) {
            assign[laiziCards[i].id] = assigned[i];
            hasAssign = true;
          }
        }
        if (hasAssign) p.laiziAssign = assign;
        const key = `${p.type}|${p.mainRank}|${p.length}|${p.isLaiziBomb ? 1 : 0}`;
        if (!seen.has(key)) {
          seen.add(key);
          allPlays.push(p);
        }
      }
      return;
    }
    for (const r of ALL_RANKS) {
      assigned.push(r);
      backtrack(idx + 1, assigned);
      assigned.pop();
    }
  }
  backtrack(0, []);
  if (allPlays.length === 0) return [];

  // 按牌型强度排序（最强的在前）
  const priority: Record<string, number> = {
    rocket: 14, bomb: 13, four_two_pair: 12, four_two_single: 11,
    airplane_pair: 10, airplane_single: 9, airplane: 8,
    pair_straight: 7, straight: 6, triple_pair: 5, triple_single: 4,
    triple: 3, pair: 2, single: 1,
  };
  allPlays.sort((a, b) => {
    const pa = priority[a.type] || 0;
    const pb = priority[b.type] || 0;
    if (pa !== pb) return pb - pa;
    return b.mainRank - a.mainRank;
  });
  return allPlays;
}

/** 将结果中的 modified 卡牌映射回原始卡牌（并附上癞子充当点数） */
function mapToOriginal(play: Play, mapping: Map<string, Card>, assign?: Map<string, number>): Play {
  const p: Play = {
    ...play,
    cards: play.cards.map((c) => mapping.get(c.id) ?? c),
  };
  // 记录癞子牌实际充当的点数（仅记录与本体点数不同的转换，用于出牌展示）
  if (assign) {
    const laiziAssign: Record<string, number> = {};
    let has = false;
    for (const [id, r] of assign) {
      const orig = mapping.get(id);
      if (orig && r !== orig.rank) {
        laiziAssign[id] = r;
        has = true;
      }
    }
    if (has) p.laiziAssign = laiziAssign;
  }
  return p;
}

/**
 * 癞子模式跟牌查找：考虑癞子牌（单个或多个癞子点数）作为任意点数
 */
export function findBeatingPlaysWithLaizi(hand: Card[], last: Play, laiziRanks: number[], opts?: IdentifyOptions): Play[] {
  const laiziSet = new Set(laiziRanks);
  const isLaizi = (c: Card) => laiziSet.has(c.rank);
  const laiziCards = hand.filter(isLaizi);
  const normalHand = hand.filter((c) => !isLaizi(c));

  // 0. 纯癞子牌以本体点数压制（癞子不与其他牌同出时只能作为本体点数：
  //    如两张癞子9=对9、四张癞子4=四张4炸弹）
  const results: Play[] = [...findBeatingPlays(laiziCards, last, opts)];

  // 1. 不使用癞子牌的可压牌型
  results.push(...findBeatingPlays(normalHand, last, opts));

  // 辅助函数：尝试用给定癞子牌组合查找可压牌型
  function tryWithLaizi(selected: Card[]): void {
    const mapping = new Map<string, Card>();
    const assign = new Map<string, number>(); // 原始牌 id → 充当点数
    function backtrack(idx: number, assigned: number[]): boolean {
      if (idx === selected.length) {
        const modifiedHand: Card[] = [...normalHand];
        for (let i = 0; i < selected.length; i++) {
          const mc = { ...selected[i], rank: assigned[i] as Rank };
          mapping.set(mc.id, selected[i]);
          assign.set(selected[i].id, assigned[i]);
          modifiedHand.push(mc);
        }
        const plays = findBeatingPlays(modifiedHand, last, opts);
        for (const play of plays) {
          // 仅保留使用了癞子牌的结果
          if (play.cards.some((c) => mapping.has(c.id))) {
            results.push(mapToOriginal(play, mapping, assign));
          }
        }
        return false; // 继续搜索所有组合
      }
      for (const r of ALL_RANKS) {
        assigned.push(r);
        backtrack(idx + 1, assigned);
        assigned.pop();
      }
      return false;
    }
    backtrack(0, []);
  }

  // 2. 使用 1 张癞子牌
  for (const lc of laiziCards) tryWithLaizi([lc]);

  // 3. 使用 2 张癞子牌
  if (laiziCards.length >= 2) {
    for (let i = 0; i < laiziCards.length; i++) {
      for (let j = i + 1; j < laiziCards.length; j++) {
        tryWithLaizi([laiziCards[i], laiziCards[j]]);
      }
    }
  }

  // 4. 使用 3 张癞子牌
  if (laiziCards.length >= 3) {
    for (let i = 0; i < laiziCards.length; i++) {
      for (let j = i + 1; j < laiziCards.length; j++) {
        for (let k = j + 1; k < laiziCards.length; k++) {
          tryWithLaizi([laiziCards[i], laiziCards[j], laiziCards[k]]);
        }
      }
    }
  }

  // 标记含癞子的炸弹为癞子炸
  for (const p of results) {
    if (p.type === 'bomb' && p.cards.some(isLaizi)) {
      p.isLaiziBomb = true;
    }
  }
  // findBeatingPlays 内部把癞子炸当作硬炸比较，需用正确标记重新校验能否压过
  // 同时：纯癞子牌（不与其他牌同出）只能以本体点数压制——
  // 全癞子的组合必须与本体点数识别结果一致（如癞子4单出只能是 single@4，不能变作 9 压 8）
  const valid = results.filter((p) => {
    if (p.cards.length > 0 && p.cards.every(isLaizi)) {
      const orig = identifyPlay(p.cards, opts);
      if (!orig || orig.type !== p.type || orig.mainRank !== p.mainRank || orig.length !== p.length) {
        return false; // 非本体点数解释，纯癞子不可用
      }
    }
    return canBeat(p, last);
  });

  // 去重
  const seen = new Set<string>();
  return valid.filter((p) => {
    const key = p.cards.map((c) => c.id).sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 癞子模式领出查找：考虑癞子牌（单个或多个癞子点数）作为任意点数
 */
export function findLeadingPlaysWithLaizi(hand: Card[], laiziRanks: number[], opts?: IdentifyOptions): Play[] {
  const laiziSet = new Set(laiziRanks);
  const isLaizi = (c: Card) => laiziSet.has(c.rank);
  const laiziCards = hand.filter(isLaizi);
  const normalHand = hand.filter((c) => !isLaizi(c));

  // 1. 不使用癞子牌的领出牌型
  const results: Play[] = [...findLeadingPlays(normalHand, opts)];

  // 辅助函数
  function tryWithLaizi(selected: Card[]): void {
    const mapping = new Map<string, Card>();
    const assign = new Map<string, number>(); // 原始牌 id → 充当点数
    function backtrack(idx: number, assigned: number[]): boolean {
      if (idx === selected.length) {
        const modifiedHand: Card[] = [...normalHand];
        for (let i = 0; i < selected.length; i++) {
          const mc = { ...selected[i], rank: assigned[i] as Rank };
          mapping.set(mc.id, selected[i]);
          assign.set(selected[i].id, assigned[i]);
          modifiedHand.push(mc);
        }
        const plays = findLeadingPlays(modifiedHand, opts);
        for (const play of plays) {
          if (play.cards.some((c) => mapping.has(c.id))) {
            results.push(mapToOriginal(play, mapping, assign));
          }
        }
        return false;
      }
      for (const r of ALL_RANKS) {
        assigned.push(r);
        backtrack(idx + 1, assigned);
        assigned.pop();
      }
      return false;
    }
    backtrack(0, []);
  }

  // 2. 使用 1-2 张癞子牌
  for (const lc of laiziCards) tryWithLaizi([lc]);
  if (laiziCards.length >= 2) {
    for (let i = 0; i < laiziCards.length; i++) {
      for (let j = i + 1; j < laiziCards.length; j++) {
        tryWithLaizi([laiziCards[i], laiziCards[j]]);
      }
    }
  }

  // 标记含癞子的炸弹为癞子炸
  for (const p of results) {
    if (p.type === 'bomb' && p.cards.some(isLaizi)) {
      p.isLaiziBomb = true;
    }
  }

  // 去重
  const seen = new Set<string>();
  return results.filter((p) => {
    const key = p.cards.map((c) => c.id).sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 牌型中文名 */
export const PLAY_TYPE_NAME: Record<string, string> = {
  single: '单张',
  pair: '对子',
  triple: '三张',
  triple_single: '三带一',
  triple_pair: '三带二',
  straight: '顺子',
  pair_straight: '连对',
  airplane: '飞机',
  airplane_single: '飞机带单',
  airplane_pair: '飞机带对',
  four_two_single: '四带二',
  four_two_pair: '四带二对',
  bomb: '炸弹',
  rocket: '王炸',
};
