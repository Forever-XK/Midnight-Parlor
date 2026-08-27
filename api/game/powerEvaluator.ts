// 牌力评估器 —— 移植自宽立斗地主 AI（https://github.com/ZhouWeikuan/DouDiZhu）
//
// 核心思想（README 第三章）：
//   1. 牌型权重：power = kOneHandPower + kPowerUnit * bad
//      bad 为「厌恶度」：小牌厌恶度高（权重低），炸弹/王炸厌恶度为负（权重高）
//   2. 手牌权重：p(cards) = max( 提取牌型权重 + p(剩余手牌) )，即最优拆牌的总权重
//   3. 关键优化：提取顺序固定为「从最大面值开始」，消除排列级重复计算，
//      复杂度从 O(P(N,M)) 降为近似 O(N+M)；再以面值计数签名做缓存
import type { Card, Play, Rank } from '@shared/types';

const kOneHandPower = -150; // 每多一手牌的代价
const kPowerUnit = -100; // 基础厌恶值
const V2 = 15; // 面值 2

// ===== 牌型权重 =====

interface Shape {
  mainNum: number; // 主牌张数（1/2/3/4）
  value: number; // 序列起始面值
  seralNum: number; // 序列长度（rank 数）
  subNum: number; // 副牌档数（0不带 1带单 2带对）
}

// 从牌型描述换算 DouDiZhu 的 Node 形状参数。
// 注意：本项目 Play.mainRank 对序列牌是「最大」面值，需换算为起始面值。
function shapeOf(type: Play['type'], mainRank: number, length: number): Shape {
  switch (type) {
    case 'single': return { mainNum: 1, value: mainRank, seralNum: 1, subNum: 0 };
    case 'pair': return { mainNum: 2, value: mainRank, seralNum: 1, subNum: 0 };
    case 'triple': return { mainNum: 3, value: mainRank, seralNum: 1, subNum: 0 };
    case 'triple_single': return { mainNum: 3, value: mainRank, seralNum: 1, subNum: 1 };
    case 'triple_pair': return { mainNum: 3, value: mainRank, seralNum: 1, subNum: 2 };
    case 'straight': return { mainNum: 1, value: mainRank - length + 1, seralNum: length, subNum: 0 };
    case 'pair_straight': return { mainNum: 2, value: mainRank - length + 1, seralNum: length, subNum: 0 };
    case 'airplane': return { mainNum: 3, value: mainRank - length + 1, seralNum: length, subNum: 0 };
    case 'airplane_single': return { mainNum: 3, value: mainRank - length + 1, seralNum: length, subNum: 1 };
    case 'airplane_pair': return { mainNum: 3, value: mainRank - length + 1, seralNum: length, subNum: 2 };
    case 'four_two_single': return { mainNum: 4, value: mainRank, seralNum: 1, subNum: 1 };
    case 'four_two_pair': return { mainNum: 4, value: mainRank, seralNum: 1, subNum: 2 };
    case 'bomb': return { mainNum: 4, value: mainRank, seralNum: 1, subNum: 0 };
    default: return { mainNum: 1, value: mainRank, seralNum: 1, subNum: 0 }; // rocket 等
  }
}

/** 计算牌型权重（宽立 AI 的 AINode::getPower 公式） */
export function typePower(type: Play['type'], mainRank: number, length: number): number {
  if (type === 'rocket') return kOneHandPower - kPowerUnit * 8; // bad = -8
  const { mainNum, value, seralNum, subNum } = shapeOf(type, mainRank, length);
  const top = (value + value + seralNum) / 2;
  let bad: number;
  if (mainNum === 4) {
    if (subNum > 0) {
      // 四带二：几乎没有帮助
      bad = -4.5 + 0.003 * (V2 - top) + (seralNum > 1 ? seralNum : 0) * 0.002 - subNum * 0.002;
    } else if (value === V2) {
      bad = -4.65; // 四个2
    } else {
      bad = -6.0 + 0.175 * (V2 - top) + (seralNum > 1 ? seralNum : 0) * 0.002;
    }
  } else if (mainNum === 3) {
    // 带翼（三带一/三带二/飞机带翼）权重显著高于不带：鼓励优先带牌脱手，避免裸出三张
    bad = 0.433 + 0.02 * (V2 - top) + (seralNum > 1 ? seralNum : 0) * 0.02 - subNum * 0.06;
  } else if (mainNum === 2) {
    bad = 0.437 + 0.015 * (V2 - top) + (seralNum > 2 ? seralNum : 0) * 0.02;
  } else {
    bad = 0.435 + 0.0151 * (V2 - top) + (seralNum > 4 ? seralNum : 0) * 0.02;
  }
  return kOneHandPower + kPowerUnit * bad;
}

/** 计算一个 Play 的权重 */
export function playPower(play: Play): number {
  return typePower(play.type, play.mainRank, play.length);
}

// ===== 最优拆牌（递归 + 缓存） =====

export interface PlanGroup {
  type: Play['type'];
  mainRank: number;
  length: number;
  parts: Array<[number, number]>; // [rank, 张数]，用于映射回真实手牌
}

export interface HandPlan {
  power: number;
  groups: PlanGroup[];
}

const memo = new Map<string, HandPlan>();
const EMPTY_PLAN: HandPlan = { power: 0, groups: [] };

function countsKey(c: number[]): string {
  let s = '';
  for (let r = 3; r <= 17; r++) s += String.fromCharCode(48 + c[r]);
  return s;
}

// 以 rank h 结尾、每 rank 至少 m 张的最长连续段（序列不能超过 A）
function runLength(c: number[], h: number, m: number): number {
  if (h > 14 || c[h] < m) return 0;
  let n = 0;
  for (let r = h; r >= 3 && c[r] >= m; r--) n++;
  return n;
}

// 序列主体牌 [h-len+1..h] 各取 n 张
function serialParts(h: number, len: number, n: number): Array<[number, number]> {
  const parts: Array<[number, number]> = [];
  for (let r = h - len + 1; r <= h; r++) parts.push([r, n]);
  return parts;
}

/**
 * 挑副牌翼：kind 1 = 单翼（优先落单牌，其次拆小对/小三，不拆炸弹）；
 * kind 2 = 对翼（只取现成对子，不拆三张/炸弹）。
 * 副牌只从 ≤K 的牌里挑（2/王留作控制牌，人类习惯）。
 */
function pickWings(c: number[], kind: 1 | 2, need: number): Array<[number, number]> | null {
  const parts: Array<[number, number]> = [];
  if (kind === 1) {
    for (let pass = 1; pass <= 3; pass++) {
      for (let r = 3; r <= 13 && parts.length < need; r++) {
        if (c[r] === pass) parts.push([r, 1]);
      }
    }
  } else {
    for (let r = 3; r <= 13 && parts.length < need; r++) {
      if (c[r] === 2) parts.push([r, 2]);
    }
  }
  return parts.length === need ? parts : null;
}

/**
 * 最优拆牌递归：固定从最大面值 h 提取，枚举所有包含 h 的牌型，
 * p(cards) = max(牌型权重 + p(剩余))。按面值计数签名缓存。
 */
function planCounts(c: number[]): HandPlan {
  let h = 0;
  for (let r = 17; r >= 3; r--) {
    if (c[r] > 0) { h = r; break; }
  }
  if (h === 0) return EMPTY_PLAN;
  const key = countsKey(c);
  const hit = memo.get(key);
  if (hit) return hit;

  let best: HandPlan = { power: -Infinity, groups: [] };

  const consider = (type: Play['type'], mainRank: number, length: number, parts: Array<[number, number]>) => {
    const nc = c.slice();
    for (const [r, n] of parts) nc[r] -= n;
    const rest = planCounts(nc);
    const total = typePower(type, mainRank, length) + rest.power;
    if (total > best.power) {
      best = { power: total, groups: [{ type, mainRank, length, parts }, ...rest.groups] };
    }
  };

  // 火箭（双王）
  if (h === 17 && c[16] >= 1) {
    consider('rocket', 17, 1, [[16, 1], [17, 1]]);
  }
  // 炸弹（length 记录张数，与 rules.identifyPlay 保持一致，供 canBeat 比较）
  if (c[h] === 4) {
    consider('bomb', h, 4, [[h, 4]]);
  }
  // 单张 / 顺子（顺子最长 run 以 h 结尾）
  if (h <= 14) {
    const run1 = runLength(c, h, 1);
    for (let len = 5; len <= run1; len++) {
      consider('straight', h, len, serialParts(h, len, 1));
    }
  }
  consider('single', h, 1, [[h, 1]]);
  // 对子 / 连对（对子可到 2，连对不超过 A）
  if (c[h] >= 2 && h <= 15) {
    if (h <= 14) {
      const run2 = runLength(c, h, 2);
      for (let len = 3; len <= run2; len++) {
        consider('pair_straight', h, len, serialParts(h, len, 2));
      }
    }
    consider('pair', h, 1, [[h, 2]]);
  }
  // 三张 / 飞机（可带单翼/对翼）
  if (c[h] >= 3 && h <= 15) {
    const run3 = h <= 14 ? runLength(c, h, 3) : 1;
    for (let len = 1; len <= run3; len++) {
      const main = serialParts(h, len, 3);
      const nc = c.slice();
      for (const [r, n] of main) nc[r] -= n;
      consider(len === 1 ? 'triple' : 'airplane', h, len, main);
      const w1 = pickWings(nc, 1, len);
      if (w1) consider(len === 1 ? 'triple_single' : 'airplane_single', h, len, [...main, ...w1]);
      const w2 = pickWings(nc, 2, len);
      if (w2) consider(len === 1 ? 'triple_pair' : 'airplane_pair', h, len, [...main, ...w2]);
    }
  }

  memo.set(key, best);
  if (memo.size > 200000) memo.clear(); // 防膨胀
  return best;
}

/** 计算手牌的最优拆牌方案 */
export function planHand(cards: Card[]): HandPlan {
  const c: number[] = new Array(18).fill(0);
  for (const card of cards) c[card.rank]++;
  return planCounts(c);
}

/** 将拆牌方案映射为真实出牌（从手牌按 rank 依次取牌） */
export function planGroupsToPlays(cards: Card[], groups: PlanGroup[]): Play[] {
  const pool = new Map<number, Card[]>();
  for (const card of cards) {
    if (!pool.has(card.rank)) pool.set(card.rank, []);
    pool.get(card.rank)!.push(card);
  }
  const take = (r: number, n: number): Card[] => (pool.get(r) ?? []).splice(0, n);
  const plays: Play[] = [];
  for (const g of groups) {
    const cardsOf = g.parts.flatMap(([r, n]) => take(r, n));
    plays.push({ type: g.type, cards: cardsOf, mainRank: g.mainRank as Rank, length: g.length });
  }
  return plays;
}
