// AI 单步推进（联机调度用）—— 基于 InternalGame 直接复用 gameService 的 processBid/executePlay 等私有实现不可行，
// 因此这里提供「小步走」的包装：通过 playerBid / playerPlay / playerPass 的等价逻辑，但每次仅推进一步。
// 为避免与 gameService 内部函数重复，我们用 InternalGame 的副本并复用同一份函数。
import type {
  AIEvent, Card, GameMode, GameState, Play, Seat, Snapshot,
} from '@shared/types';
import { decideBid, decidePlay, type AIContext } from './aiEngine';
import { identifyPlay, identifyPlayWithLaizi, canBeat, type IdentifyOptions } from './rules';
import { sortCards, pickDistinctLaiziRank } from './cards';
import { getGame, saveGame, toPublicState, type InternalGame } from './store';

// ============================================================
// 以下是从 gameService.ts 同步复制的最小实现（内部函数无法跨文件导出）
// 保证 WS 调度能单步推进，逻辑与 gameService 一致
// ============================================================

function makeAIContext(game: InternalGame, seat: Seat): AIContext {
  const laiziRanks = laiziRanksOf(game);
  return {
    hand: game.hands[seat],
    seat,
    role: game.roles[seat]!,
    landlordSeat: game.landlordSeat!,
    players: game.hands.map((h, s) => ({
      seat: s as Seat,
      cardCount: h.length,
      role: game.roles[s]!,
    })),
    lastValidPlay: game.lastValidPlay?.play ?? null,
    lastPlaySeat: game.lastValidPlay?.seat ?? null,
    difficulty: game.difficulty,
    cardTracker: game.cardTracker,
    laiziRanks,
    multiBomb: multiBombOf(game),
  };
}

function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 3) as Seat;
}
function laiziRanksOf(game: InternalGame): number[] {
  if (game.laiziRank) return [game.laiziRank];
  const ranks: number[] = [];
  if (game.tianLaiziRank) ranks.push(game.tianLaiziRank);
  if (game.diLaiziRank) ranks.push(game.diLaiziRank);
  return ranks;
}
function multiBombOf(game: InternalGame): boolean {
  return game.mode === 'tiandilaizi';
}
function laiziOpts(game: InternalGame): IdentifyOptions {
  return { multiBomb: multiBombOf(game) };
}
function emptyMultiplier(): import('@shared/types').Multiplier {
  return { base: 1, bid: 0, bombs: 0, spring: false, antiSpring: false, menzhua: false, total: 0 };
}
function delay(base: number, jitter: number): number {
  return base + Math.floor(Math.random() * jitter);
}
function bidDelay(): number { return delay(1600, 900); }
function playDelay(play: Play): number {
  if (play.type === 'bomb' || play.type === 'rocket') return delay(2200, 900);
  if (play.cards.length >= 5) return delay(1900, 700);
  return delay(1500, 800);
}
function passDelay(): number { return delay(1500, 700); }

function updateCardTracker(game: InternalGame, cards: Card[]): void {
  for (const c of cards) {
    game.cardTracker.set(c.rank, (game.cardTracker.get(c.rank) || 0) + 1);
  }
}

function assignLandlord(game: InternalGame, seat: Seat, bid: number): void {
  game.landlordSeat = seat;
  game.roles[seat] = 'landlord';
  for (let i = 0; i < 3; i++) {
    if (i !== seat) game.roles[i] = 'peasant';
  }
  game.hands[seat] = [...game.hands[seat], ...game.bottomCards];
  if (game.mode === 'tiandilaizi') {
    game.diLaiziRank = pickDistinctLaiziRank(game.tianLaiziRank);
    sortCards(game.hands[seat], game.tianLaiziRank);
  } else if (game.mode === 'menzhua') {
    sortCards(game.hands[seat]);
  } else {
    sortCards(game.hands[seat], game.laiziRank);
  }
  if (game.mode === 'menzhua') {
    game.revealedBottom = false;
  } else {
    game.revealedBottom = true;
  }
  game.multiplier.bid = bid;
  game.bidState = null;
}

function processBid(game: InternalGame, seat: Seat, bid: number): void {
  if (!game.bidState) return;
  const validBid = bid > game.bidState.highestBid ? bid : 0;
  game.bidState.bids.push({ seat, bid: validBid });
  game.bidState.bidCount++;
  if (validBid > game.bidState.highestBid) {
    game.bidState.highestBid = validBid;
    game.bidState.highestSeat = seat;
  }
  game.currentSeat = nextSeat(seat);
}

function finishBidding(game: InternalGame): void {
  if (!game.bidState) return;
  if (game.bidState.highestSeat === null || game.bidState.highestBid === 0) {
    if (game.bidRedealCount < 1) {
      // 不直接重发牌；为避免 WS 流程复杂化，强制指定 startSeat 地主 1 分（与 gameService 不同但满足在线节奏）
      assignLandlord(game, game.bidState.startSeat, 1);
      game.phase = 'playing';
      game.currentSeat = game.landlordSeat!;
      return;
    }
    assignLandlord(game, game.bidState.startSeat, 1);
  } else {
    assignLandlord(game, game.bidState.highestSeat!, game.bidState.highestBid);
  }
  game.phase = 'playing';
  game.currentSeat = game.landlordSeat!;
}

function finishGame(game: InternalGame, winnerSeat: Seat): void {
  const landlordWon = winnerSeat === game.landlordSeat;
  const m = game.multiplier;
  const peasantPlays = [0, 1, 2]
    .filter((s) => s !== game.landlordSeat)
    .reduce((sum, s) => sum + game.playCounts[s], 0);
  if (landlordWon && peasantPlays === 0) m.spring = true;
  if (!landlordWon && game.playCounts[game.landlordSeat!] <= 1) m.antiSpring = true;
  const bombMultiplier = Math.pow(2, m.bombs);
  m.total = m.base * m.bid * bombMultiplier * (m.spring ? 2 : 1) * (m.antiSpring ? 2 : 1) * (m.menzhua ? 2 : 1);
  const scores = [0, 0, 0];
  for (let s = 0; s < 3; s++) {
    if (s === game.landlordSeat) {
      scores[s] = landlordWon ? 2 * m.total : -2 * m.total;
    } else {
      scores[s] = landlordWon ? -m.total : m.total;
    }
  }
  game.result = { winner: landlordWon ? 'landlord' : 'peasant', landlordSeat: game.landlordSeat!, scores };
  game.phase = 'finished';
}

function executePlay(game: InternalGame, seat: Seat, play: Play): void {
  const ids = new Set(play.cards.map((c) => c.id));
  game.hands[seat] = game.hands[seat].filter((c) => !ids.has(c.id));
  game.lastPlay = { seat, play };
  game.lastValidPlay = { seat, play };
  game.seatLastPlays[seat] = play;
  game.passCount = 0;
  game.playCounts[seat]++;
  updateCardTracker(game, play.cards);
  if (play.type === 'bomb') game.multiplier.bombs++;
  if (play.type === 'rocket') game.multiplier.bombs++;
  if (game.hands[seat].length === 0) { finishGame(game, seat); return; }
  game.currentSeat = nextSeat(seat);
}

function executePass(game: InternalGame, seat: Seat): void {
  game.lastPlay = { seat, play: { type: 'single', cards: [], mainRank: 0 as any, length: 0 } };
  game.passCount++;
  if (game.passCount >= 2 && game.lastValidPlay) {
    game.currentSeat = game.lastValidPlay.seat;
    game.lastValidPlay = null;
    game.lastPlay = null;
    game.passCount = 0;
    game.seatLastPlays = [null, null, null];
  } else {
    game.currentSeat = nextSeat(seat);
  }
}

// ============================================================
// 对外：单步 AI 推进
// ============================================================

export interface StepResult {
  done: boolean;
  snapshots: Snapshot[];
  nextDelayMs?: number;
}

function isHumanSeat(game: InternalGame, seat: Seat): boolean {
  return game.humans[seat] ?? seat === 0;
}

// 由 gameId 推进一次 AI 叫分/闷抓选择；若当前回合不是 AI，则返回 done=true
export function stepAIBidOnceByGameId(gameId: string): StepResult & { viewerSeat?: Seat } {
  const game = getGame(gameId);
  if (!game) return { done: true, snapshots: [] };
  if (game.phase === 'menzhuaChoice') return stepAIMenzhuaOnceInternal(game, 0);
  return stepAIBidOnceInternal(game, 0);
}

function stepAIMenzhuaOnceInternal(game: InternalGame, viewerSeat: Seat): StepResult & { viewerSeat?: Seat } {
  const seat = game.currentSeat;
  if (isHumanSeat(game, seat)) return { done: true, snapshots: [] };
  if (seat !== game.mingCardSeat) return { done: true, snapshots: [] };

  const ctx = {
    hand: game.hands[seat],
    seat,
    currentHigh: 0,
    difficulty: game.difficulty,
    isFirstBidder: true,
  };
  const bidEstimate = decideBid(ctx);
  const choice: 'menzhua' | 'kanpai' = bidEstimate >= 2 ? 'menzhua' : 'kanpai';

  if (choice === 'menzhua') {
    assignLandlord(game, seat, 3);
    game.multiplier.menzhua = true;
    game.menzhuaDoubled = true;
    game.handRevealed = true;
    game.phase = 'playing';
    game.currentSeat = seat;
  } else {
    game.handRevealed = true;
    game.menzhuaPhase = 'kanpai';
    game.phase = 'bidding';
    game.currentSeat = seat;
    game.bidState = {
      currentBidder: seat,
      bids: [],
      highestBid: 0,
      highestSeat: null,
      startSeat: seat,
      bidCount: 0,
    };
  }

  const event: AIEvent = { seat, action: 'bid', value: choice === 'menzhua' ? 3 : 0, delay: bidDelay() };
  const snapshots: Snapshot[] = [
    { state: toPublicState(game, viewerSeat), event: { seat: game.currentSeat, action: 'turn', delay: 200 } },
    { state: toPublicState(game, viewerSeat), event },
  ];

  if (choice === 'menzhua' && game.phase === 'playing') {
    snapshots.unshift({ state: toPublicState(game, viewerSeat), event: { seat: game.currentSeat, action: 'turn', delay: 600 } });
  }

  saveGame(game);
  return {
    done: isHumanSeat(game, game.currentSeat) || (choice === 'menzhua' ? (game.phase as string) !== 'playing' : !game.bidState),
    snapshots,
    nextDelayMs: 700,
    viewerSeat,
  };
}

function stepAIBidOnceInternal(game: InternalGame, viewerSeat: Seat): StepResult & { viewerSeat?: Seat } {
  if (!game.bidState) return { done: true, snapshots: [] };
  const seat = game.currentSeat;
  if (isHumanSeat(game, seat)) return { done: true, snapshots: [] };

  const ctx = {
    hand: game.hands[seat],
    seat,
    currentHigh: game.bidState.highestBid,
    difficulty: game.difficulty,
    isFirstBidder: game.bidState.bidCount === 0,
  };
  const bid = decideBid(ctx);
  processBid(game, seat, bid);
  const event: AIEvent = { seat, action: 'bid', value: bid, delay: bidDelay() };
  const snapshots: Snapshot[] = [{ state: toPublicState(game, viewerSeat), event }];

  // 叫分结束条件
  if (game.bidState && (game.bidState.highestBid === 3 || game.bidState.bidCount >= 3)) {
    finishBidding(game);
    // 出牌前追加一条“地主底牌翻开”快照
    snapshots.unshift({ state: toPublicState(game, viewerSeat), event: { seat: game.currentSeat, action: 'turn', delay: 600 } });
    saveGame(game);
    return {
      done: isHumanSeat(game, game.currentSeat) || (game.phase as string) !== 'playing',
      snapshots,
      nextDelayMs: 700,
      viewerSeat,
    };
  }
  saveGame(game);
  const nextSe = game.currentSeat;
  return {
    done: isHumanSeat(game, nextSe),
    snapshots,
    nextDelayMs: 700,
    viewerSeat,
  };
}

// 出牌阶段单步
export function stepAIPlayOnceByGameId(gameId: string): StepResult & { viewerSeat?: Seat } {
  const game = getGame(gameId);
  if (!game) return { done: true, snapshots: [] };
  if ((game.phase as string) !== 'playing') return { done: true, snapshots: [] };
  const seat = game.currentSeat;
  if (isHumanSeat(game, seat)) return { done: true, snapshots: [] };
  const viewerSeat = 0;

  const ctx = makeAIContext(game, seat);
  const play = decidePlay(ctx);
  const snapshots: Snapshot[] = [];
  let event: AIEvent;
  if (play) {
    executePlay(game, seat, play);
    event = { seat, action: 'play', value: play, delay: playDelay(play) };
  } else {
    executePass(game, seat);
    event = { seat, action: 'pass', delay: passDelay() };
  }
  snapshots.push({ state: toPublicState(game, viewerSeat), event });
  saveGame(game);
  if ((game.phase as string) === 'finished') {
    return { done: true, snapshots, nextDelayMs: 1100, viewerSeat };
  }
  const nextSe = game.currentSeat;
  return {
    done: isHumanSeat(game, nextSe),
    snapshots,
    nextDelayMs: 1000,
    viewerSeat,
  };
}

// 通用入口：根据当前 phase 自动调度一步
export function stepAIONCE(gameId: string): StepResult & { viewerSeat?: Seat } {
  const game = getGame(gameId);
  if (!game) return { done: true, snapshots: [] };
  if (game.phase === 'menzhuaChoice') return stepAIMenzhuaOnceInternal(game, 0);
  if (game.bidState) return stepAIBidOnceInternal(game, 0);
  return stepAIPlayOnceByGameId(gameId);
}
