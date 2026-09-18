// AI 前瞻模拟评估器（Monte Carlo rollout）—— 决策框架移植自 rlcard-showdown-master（DouZero）：
// DouZero 的 DeepAgent 对每个合法动作（含 pass）用包含「对手手牌、对手剩余牌数、已出牌、
// 出牌历史」的局面特征计算 Q(s,a)，再取最优；其智能来自预训练神经网络（本仓库不含权重）。
// 此处以无网络的方式近似同一框架：
//   1. 由记牌器（cardTracker）+ 自己手牌推断「未见牌池」；
//   2. 蒙特卡洛采样：把未见牌按对手剩余张数随机分配，模拟「对手手牌」（对应 DouZero 的
//      other_hand_cards 特征）；同一批采样评估所有候选（公共随机数，降低方差）；
//   3. 对每个候选动作，用轻量贪心策略自对弈模拟到终局，统计胜率（对应 Q 值估计）；
//   4. 取胜率最高的动作为 master 难度的出牌选择。
// 领出策略 fastLead / 跟牌策略 fastFollow 为模拟专用轻量实现（O(13) 级），保证整次决策
// 在数百毫秒内完成；时间预算超限时提前停止采样（保留已完成样本）。
import type { Card, Play, Seat } from '@shared/types';
import { createDeck, shuffle, countByRank, groupByRank } from './cards';
import { findBeatingPlays } from './rules';

export interface RolloutInfo {
  hand: Card[];                                   // 决策者手牌
  seat: Seat;
  landlordSeat: Seat;
  opponents: Array<{ seat: Seat; cardCount: number }>; // 两个对手（异角色方）
  cardTracker: Map<number, number>;               // rank -> 已出张数
  lastValidPlay: Play | null;
  lastPlaySeat: Seat | null;
  passCount: number;                              // 当前连续 pass 数（决策者行动前）
}

const SAMPLES = 6;          // 对手手牌采样次数
const MAX_STEPS = 300;      // 单次模拟步数上限（防死循环）
const TIME_BUDGET_MS = 300; // 单次决策的模拟时间预算

let rolloutEnabled = true;
/** 全局开关（测试/对比实验用），生产恒为 true */
export function setRolloutEnabled(v: boolean): void { rolloutEnabled = v; }

// 运行统计（基准/诊断用）
let stats = { calls: 0, evaluated: 0, sims: 0, nullReturns: 0 };
export function getRolloutStats() { return { ...stats }; }
export function resetRolloutStats() { stats = { calls: 0, evaluated: 0, sims: 0, nullReturns: 0 }; }

function isBombP(p: Play): boolean { return p.type === 'bomb' || p.type === 'rocket'; }
function nextOf(s: number): Seat { return ((s + 1) % 3) as Seat; }

// ===== 未见牌池推断 =====

/**
 * 未见的牌 = 全副牌 - 自己手牌 - 已打出的牌（记牌器）。
 * 地主的 3 张底牌对农民不可见，天然留在池中（符合信息集）。
 * 返回 null 表示推断失败（记牌器不完整等），调用方回落启发式。
 */
function buildUnseenPool(info: RolloutInfo): Card[] | null {
  const deck = createDeck();
  const myIds = new Set(info.hand.map((c) => c.id));
  const myCnt = new Map<number, number>();
  for (const c of info.hand) myCnt.set(c.rank, (myCnt.get(c.rank) || 0) + 1);
  const inPool = new Map<number, number>();
  const pool: Card[] = [];
  for (const c of deck) {
    if (myIds.has(c.id)) continue;
    const total = c.rank >= 16 ? 1 : 4;
    const played = info.cardTracker.get(c.rank) || 0;
    const allowed = total - played - (myCnt.get(c.rank) || 0);
    const cur = inPool.get(c.rank) || 0;
    if (cur < allowed) {
      pool.push(c);
      inPool.set(c.rank, cur + 1);
    }
  }
  // 池大小必须与对手剩余牌数吻合，否则信息不完整，不使用模拟
  const need = info.opponents.reduce((s, o) => s + o.cardCount, 0);
  if (pool.length !== need || need === 0) return null;
  return pool;
}

// ===== 轻量策略（模拟专用）=====

/** rank 升序列表的连续段 [start, len] */
function serialSegments(ranks: number[]): Array<{ start: number; len: number }> {
  const segs: Array<{ start: number; len: number }> = [];
  let i = 0;
  while (i < ranks.length) {
    let j = i;
    while (j + 1 < ranks.length && ranks[j + 1] === ranks[j] + 1) j++;
    segs.push({ start: ranks[i], len: j - i + 1 });
    i = j + 1;
  }
  return segs;
}

/** 取 rank 各 n 张牌 */
function takeByGroup(groups: Map<number, Card[]>, rank: number, n: number): Card[] {
  return (groups.get(rank) ?? []).slice(0, n);
}

/**
 * 贪心领出（模拟专用）：优先消耗张数多的非控制组合，
 * 顺序：顺子 > 飞机(带单) > 连对 > 三带一 > 对子 > 单张 > 炸弹 > 王。
 * 不追求最优，只追求「对所有候选一致的快速演化基线」。
 */
function fastLead(hand: Card[]): Play | null {
  if (hand.length === 0) return null;
  const counts = countByRank(hand);
  const groups = groupByRank(hand);
  const ranks = [...counts.keys()].sort((a, b) => a - b);

  // 顺子（>=5 连续单，取最长段）
  const sr = ranks.filter((r) => r <= 14);
  for (const seg of serialSegments(sr)) {
    if (seg.len >= 5) {
      const seq: number[] = [];
      for (let r = seg.start; r < seg.start + seg.len; r++) seq.push(r);
      const cards = seq.flatMap((r) => takeByGroup(groups, r, 1));
      return { type: 'straight', cards, mainRank: seq[seq.length - 1] as Play['mainRank'], length: seq.length };
    }
  }
  // 飞机（>=2 连续三张，带最小单翼）
  const tr = ranks.filter((r) => counts.get(r)! >= 3 && r <= 14);
  for (const seg of serialSegments(tr)) {
    if (seg.len >= 2) {
      const seq: number[] = [];
      for (let r = seg.start; r < seg.start + seg.len; r++) seq.push(r);
      const body = seq.flatMap((r) => takeByGroup(groups, r, 3));
      const bodySet = new Set(seq);
      // 最小单翼（不动三张主体，不拆炸弹）
      const wings: Card[] = [];
      for (const pass of [1, 2] as const) {
        for (const r of ranks) {
          if (bodySet.has(r) || counts.get(r)! >= 4) continue;
          if (counts.get(r) === pass) wings.push(takeByGroup(groups, r, 1)[0]);
          if (wings.length >= seq.length) break;
        }
        if (wings.length >= seq.length) break;
      }
      const type = wings.length === seq.length ? 'airplane_single' : 'airplane';
      return { type, cards: [...body, ...wings], mainRank: seq[seq.length - 1] as Play['mainRank'], length: seq.length };
    }
  }
  // 连对（>=3 连续对）
  const pr = ranks.filter((r) => counts.get(r)! >= 2 && r <= 14);
  for (const seg of serialSegments(pr)) {
    if (seg.len >= 3) {
      const seq: number[] = [];
      for (let r = seg.start; r < seg.start + seg.len; r++) seq.push(r);
      const cards = seq.flatMap((r) => takeByGroup(groups, r, 2));
      return { type: 'pair_straight', cards, mainRank: seq[seq.length - 1] as Play['mainRank'], length: seq.length };
    }
  }
  // 三带一（最小三张 + 最小单翼）
  for (const r of ranks) {
    if (counts.get(r)! === 3 && r <= 14) {
      const body = takeByGroup(groups, r, 3);
      const wingRank = ranks.find((wr) => wr !== r && counts.get(wr)! < 4 && (counts.get(wr)! === 1 || counts.get(wr)! === 2) && wr <= 13);
      const wing = wingRank !== undefined ? takeByGroup(groups, wingRank, 1) : [];
      const type = wing.length === 1 ? 'triple_single' : 'triple';
      return { type, cards: [...body, ...wing], mainRank: r as Play['mainRank'], length: 1 };
    }
  }
  // 对子
  for (const r of ranks) {
    if (counts.get(r)! === 2 && r <= 15) {
      return { type: 'pair', cards: takeByGroup(groups, r, 2), mainRank: r as Play['mainRank'], length: 1 };
    }
  }
  // 单张（跳过王，除非只剩王）
  for (const r of ranks) {
    if (r <= 15 && counts.get(r)! >= 1) {
      return { type: 'single', cards: takeByGroup(groups, r, 1), mainRank: r as Play['mainRank'], length: 1 };
    }
  }
  // 炸弹（最小的）
  for (const r of ranks) {
    if (counts.get(r)! === 4) {
      return { type: 'bomb', cards: takeByGroup(groups, r, 4), mainRank: r as Play['mainRank'], length: 4 };
    }
  }
  // 只剩王
  const joker = hand[0];
  return { type: 'single', cards: [joker], mainRank: joker.rank as Play['mainRank'], length: 1 };
}

/**
 * 贪心跟牌（模拟专用）：能压则用最小非炸牌压；
 * 队友的大牌（>=A）让过（粗略农民配合）；
 * 仅剩炸弹可压时，对手报单/双才动炸。
 */
function fastFollow(
  hand: Card[], last: Play, lastSeat: number, seat: number,
  landlordSeat: number, hands: Card[][],
): Play | null {
  const lastIsTeammate = (seat === landlordSeat) === (lastSeat === landlordSeat) && seat !== lastSeat;
  if (lastIsTeammate && last.mainRank >= 14) return null;
  const beats = findBeatingPlays(hand, last);
  if (beats.length === 0) return null;
  const normal = beats.filter((b) => !isBombP(b));
  if (normal.length > 0) {
    normal.sort((a, b) => a.mainRank - b.mainRank || a.cards.length - b.cards.length);
    return normal[0];
  }
  // 只有炸弹可压：对手快赢（<=2 张）才炸
  let oppMin = 99;
  for (let s = 0; s < 3; s++) {
    const sameTeam = (s === landlordSeat) === (seat === landlordSeat);
    if (!sameTeam) oppMin = Math.min(oppMin, hands[s].length);
  }
  if (oppMin <= 2) {
    const bombs = [...beats].sort((a, b) => a.mainRank - b.mainRank);
    return bombs[0];
  }
  return null;
}

// ===== 模拟器 =====

/** 某座位获胜时，决策者（info.seat）一方是否获胜（同角色即同队） */
function myTeamWon(info: RolloutInfo, winner: number): 0 | 1 {
  const iAmLandlord = info.seat === info.landlordSeat;
  const winnerIsLandlord = winner === info.landlordSeat;
  return iAmLandlord === winnerIsLandlord ? 1 : 0;
}

function removeCards(hand: Card[], cards: Card[]): Card[] {
  const ids = new Set(cards.map((c) => c.id));
  return hand.filter((c) => !ids.has(c.id));
}

/**
 * 自一手「决策者已出 first（或 pass）」的局面起，模拟到终局。
 * 返回决策者一方是否获胜（0/1）；步数耗尽返回 0.5（僵局近似）。
 */
function simulate(
  info: RolloutInfo, oppA: Card[], oppB: Card[],
  first: { play: Play | null },
): number {
  const hands: Card[][] = [[], [], []];
  hands[info.seat] = [...info.hand];
  hands[info.opponents[0].seat] = [...oppA];
  hands[info.opponents[1].seat] = [...oppB];

  let last: Play | null = info.lastValidPlay;
  let lastSeat: number | null = info.lastPlaySeat;
  let passCount = info.passCount;
  let cur: number;

  if (first.play) {
    hands[info.seat] = removeCards(hands[info.seat], first.play.cards);
    if (hands[info.seat].length === 0) return myTeamWon(info, info.seat);
    last = first.play;
    lastSeat = info.seat;
    passCount = 0;
    cur = nextOf(info.seat);
  } else {
    // 决策者 pass：可能直接触发新一轮（两家连续让牌）
    passCount++;
    if (passCount >= 2 && last) {
      cur = lastSeat!;
      last = null;
      lastSeat = null;
      passCount = 0;
    } else {
      cur = nextOf(info.seat);
    }
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    if (hands.every((h) => h.length === 0)) break;
    if (hands[cur].length === 0) { cur = nextOf(cur); continue; }
    const play = last
      ? fastFollow(hands[cur], last, lastSeat!, cur, info.landlordSeat, hands)
      : fastLead(hands[cur]);
    if (play) {
      hands[cur] = removeCards(hands[cur], play.cards);
      if (hands[cur].length === 0) return myTeamWon(info, cur);
      last = play;
      lastSeat = cur;
      passCount = 0;
    } else {
      passCount++;
      if (passCount >= 2 && last) {
        // 两家让牌，新一轮由最后出牌者领出
        cur = lastSeat!;
        last = null;
        lastSeat = null;
        passCount = 0;
        continue;
      }
    }
    cur = nextOf(cur);
  }
  // 步数耗尽未分胜负：按剩余牌数少者占优的近似（双方僵持罕见）
  const myLeft = hands[info.seat].length;
  const oppLeft = info.opponents.reduce((s, o) => s + hands[o.seat].length, 0);
  return myLeft <= oppLeft ? 0.5 : 0.25;
}

// ===== 对外主入口 =====

export interface RolloutResult {
  pick: Play | null;   // 胜率最高的候选
  rates: number[];     // 各候选的模拟胜率（与入参顺序一致）
}

/**
 * 对候选出牌逐一做 rollout 评估（对应 DouZero 对每个 legal action 计算 Q 值）。
 * candidates 可含 null（表示 pass，DouZero 的 legal_actions 同样含空动作）；
 * pass 需要超出最佳出牌胜率 passMargin 才会被选中（避免过度保守）。
 * 返回 null 表示无法评估（开关关闭/信息不完整），调用方回落启发式。
 */
export function rolloutPick(
  info: RolloutInfo,
  candidates: Array<Play | null>,
  opts?: { passMargin?: number },
): RolloutResult | null {
  if (!rolloutEnabled || candidates.length === 0) return null;
  stats.calls++;
  const pool = buildUnseenPool(info);
  if (!pool) {
    stats.nullReturns++;
    return null;
  }
  const passMargin = opts?.passMargin ?? 0.05;

  const opp0 = info.opponents[0].cardCount;
  const start = Date.now();
  const wins = candidates.map(() => 0);
  let done = 0;
  for (let s = 0; s < SAMPLES; s++) {
    if (done > 0 && Date.now() - start > TIME_BUDGET_MS) break; // 时间预算
    const shuffled = shuffle(pool);
    const oppA = shuffled.slice(0, opp0);
    const oppB = shuffled.slice(opp0);
    for (let i = 0; i < candidates.length; i++) {
      wins[i] += simulate(info, oppA, oppB, { play: candidates[i] });
      stats.sims++;
    }
    done++;
  }
  if (done === 0) return null;
  stats.evaluated += candidates.length;
  const rates = wins.map((w) => w / done);

  let best = 0;
  let bestAdj = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const adj = rates[i] + (candidates[i] === null ? -passMargin : 0);
    if (adj > bestAdj) { bestAdj = adj; best = i; }
  }
  return { pick: candidates[best], rates };
}
