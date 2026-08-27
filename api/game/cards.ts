// 卡牌定义与牌组生成
import type { Card, Rank, Suit } from '@shared/types';

export const SUITS: Suit[] = ['spade', 'heart', 'club', 'diamond'];

// rank → 显示文本
export const RANK_TEXT: Record<number, string> = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: '小王', 17: '大王',
};

// 花色符号
export const SUIT_SYMBOL: Record<Suit, string> = {
  spade: '♠', heart: '♥', club: '♣', diamond: '♦', joker: '🃏',
};

// 花色颜色（红/黑）
export function isRedSuit(suit: Suit): boolean {
  return suit === 'heart' || suit === 'diamond';
}

// 生成完整 54 张牌组
export function createDeck(): Card[] {
  const deck: Card[] = [];
  const ranks: Rank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ id: `${suit}-${rank}`, suit, rank });
    }
  }
  deck.push({ id: 'joker-16', suit: 'joker', rank: 16 });
  deck.push({ id: 'joker-17', suit: 'joker', rank: 17 });
  return deck;
}

// 洗牌（Fisher-Yates）
export function shuffle(deck: Card[]): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 发牌：返回 [玩家0的17张, 玩家1的17张, 玩家2的17张, 底牌3张]
export function deal(): { hands: Card[][]; bottom: Card[] } {
  const deck = shuffle(createDeck());
  const hands: Card[][] = [[], [], []];
  for (let i = 0; i < 51; i++) {
    hands[i % 3].push(deck[i]);
  }
  const bottom = deck.slice(51, 54);
  // 按点值排序手牌（大到小）
  for (const h of hands) sortCards(h);
  sortCards(bottom);
  return { hands, bottom };
}

/**
 * 不洗牌发牌（参考知乎算法 https://www.zhihu.com/question/396991183/answer/1667865396）：
 *   1. 构造按点数聚类的牌序（3333 4444 5555 ... AAAA 2222，双王相邻），簇顺序随机
 *   2. 部分洗牌：每隔 step 张才与随机位置交换一次，step 越大随机性越差、点数越聚集
 *   3. 按 chunk 张一坨轮发（起始座位随机），整簇牌常落入同一玩家手中
 *      → 对子/三条/炸弹概率大幅上升（实测约为随机发牌的 10 倍，底牌 90% 含对子）
 * step 与 chunk 为可调参数，通过 2 万局仿真调优取得。
 */
export const UNSHUFFLE_STEP = 12; // 部分洗牌步长 n（越大点数越聚集、牌型越整齐）
export const UNSHUFFLE_CHUNK = 4; // 每坨发牌张数 m（须为 4 的倍数，整簇入同一家）

// 构造按点数聚类的牌序（同点数四张连续，双王相邻）
export function buildClusteredDeck(): Card[] {
  const deck: Card[] = [];
  for (let rank = 3; rank <= 15; rank++) {
    for (const suit of SUITS) {
      deck.push({ id: `${suit}-${rank}`, suit, rank: rank as Rank });
    }
  }
  deck.push({ id: 'joker-16', suit: 'joker', rank: 16 });
  deck.push({ id: 'joker-17', suit: 'joker', rank: 17 });
  return deck;
}

// 打乱簇顺序：13 个四张簇 + 双王相邻簇，作为整体单位洗牌（保持簇内聚、簇间随机）
function shuffleClusterOrder(deck: Card[]): Card[] {
  const clusters: Card[][] = [];
  for (let i = 0; i < 52; i += 4) clusters.push(deck.slice(i, i + 4));
  const units = [...clusters, deck.slice(52)];
  for (let i = units.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [units[i], units[j]] = [units[j], units[i]];
  }
  return units.flat();
}

// 部分洗牌：仅每隔 step 张与随机位置交换（step 越大随机性越差）
export function partialShuffle(deck: Card[], step: number): Card[] {
  const arr = [...deck];
  for (let i = 0; i < arr.length; i += step) {
    const j = Math.floor(Math.random() * arr.length);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 按 chunk 张一坨轮发（前 51 张发给三家，末 3 张为底牌；起始座位随机保证各座期望均衡）
export function chunkDeal(deck: Card[], chunk: number): { hands: Card[][]; bottom: Card[] } {
  const hands: Card[][] = [[], [], []];
  let idx = 0;
  let seat = Math.floor(Math.random() * 3);
  while (idx < 51) {
    const take = Math.min(chunk, 17 - hands[seat].length, 51 - idx);
    hands[seat].push(...deck.slice(idx, idx + take));
    idx += take;
    seat = (seat + 1) % 3;
  }
  return { hands, bottom: deck.slice(51, 54) };
}

// 手牌是否含王炸或四条炸弹
function hasRocketOrBomb(hand: Card[]): boolean {
  const cnt = countByRank(hand);
  if ((cnt.get(16) ?? 0) >= 1 && (cnt.get(17) ?? 0) >= 1) return true;
  for (const n of cnt.values()) if (n >= 4) return true;
  return false;
}

export function dealUnshuffled(): { hands: Card[][]; bottom: Card[] } {
  let result: { hands: Card[][]; bottom: Card[] } | null = null;
  // 多次尝试：保证至少一名玩家手握王炸或炸弹（聚类发牌下概率极高，仅兜底）
  for (let attempt = 0; attempt < 8; attempt++) {
    const clustered = shuffleClusterOrder(buildClusteredDeck());
    const deck = partialShuffle(clustered, UNSHUFFLE_STEP);
    result = chunkDeal(deck, UNSHUFFLE_CHUNK);
    if (result.hands.some(hasRocketOrBomb)) break;
  }
  for (const h of result!.hands) sortCards(h);
  sortCards(result!.bottom);
  return result!;
}

// 随机选取癞子点数（3~15，不含王牌）
export function pickLaiziRank(): number {
  const ranks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  return ranks[Math.floor(Math.random() * ranks.length)];
}

// 随机选取一个与 exclude 不同的非王牌点数（用于天地癞子模式：天/地癞子不能相同且不能为王）
export function pickDistinctLaiziRank(exclude: number | null): number {
  const ranks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].filter((r) => r !== exclude);
  return ranks[Math.floor(Math.random() * ranks.length)];
}

// 排序：大到小（癞子牌排到最左侧）
export function sortCards(cards: Card[], laiziRank?: number | null): void {
  if (laiziRank) {
    cards.sort((a, b) => {
      const aL = a.rank === laiziRank;
      const bL = b.rank === laiziRank;
      if (aL && !bL) return -1;
      if (!aL && bL) return 1;
      return (b.rank - a.rank) || a.suit.localeCompare(b.suit);
    });
  } else {
    cards.sort((a, b) => (b.rank - a.rank) || a.suit.localeCompare(b.suit));
  }
}

// 按 rank 分组
export function groupByRank(cards: Card[]): Map<number, Card[]> {
  const map = new Map<number, Card[]>();
  for (const c of cards) {
    if (!map.has(c.rank)) map.set(c.rank, []);
    map.get(c.rank)!.push(c);
  }
  return map;
}

// 按 count 分组：返回 rank -> count
export function countByRank(cards: Card[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const c of cards) {
    map.set(c.rank, (map.get(c.rank) || 0) + 1);
  }
  return map;
}
