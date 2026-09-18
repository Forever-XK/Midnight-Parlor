// AI 决策引擎 —— 叫分与出牌策略（拟人化）
// 权重体系与最优拆牌移植自宽立斗地主 AI（https://github.com/ZhouWeikuan/DouDiZhu）：
//   - 牌型权重公式（厌恶度 bad → 权重 power）
//   - p(hand) = max(牌型权重 + p(剩余手牌))，从最大面值提取 + 计数缓存
//   - 出牌选择：让出牌后「牌型权重 + 剩余手牌权重」最大化
// 并保留角色定位（农民配合/地主压制）、报单压制、炸弹时机、记牌器等拟人规则。
// 高手难度额外接入 aiRollout（决策框架参考 rlcard-showdown-master / DouZero）：
// 对候选动作做蒙特卡洛前瞻模拟，估计胜率后择优。
import type { Card, Difficulty, Play, Role, Seat } from '@shared/types';
import { findBeatingPlays, findBeatingPlaysWithLaizi, type IdentifyOptions } from './rules';
import { evaluateHand, estimateRounds } from './handAnalyzer';
import { playPower, planHand, planGroupsToPlays } from './powerEvaluator';
import { rolloutPick, type RolloutInfo } from './aiRollout';
import { countByRank, groupByRank } from './cards';

export interface AIContext {
  hand: Card[];
  seat: Seat;
  role: Role;
  landlordSeat: Seat;
  players: Array<{ seat: Seat; cardCount: number; role: Role }>;
  lastValidPlay: Play | null;
  lastPlaySeat: Seat | null;
  difficulty: Difficulty;
  cardTracker: Map<number, number>; // rank -> 已出张数
  laiziRanks?: number[]; // 癞子点数列表（癞子/天地癞子模式）
  multiBomb?: boolean;   // 天地癞子模式：允许四张及以上同点数组成炸弹
  passCount?: number;    // 当前连续 pass 数（决策者行动前，rollout 模拟需要）
}

export interface BidContext {
  hand: Card[];
  seat: Seat;
  currentHigh: number;
  difficulty: Difficulty;
  isFirstBidder: boolean;
}

// ===== 拟人化随机工具 =====
function chance(p: number): boolean {
  return Math.random() < p;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function sortByRank(plays: Play[]): Play[] {
  return [...plays].sort((a, b) => a.mainRank - b.mainRank);
}
function isBombPlay(p: Play): boolean {
  return p.type === 'bomb' || p.type === 'rocket';
}
// 从手牌移除一组牌
function minus(hand: Card[], cards: Card[]): Card[] {
  const ids = new Set(cards.map((c) => c.id));
  return hand.filter((c) => !ids.has(c.id));
}
// 出牌整体分 = 牌型自身权重 + 剩余手牌最优拆牌权重（宽立 AI 的评估原则）
function totalScore(hand: Card[], cand: Play): number {
  return playPower(cand) + planHand(minus(hand, cand.cards)).power;
}

// 候选牌型中使用癞子牌的张数（癞子模式下癞子可当任意点数，按实际用出的癞子计数）
function laiziCount(play: Play, laiziRanks?: number[]): number {
  if (!laiziRanks || laiziRanks.length === 0) return 0;
  const set = new Set(laiziRanks);
  return play.cards.reduce((n, c) => n + (set.has(c.rank) ? 1 : 0), 0);
}

// 各难度的“失误率”（模仿人类的非理性出牌）
const BLUNDER_RATE: Record<Difficulty, number> = { casual: 0.25, standard: 0.08, master: 0.02 };

// 癞子接牌惩罚：每使用一张癞子牌扣除的权重（慎用癞子，以最少癞子达成最优解）
const LAIZI_PENALTY = 60;

// ===== rollout 前瞻评估（高手难度，框架参考 DouZero：枚举候选 → 逐一评估价值）=====

/** 由 AIContext 构造 rollout 所需的信息集（对应 DouZero 的 infoset） */
function toRolloutInfo(ctx: AIContext): RolloutInfo {
  // 未见牌池须分给「除自己外的两家」（含队友）——模拟器内部按 landlordSeat 区分敌我
  const opponents = ctx.players
    .filter((p) => p.seat !== ctx.seat)
    .map((p) => ({ seat: p.seat, cardCount: p.cardCount }));
  return {
    hand: ctx.hand,
    seat: ctx.seat,
    landlordSeat: ctx.landlordSeat,
    opponents,
    cardTracker: ctx.cardTracker,
    lastValidPlay: ctx.lastValidPlay,
    lastPlaySeat: ctx.lastPlaySeat,
    passCount: ctx.passCount ?? 0,
  };
}

/** 带翼牌型集合 */
const WINGED_TYPES = new Set([
  'triple_single', 'triple_pair', 'airplane_single', 'airplane_pair',
  'four_two_single', 'four_two_pair',
]);

/**
 * 跟牌候选的翼牌重选（所有难度生效）。
 * findBeatingPlays 生成带翼候选时只取「第一个可用 rank」做翼，容易拆散对子/三张
 * （例如 555+66 会带一张 6 留下孤张）。此处参考宽立 pickWings 原则重选：
 * 单翼优先落单牌、其次拆小对；对翼只取现成对子；均不拆三张与炸弹。
 * 癞子组合（含癞子充当点数）不重选，避免破坏癞子牌型语义。
 */
function reWingPlay(play: Play, hand: Card[], laiziRanks?: number[]): Play {
  if (!WINGED_TYPES.has(play.type)) return play;
  if (laiziRanks && laiziRanks.length > 0 && play.cards.some((c) => laiziRanks.includes(c.rank))) {
    return play;
  }
  let body: Array<[number, number]>;
  let wingKind: 1 | 2;
  let wingNeed: number;
  if (play.type === 'triple_single') {
    body = [[play.mainRank, 3]]; wingKind = 1; wingNeed = 1;
  } else if (play.type === 'triple_pair') {
    body = [[play.mainRank, 3]]; wingKind = 2; wingNeed = 1;
  } else if (play.type === 'four_two_single') {
    body = [[play.mainRank, 4]]; wingKind = 1; wingNeed = 2;
  } else if (play.type === 'four_two_pair') {
    body = [[play.mainRank, 4]]; wingKind = 2; wingNeed = 2;
  } else {
    // 飞机带翼：主体 = mainRank-length+1 .. mainRank 各 3 张
    const lo = play.mainRank - play.length + 1;
    body = [];
    for (let r = lo; r <= play.mainRank; r++) body.push([r, 3]);
    wingKind = play.type === 'airplane_single' ? 1 : 2;
    wingNeed = play.length;
  }
  const counts = countByRank(hand);
  for (const [r, n] of body) {
    if ((counts.get(r) || 0) < n) return play; // 主体不全（不应发生），保持原样
  }
  const bodyRanks = new Set(body.map(([r]) => r));
  const rest = new Map<number, number>();
  for (const [r, c] of counts) {
    const used = body.filter(([br]) => br === r).reduce((s, [, n]) => s + n, 0);
    if (c - used > 0) rest.set(r, c - used);
  }
  const groups = groupByRank(hand);
  const take = (r: number, n: number): Card[] => (groups.get(r) ?? []).slice(0, n);
  const wings: Card[] = [];
  if (wingKind === 1) {
    // 单翼：先取落单（count===1），再拆对（count===2），不拆三张/炸弹；3~K 优先，2/王兜底
    for (const [lo, hi] of [[3, 13], [14, 17]] as const) {
      for (const pass of [1, 2] as const) {
        for (const r of [...rest.keys()].sort((a, b) => a - b)) {
          if (r < lo || r > hi || bodyRanks.has(r)) continue;
          if (rest.get(r) === pass) wings.push(take(r, 1)[0]);
          if (wings.length >= wingNeed) break;
        }
        if (wings.length >= wingNeed) break;
      }
      if (wings.length >= wingNeed) break;
    }
  } else {
    // 对翼：只取现成对子（3~K 优先，A/2 兜底），不拆三张/炸弹
    for (const [lo, hi] of [[3, 13], [14, 15]] as const) {
      for (const r of [...rest.keys()].sort((a, b) => a - b)) {
        if (r < lo || r > hi || bodyRanks.has(r)) continue;
        if (rest.get(r)! >= 2) wings.push(...take(r, 2));
        if (wings.length >= wingNeed * 2) break;
      }
      if (wings.length >= wingNeed * 2) break;
    }
  }
  const needCards = wingKind === 1 ? wingNeed : wingNeed * 2;
  if (wings.length !== needCards) return play; // 凑不齐更好的翼，保持原样
  const bodyCards = body.flatMap(([r, n]) => take(r, n));
  return { ...play, cards: [...bodyCards, ...wings] };
}

// ===== 记牌器工具（高手难度使用） =====

// 某点数在“别人手里”的剩余张数
function outsideCount(tracker: Map<number, number>, rank: number, hand: Card[]): number {
  const total = rank >= 16 ? 1 : 4;
  const played = tracker.get(rank) || 0;
  const mine = hand.filter((c) => c.rank === rank).length;
  return total - played - mine;
}

/**
 * 该牌型打出后是否基本无人能压（更大的同型牌、炸弹、火箭都已出尽）。
 */
function isUnbeatable(tracker: Map<number, number>, play: Play, hand: Card[]): boolean {
  if (play.type === 'rocket') return true;
  if (play.type === 'single' || play.type === 'pair' || play.type === 'triple') {
    const need = play.type === 'single' ? 1 : play.type === 'pair' ? 2 : 3;
    for (let r = play.mainRank + 1; r <= 15; r++) {
      if (outsideCount(tracker, r, hand) >= need) return false;
    }
    if (play.type === 'single') {
      if (outsideCount(tracker, 16, hand) >= 1) return false;
      if (outsideCount(tracker, 17, hand) >= 1) return false;
    }
  } else {
    // 顺子/连对/飞机：顶点没到 A 视为可能被压
    if (play.mainRank < 14) return false;
  }
  for (let r = 3; r <= 15; r++) {
    if (outsideCount(tracker, r, hand) >= 4) return false;
  }
  if (outsideCount(tracker, 16, hand) >= 1 && outsideCount(tracker, 17, hand) >= 1) return false;
  return true;
}

// 判断两个座位是否同队
function isTeammate(seat: Seat, other: Seat, landlordSeat: Seat): boolean {
  if (seat === landlordSeat || other === landlordSeat) return seat === other;
  return true; // 两个都是农民
}

// 座位循环下一位
function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 3) as Seat;
}

// 农民相对地主的位置（宽立 AI 的「角色定位」核心）：
//   'goalkeeper' = 上家（守门员），出牌后地主紧跟其后，负责「顶牌」防止地主走小牌；
//   'follower'   = 下家（进攻手），紧跟地主出牌，负责走小牌、接守门牌、送队友。
function peasantPosition(seat: Seat, landlordSeat: Seat): 'goalkeeper' | 'follower' {
  return nextSeat(landlordSeat) === seat ? 'follower' : 'goalkeeper';
}

/**
 * AI 叫分决策。返回 0（不叫）/1/2/3
 */
export function decideBid(ctx: BidContext): number {
  const score = evaluateHand(ctx.hand);
  const { difficulty, currentHigh, isFirstBidder } = ctx;

  const thresholds = {
    casual: { bid3: 55, bid2: 38, bid1: 25 },
    standard: { bid3: 60, bid2: 42, bid1: 28 },
    master: { bid3: 65, bid2: 45, bid1: 30 },
  };
  const th = thresholds[difficulty];

  let adjusted = score;
  if (difficulty === 'casual') adjusted += (Math.random() - 0.5) * 16;
  else if (difficulty === 'standard') adjusted += (Math.random() - 0.5) * 8;

  // 高手难度：底牌预期加分（3张底牌平均约8分）
  const expectedBonus = difficulty === 'master' ? 8 : 0;

  // 已有人叫分时，跟叫需要更好的牌（人类不会轻易抢牌）
  const raiseBar = currentHigh > 0 ? 5 : 0;

  if (adjusted + expectedBonus >= th.bid3 + raiseBar && currentHigh < 3) return 3;
  if (adjusted >= th.bid2 + raiseBar && currentHigh < 2) return 2;
  if (adjusted >= th.bid1 + raiseBar && currentHigh < 1) return 1;

  // 若是最后一个叫分且无人叫，且有基本牌力，勉强叫1分
  if (isFirstBidder === false && currentHigh === 0 && score >= 20) return 1;

  return 0;
}

/**
 * AI 出牌决策。返回 Play（出牌）或 null（不出）
 */
export function decidePlay(ctx: AIContext): Play | null {
  const { hand, lastValidPlay } = ctx;

  if (hand.length === 0) return null;

  if (!lastValidPlay) {
    return decideLeading(ctx);
  }
  return decideFollowing(ctx);
}

/**
 * 领出策略：基于最优拆牌方案。
 * 常规阶段先出「厌恶度最高」（权重最低）的组脱手，炸弹/控制牌留后；
 * 残局（≤2组）先出控制力最强的一手，保证最后一手能走。
 */
function decideLeading(ctx: AIContext): Play {
  const { hand, seat, role, players, difficulty, cardTracker } = ctx;
  if (hand.length === 0) {
    return { type: 'single', cards: [hand[0]], mainRank: hand[0].rank, length: 1 };
  }
  // 最优拆牌
  const plan = planHand(hand);
  const groups = planGroupsToPlays(hand, plan.groups);
  if (groups.length === 1) return groups[0];

  const bombs = sortByRank(groups.filter(isBombPlay));
  const normals = groups.filter((p) => !isBombPlay(p));
  const singles = sortByRank(normals.filter((p) => p.type === 'single'));
  const pairs = sortByRank(normals.filter((p) => p.type === 'pair'));

  const opponents = players.filter((p) => p.seat !== seat && p.role !== role);
  const teammate = players.find((p) => p.seat !== seat && p.role === role) ?? null;
  const minOpponentCards = opponents.length > 0 ? Math.min(...opponents.map((o) => o.cardCount)) : 99;

  // ===== 农民配合：队友只剩1-2张时送小牌 =====
  if (teammate && teammate.cardCount <= 2 && minOpponentCards > 2) {
    if (teammate.cardCount === 1 && singles.length > 0 && singles[0].mainRank <= 13) return singles[0];
    if (teammate.cardCount === 2 && pairs.length > 0 && pairs[0].mainRank <= 13) return pairs[0];
  }

  // ===== 对手报单：避免领出小单张喂牌 =====
  if (opponents.some((o) => o.cardCount === 1)) {
    const combos = normals.filter((p) => p.type !== 'single' && p.type !== 'pair');
    if (combos.length > 0) {
      // 组合牌里出权重最低的
      return combos.reduce((a, b) => (playPower(b) < playPower(a) ? b : a));
    }
    if (pairs.length > 0) return pairs[0];
    if (singles.length > 0) return singles[singles.length - 1]; // 只能出单就出最大的
  }

  // ===== 对手快赢（<=3张）：出最强的一手压制 =====
  if (minOpponentCards <= 3) {
    if (normals.length > 0) {
      return normals.reduce((a, b) => (playPower(b) > playPower(a) ? b : a));
    }
    return bombs[0];
  }

  // ===== 残局（只剩2组）：先出控制力强的，最后一手保走 =====
  if (groups.length <= 2) {
    return groups.reduce((a, b) => (playPower(b) > playPower(a) ? b : a));
  }

  // ===== 高手 + 快终局：优先出（记牌判断）无人能压的牌 =====
  if (difficulty === 'master' && groups.length <= 4) {
    const unb = normals.find((p) => isUnbeatable(cardTracker, p, hand));
    if (unb) return unb;
  }

  // ===== 常规领出：出权重最低（最想脱手）的一组，控制牌留后 =====
  if (normals.length > 0) {
    const sorted = [...normals].sort((a, b) => playPower(a) - playPower(b) || a.mainRank - b.mainRank);
    // 高手：对权重最低的几组做 rollout 前瞻，选模拟胜率最高的一手（DouZero 式逐动作评估）
    if (difficulty === 'master' && sorted.length > 1) {
      const cands = sorted.slice(0, Math.min(5, sorted.length));
      const res = rolloutPick(toRolloutInfo(ctx), cands);
      if (res && res.pick) return res.pick;
    }
    // 拟人化：休闲从前3随机选，标准偶尔出次优
    if (difficulty === 'casual' && sorted.length > 1 && chance(0.3)) {
      return pick(sorted.slice(0, Math.min(3, sorted.length)));
    }
    if (difficulty === 'standard' && sorted.length > 1 && chance(BLUNDER_RATE.standard)) {
      return sorted[1];
    }
    return sorted[0];
  }

  // 只剩炸弹：出最小的开路
  return bombs[0];
}

/**
 * 跟牌策略：候选牌按「牌型权重 + 剩余手牌权重」最大化选择，
 * 叠加角色定位（队友/对手）、报单压制、大牌谨慎、炸弹时机等拟人规则。
 */
function decideFollowing(ctx: AIContext): Play | null {
  const { hand, seat, role, lastPlaySeat, landlordSeat, players, lastValidPlay, difficulty, cardTracker, laiziRanks, multiBomb } = ctx;
  if (!lastValidPlay || lastPlaySeat === null) return null;

  const opts: IdentifyOptions | undefined = multiBomb ? { multiBomb } : undefined;
  const rawBeats = laiziRanks && laiziRanks.length > 0
    ? findBeatingPlaysWithLaizi(hand, lastValidPlay, laiziRanks, opts)
    : findBeatingPlays(hand, lastValidPlay, opts);
  if (rawBeats.length === 0) return null; // 无法压过
  // 翼牌重选：避免带翼时拆散对子/三张/炸弹（癞子组合保持原样）
  const beats = rawBeats.map((b) => reWingPlay(b, hand, laiziRanks));

  const lastIsTeammate = isTeammate(seat, lastPlaySeat, landlordSeat);
  const lastPlayerCards = players.find((p) => p.seat === lastPlaySeat)?.cardCount ?? 99;

  const opponents = players.filter((p) => p.seat !== seat && p.role !== role);
  const minOpponentCards = opponents.length > 0 ? Math.min(...opponents.map((o) => o.cardCount)) : 99;

  // ===== 王炸保护：非必要不拆王，保留火箭作后手 =====
  const hasRocket = hand.some((c) => c.rank === 16) && hand.some((c) => c.rank === 17);
  // 唯一允许拆王出单张的紧急情况：对手报单或快赢，必须用王压死
  const mustBreakRocket =
    minOpponentCards <= 2 ||
    (lastValidPlay.type === 'single' && opponents.some((o) => o.cardCount === 1));

  let normalBeats = beats.filter((b) => !isBombPlay(b));
  if (hasRocket && !mustBreakRocket && lastValidPlay.type === 'single') {
    // 有其他单牌可压时，不拆王；仅当只能靠王压时才保留单王候选
    const kept = normalBeats.filter((b) => !(b.type === 'single' && b.mainRank >= 16));
    if (kept.length > 0) normalBeats = kept;
  }
  const bombBeats = sortByRank(beats.filter(isBombPlay));

  const currentRounds = estimateRounds(hand);

  // 拟人化选择：默认按整体权重最大化；preferBig 时直接出最大牌（对手报单场景）
  // 癞子模式下扣除「癞子使用惩罚」，优先用更少癞子牌达到最优解
  // 高手难度：先用 rollout 前瞻模拟在 top 候选中择优（DouZero 式逐动作评估）
  const chooseHuman = (candidates: Play[], preferBig = false): Play => {
    const scored = candidates.map((p) => ({
      p,
      s: totalScore(hand, p) - LAIZI_PENALTY * laiziCount(p, laiziRanks),
    }));
    scored.sort((a, b) => {
      if (preferBig) return b.p.mainRank - a.p.mainRank;
      if (b.s !== a.s) return b.s - a.s;
      return a.p.mainRank - b.p.mainRank;
    });
    if (scored.length === 1) return scored[0].p;
    if (difficulty === 'master' && !preferBig) {
      const top = scored.slice(0, Math.min(3, scored.length)).map((x) => x.p);
      const res = rolloutPick(toRolloutInfo(ctx), top);
      if (res && res.pick) return res.pick;
    }
    // 休闲难度偶尔手滑乱选；标准偶尔出次优
    if (difficulty === 'casual' && chance(0.3)) {
      return pick(scored.slice(0, Math.min(3, scored.length))).p;
    }
    if (difficulty === 'standard' && chance(0.1)) {
      return (scored[1] ?? scored[0]).p;
    }
    return scored[0].p;
  };

  // ===== 队友出的牌 =====
  if (lastIsTeammate) {
    // 队友快赢了（剩余≤2张），成人之美让牌送其走
    if (lastPlayerCards <= 2) return null;
    // 队友炸弹/火箭，绝不压
    if (isBombPlay(lastValidPlay)) return null;
    // 队友已出大牌（A/2/王），足以控场，不抢队友风头
    if (lastValidPlay.mainRank >= 14) return null;

    // 地主快赢了：无论队友出什么都要接管出牌权，压过并抢回主动权
    if (minOpponentCards <= 3) {
      if (normalBeats.length > 0) return chooseHuman(normalBeats);
      if (bombBeats.length > 0) return bombBeats[0];
      return null;
    }

    // 队友出的是小/中牌：按自身角色定位决定「管牌」还是「让牌」
    const pos = peasantPosition(seat, landlordSeat);
    if (pos === 'goalkeeper') {
      // 上家（守门员）：队友（下家）领出小牌后，地主紧跟其后准备捡漏，
      // 用中高牌（J~A）「顶」上去，护住队友、逼地主抬价，实现两人交替配合。
      const shoumenBeats = normalBeats.filter((b) => b.mainRank >= 11 && b.mainRank <= 14);
      if (shoumenBeats.length > 0) return chooseHuman(shoumenBeats);
      return null;
    }
    // 下家：地主夹在队友（上家）与自己之间；地主已让队友的牌通过，
    // 保留队友出牌权即可（守门牌通常较大，接不住时就放行）。
    return null;
  }

  // ===== 对手出的牌 =====
  // 对手报单且出的是单张：出最大的单压死（经典人类操作）
  if (lastValidPlay.type === 'single' && opponents.some((o) => o.cardCount === 1) && normalBeats.length > 0) {
    return chooseHuman(normalBeats, true);
  }

  // 对手快赢（<=2张）：不惜代价压制
  if (minOpponentCards <= 2) {
    if (normalBeats.length > 0) {
      return chooseHuman(normalBeats, lastValidPlay.type === 'single');
    }
    if (bombBeats.length > 0) return bombBeats[0];
    return null;
  }

  // 对手快赢（<=3张）：能压就压
  if (minOpponentCards <= 3) {
    if (normalBeats.length > 0) return chooseHuman(normalBeats);
    if (bombBeats.length > 0 && (lastValidPlay.mainRank >= 14 || currentRounds <= 3)) return bombBeats[0];
    return null;
  }

  // 我只剩两组：拼大牌抢出牌权（人类残局直觉）
  if (currentRounds <= 2 && normalBeats.length > 0) {
    return chooseHuman(normalBeats, true);
  }

  // ===== 上家守门员：地主领出小单/小对时，用中高牌「顶」住，不让地主轻松走小牌 =====
  if (
    role === 'peasant' &&
    peasantPosition(seat, landlordSeat) === 'goalkeeper' &&
    (lastValidPlay.type === 'single' || lastValidPlay.type === 'pair') &&
    lastValidPlay.mainRank < 11
  ) {
    const shoumenBeats = normalBeats.filter((b) => b.mainRank >= 11 && b.mainRank <= 14);
    // 优先选不增加手数（不拆散好牌型）的守门牌；地主残血时允许拆牌硬顶
    const nonBreaking = shoumenBeats.filter((b) => estimateRounds(minus(hand, b.cards)) <= currentRounds);
    const pool = nonBreaking.length > 0 ? nonBreaking : minOpponentCards <= 6 ? shoumenBeats : [];
    if (pool.length > 0) return chooseHuman(pool);
  }

  // ===== 常规跟牌 =====
  if (normalBeats.length > 0) {
    const smallest = sortByRank(normalBeats)[0];

    // 高手：rollout 前瞻统一裁决「压哪手/是否忍」（对应 DouZero 的 legal_actions
    // 同时含出牌与 pass，逐一评估后取价值最高者；pass 有安全边际，避免过度保守）
    if (difficulty === 'master') {
      const byScore = [...normalBeats].sort(
        (a, b) => totalScore(hand, b) - totalScore(hand, a) || a.mainRank - b.mainRank,
      );
      const cands: Array<Play | null> = byScore.slice(0, Math.min(3, byScore.length));
      cands.push(null);
      const res = rolloutPick(toRolloutInfo(ctx), cands, { passMargin: 0.05 });
      if (res) return res.pick;
    }

    // 小牌（<A）：按权重出（宁可出大的也不拆散好牌型）
    if (smallest.mainRank < 14) return chooseHuman(normalBeats);

    // A：多数情况愿意出
    if (smallest.mainRank === 14) {
      if (minOpponentCards <= 8 || difficulty !== 'master' || lastValidPlay.mainRank >= 14) {
        return chooseHuman(normalBeats);
      }
    }

    // 2/王：更谨慎——对手牌少、我快赢、或（高手）确认无人能压时才出
    if (smallest.mainRank >= 15) {
      const biggest = sortByRank(normalBeats).pop()!;
      const safe = difficulty === 'master' && isUnbeatable(cardTracker, biggest, hand);
      if (minOpponentCards <= 6 || currentRounds <= 3 || safe) {
        return chooseHuman(normalBeats);
      }
    }

    // 忍住不出大牌
    return null;
  }

  // ===== 无普通牌型可压：炸弹时机（人类不轻易炸） =====
  if (bombBeats.length > 0) {
    if (lastValidPlay.mainRank >= 15 && (minOpponentCards <= 10 || currentRounds <= 4)) return bombBeats[0];
    if (currentRounds <= 3) return bombBeats[0];
    if (minOpponentCards <= 5) return bombBeats[0];
    if (difficulty === 'casual' && chance(0.06)) return bombBeats[0];
    return null;
  }

  return null;
}

/**
 * 获取提示牌（玩家用）。基于最优拆牌与权重排序（宽立 AI 的提示排序原则：
 * 优先推荐「出完后剩余手牌权重最大」的牌）。
 */
export function getHint(hand: Card[], lastValidPlay: Play | null, laiziRanks?: number[], multiBomb?: boolean): Card[] | null {
  if (hand.length === 0) return null;

  const opts: IdentifyOptions | undefined = multiBomb ? { multiBomb } : undefined;

  // ===== 跟牌提示 =====
  if (lastValidPlay) {
    const beats = laiziRanks && laiziRanks.length > 0
      ? findBeatingPlaysWithLaizi(hand, lastValidPlay, laiziRanks, opts)
      : findBeatingPlays(hand, lastValidPlay, opts);
    if (beats.length === 0) return null;
    const normal = beats.filter((b) => !isBombPlay(b));
    const pool = normal.length > 0 ? normal : beats;
    const scored = pool.map((p) => ({ p, s: totalScore(hand, p) }));
    scored.sort((a, b) => b.s - a.s || a.p.mainRank - b.p.mainRank);
    return scored[0].p.cards;
  }

  // ===== 领出提示：最优拆牌方案中最想脱手的一组 =====
  const plan = planHand(hand);
  const groups = planGroupsToPlays(hand, plan.groups);
  if (groups.length === 0) return null;
  if (groups.length === 1) return groups[0].cards;

  const normals = groups.filter((p) => !isBombPlay(p));
  const pool = normals.length > 0 ? normals : groups;
  // 残局（2组）：先出强的一手
  if (groups.length <= 2) {
    return pool.reduce((a, b) => (playPower(b) > playPower(a) ? b : a)).cards;
  }
  const sorted = [...pool].sort((a, b) => playPower(a) - playPower(b) || a.mainRank - b.mainRank);
  return sorted[0].cards;
}
