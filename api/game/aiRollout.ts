// AI 前瞻模拟评估器（Monte Carlo rollout）。参考 DouZero 的逐动作评估思路，
// 本文件是独立实现的采样搜索，并非 DouZero 神经网络或训练算法的移植。
// DouZero 的 DeepAgent 对每个合法动作（含 pass）用包含「对手手牌、对手剩余牌数、已出牌、
// 出牌历史」的局面特征计算 Q(s,a)，再取最优；其智能来自预训练神经网络（本仓库不含权重）。
// 此处以无网络的方式近似同一框架：
//   1. 由记牌器（cardTracker）+ 自己手牌推断「未见牌池」；
//   2. 蒙特卡洛采样：把未见牌按对手剩余张数随机分配，模拟「对手手牌」（对应 DouZero 的
//      other_hand_cards 特征）；同一批采样评估所有候选（公共随机数，降低方差）；
//   3. 对每个候选动作，用轻量贪心策略自对弈模拟到终局，统计胜率（对应 Q 值估计）；
//   4. 取胜率最高的动作为 master 难度的出牌选择。
// 模拟使用与实际模式一致的合法动作，时间预算在完整的一批候选完成后检查。
import type { Card, GameMode, Play, Seat } from '@shared/types';
import { createDeck, shuffle, countByRank, groupByRank } from './cards';
import { aiActions } from './aiActions';
import { usesPacketDeal } from '@shared/gameModes';

export interface RolloutInfo {
  mode?: GameMode;
  hand: Card[];                                   // 决策者手牌
  seat: Seat;
  landlordSeat: Seat;
  opponents: Array<{ seat: Seat; cardCount: number }>; // 另外两家（包含队友）
  cardTracker: Map<number, number>;               // rank -> 已出张数
  lastValidPlay: Play | null;
  lastPlaySeat: Seat | null;
  laiziRanks?: number[];
  multiBomb?: boolean;
  passCount: number;                              // 当前连续 pass 数（决策者行动前）
}

const SAMPLES = 16;          // 对手手牌采样次数
const MAX_STEPS = 300;      // 单次模拟步数上限（防死循环）
const TIME_BUDGET_MS = 200; // 单次决策的模拟时间预算

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
 * 只使用自己手牌及已出牌计数，不读取真实的其他玩家手牌。
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

// 模拟同样使用实际模式规则；缓存跨候选复用，不读取真实对手手牌。
function simulationPlay(info: RolloutInfo, hands: Card[][], seat: number, last: Play | null,
  lastSeat: number | null, cache: Map<string, Play[]>): Play | null {
  const hand = hands[seat];
  const key = hand.map(c => c.id).sort().join(',') + ':' +
    (last ? `${last.type}:${last.mainRank}:${last.length}:${!!last.isLaiziBomb}` : '-');
  let actions = cache.get(key);
  if (!actions) {
    actions = aiActions(hand, last, info.laiziRanks, info.multiBomb);
    cache.set(key, actions);
  }
  const finish = actions.find(p => p.cards.length === hand.length);
  if (finish) return finish;
  const sameTeam = (s: number) => (s === info.landlordSeat) === (seat === info.landlordSeat);
  if (last && lastSeat !== null && sameTeam(lastSeat)) return null;
  let enemyMin = 99;
  for (let s = 0; s < 3; s++) if (!sameTeam(s)) enemyMin = Math.min(enemyMin, hands[s].length);
  const counts = countByRank(hand);
  let best: Play | null = null;
  let bestScore = -Infinity;
  for (const p of actions) {
    let score = p.cards.length * (last ? 2 : 8) - p.mainRank * 0.6;
    for (const [rank, n] of countByRank(p.cards)) {
      const total = counts.get(rank)!;
      if (total === 4 && n < 4) score -= enemyMin <= 2 ? 8 : 45;
      else if (n < total) score -= 5;
    }
    if (counts.has(16) && counts.has(17) && p.type !== 'rocket' && p.cards.some(c => c.rank >= 16)) score -= 35;
    if (isBombP(p)) score -= enemyMin <= 2 || hand.length - p.cards.length <= 2 ? 0 : 32;
    if (enemyMin === 1 && p.type === 'single') score += last ? p.mainRank * 10 : -90 + p.mainRank * 4;
    if (enemyMin === 2 && !last && p.type === 'pair') score -= 20;
    if (score > bestScore) { best = p; bestScore = score; }
  }
  if (last && best && isBombP(best) && enemyMin > 4 && hand.length - best.cards.length > 3) return null;
  return best;
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
  first: { play: Play | null }, cache: Map<string, Play[]>,
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
    const play = simulationPlay(info, hands, cur, last, lastSeat, cache);
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
  const landlordLeft = hands[info.landlordSeat].length;
  const farmerMin = Math.min(...hands.filter((_, seat) => seat !== info.landlordSeat).map(h => h.length));
  if (landlordLeft === farmerMin) return 0.5;
  const landlordAhead = landlordLeft < farmerMin;
  return landlordAhead === (info.seat === info.landlordSeat) ? 0.75 : 0.25;
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
  const cache = new Map<string, Play[]>();
  for (let s = 0; s < SAMPLES; s++) {
    if (done > 0 && Date.now() - start > TIME_BUDGET_MS) break; // 时间预算
    let shuffled = shuffle(pool);
    if (info.mode && usesPacketDeal(info.mode) && s % (info.mode === 'laizi_unshuffled' ? 4 : 2) === 0) {
      // 不洗牌更常出现整组牌；混合均匀/聚类采样，避免确信对手必有炸弹。
      const a: Card[] = [], b: Card[] = [];
      for (const group of shuffle([...groupByRank(pool).values()])) {
        const roomA = opp0 - a.length, roomB = pool.length - opp0 - b.length;
        const preferA = Math.random() < roomA / (roomA + roomB);
        const first = preferA ? a : b, second = preferA ? b : a;
        const capacity = preferA ? roomA : roomB;
        first.push(...group.slice(0, capacity));
        second.push(...group.slice(capacity));
      }
      shuffled = [...a, ...b];
    }
    const oppA = shuffled.slice(0, opp0);
    const oppB = shuffled.slice(opp0);
    for (let i = 0; i < candidates.length; i++) {
      wins[i] += simulate(info, oppA, oppB, { play: candidates[i] }, cache);
      stats.sims++;
    }
    done++;
  }
  if (done < 4) return null; // 样本过少时使用稳定的结构评分，避免单次随机结果支配决策。
  stats.evaluated += candidates.length;
  const rates = wins.map((w) => (w + 2) / (done + 4)); // 向中性先验收缩小样本胜率

  let best = 0;
  let bestAdj = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const adj = rates[i] + (candidates[i] === null ? -passMargin : 0);
    if (adj > bestAdj) { bestAdj = adj; best = i; }
  }
  return { pick: candidates[best], rates };
}
