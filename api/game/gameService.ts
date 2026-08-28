// 游戏服务层 —— 管理游戏会话生命周期、叫分流程、出牌流程、AI 推进
import type {
  AIEvent, Card, Difficulty, GameMode, GameState, LogEntry, Multiplier, Play, Seat, Snapshot,
} from '@shared/types';
import { deal, dealUnshuffled, sortCards, pickLaiziRank, pickDistinctLaiziRank } from './cards';
import { identifyPlay, identifyPlayWithLaizi, identifyPlaysWithLaizi, canBeat, type IdentifyOptions } from './rules';
import { decideBid, decidePlay, getHint, type AIContext } from './aiEngine';
import { getGame, saveGame, toPublicState, type InternalGame } from './store';

const AI_NAMES = ['老张', '阿强', '小美', '大刘', '阿珍', '老王', '阿杰', '小林'];
const BASE_SCORE = 1;

function genGameId(): string {
  return `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickAINames(): string[] {
  const shuffled = [...AI_NAMES].sort(() => Math.random() - 0.5);
  return ['你', shuffled[0], shuffled[1]];
}

// 为联机对局生成不与其他座位重名的 AI 名字
function pickOnlineAINames(names: string[]): string[] {
  const used = new Set(names.filter(Boolean));
  const pool = AI_NAMES.filter((n) => !used.has(n));
  const shuffled = pool.length > 0 ? [...pool].sort(() => Math.random() - 0.5) : [...AI_NAMES];
  let i = 0;
  const result: string[] = [];
  for (let s = 0; s < 3; s++) {
    if (names[s]) {
      result.push(names[s]!);
    } else {
      result.push(shuffled[i % shuffled.length]);
      i++;
    }
  }
  return result;
}

function emptyMultiplier(): Multiplier {
  return { base: BASE_SCORE, bid: 0, bombs: 0, spring: false, antiSpring: false, menzhua: false, total: 0 };
}

function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 3) as Seat;
}

// 当前生效的癞子点数列表（天地癞子模式：天+地各一个；癞子模式：单个）
function laiziRanksOf(game: InternalGame): number[] {
  if (game.laiziRank) return [game.laiziRank];
  const ranks: number[] = [];
  if (game.tianLaiziRank) ranks.push(game.tianLaiziRank);
  if (game.diLaiziRank) ranks.push(game.diLaiziRank);
  return ranks;
}

// 天地癞子模式：允许四张及以上同点数组成炸弹
function multiBombOf(game: InternalGame): boolean {
  return game.mode === 'tiandilaizi';
}

function laiziOpts(game: InternalGame): IdentifyOptions {
  return { multiBomb: multiBombOf(game) };
}

function makeAIContext(game: InternalGame, seat: Seat): AIContext {
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
    laiziRanks: laiziRanksOf(game),
    multiBomb: multiBombOf(game),
    passCount: game.passCount,
  };
}

function delay(base: number, jitter: number): number {
  return base + Math.floor(Math.random() * jitter);
}

// ===== 拟人化思考节奏 =====
// 叫分：慢慢斟酌
function bidDelay(): number {
  return delay(2000, 1200);
}
// 出牌：炸弹/火箭前“犹豫”更久，长组合多想想，小牌干脆
function playDelay(play: Play): number {
  if (play.type === 'bomb' || play.type === 'rocket') return delay(3400, 1400);
  if (play.cards.length >= 5) return delay(2800, 1200);
  return delay(2400, 1200);
}
// 不出：想一会儿再放弃
function passDelay(): number {
  return delay(1800, 1100);
}

function log(game: InternalGame, seat: Seat, action: LogEntry['action'], value?: number | Play): void {
  game.log.push({ seat, action, value, ts: Date.now() });
}

function updateCardTracker(game: InternalGame, cards: Card[]): void {
  for (const c of cards) {
    game.cardTracker.set(c.rank, (game.cardTracker.get(c.rank) || 0) + 1);
  }
}

/**
 * 构建一局游戏会话（支持指定真人座位，供单人/联机共用）。
 * @param humans  各座位是否为真人；非真人座位过后由 AI 接管
 * @param names   各座位名字（真人用其昵称，AI 座位用 AI 名）
 * @param viewerSeat 返回状态时所站的观众座位（决定哪只手牌明牌）
 */
export function createGameSession(
  mode: GameMode,
  difficulty: Difficulty,
  humans: boolean[],
  names: string[],
  viewerSeat: Seat = 0,
): { gameId: string; state: GameState; snapshots: Snapshot[] } {
  const gameId = genGameId();
  const { hands, bottom } = mode === 'unshuffled' ? dealUnshuffled() : deal();
  const laiziRank = mode === 'laizi' ? pickLaiziRank() : null;
  const tianLaiziRank = mode === 'tiandilaizi' ? pickLaiziRank() : null;

  let mingCard: Card | null = null;
  let mingCardSeat: 0 | 1 | 2 | null = null;
  let startPhase: 'menzhuaChoice' | 'bidding' = 'bidding';
  let startSeat: Seat = Math.floor(Math.random() * 3) as Seat;
  let handRevealed = true;
  let menzhuaPhase: 'waiting' | 'kanpai' | null = null;

  if (mode === 'menzhua') {
    startPhase = 'menzhuaChoice';
    handRevealed = false;
    menzhuaPhase = 'waiting';
    const all51: Card[] = [];
    const seatOfCard: Map<string, 0 | 1 | 2> = new Map();
    for (let s = 0; s < 3; s++) {
      for (const c of hands[s]) {
        all51.push(c);
        seatOfCard.set(c.id, s as 0 | 1 | 2);
      }
    }
    const pickIdx = Math.floor(Math.random() * all51.length);
    mingCard = all51[pickIdx];
    mingCardSeat = seatOfCard.get(mingCard.id)!;
    startSeat = mingCardSeat;
  }

  const game: InternalGame = {
    gameId,
    mode,
    difficulty,
    laiziRank,
    tianLaiziRank,
    diLaiziRank: null,
    phase: startPhase,
    currentSeat: startSeat,
    hands,
    bottomCards: bottom,
    revealedBottom: false,
    roles: [null, null, null],
    landlordSeat: null,
    lastPlay: null,
    lastValidPlay: null,
    seatLastPlays: [null, null, null],
    seatPassed: [false, false, false],
    passCount: 0,
    bidState: null,
    multiplier: emptyMultiplier(),
    cardTracker: new Map(),
    playCounts: [0, 0, 0],
    result: null,
    log: [],
    playerNames: names,
    bidRedealCount: 0,
    humans,
    mingCard,
    mingCardSeat,
    menzhuaPhase,
    handRevealed,
    menzhuaDoubled: false,
  };

  if (mode !== 'menzhua') {
    game.bidState = {
      currentBidder: startSeat,
      bids: [],
      highestBid: 0,
      highestSeat: null,
      startSeat,
      bidCount: 0,
    };
  }

  saveGame(game);

  const snapshots: Snapshot[] = [];
  if (mode === 'menzhua') {
    if (!isHumanSeat(game, game.currentSeat)) {
      runAIBids(game, snapshots, viewerSeat);
    }
  } else {
    if (!isHumanSeat(game, game.currentSeat)) {
      runAIBids(game, snapshots, viewerSeat);
    }
  }

  return { gameId, state: toPublicState(game, viewerSeat), snapshots };
}

/**
 * 创建新对局（单人 AI 模式，仅座位 0 为真人；playerName 为玩家用户名，战绩归属用）
 */
export function createGame(mode: GameMode, difficulty: Difficulty, playerName?: string): { gameId: string; state: GameState; snapshots: Snapshot[] } {
  const names = pickAINames();
  if (playerName && playerName.trim()) names[0] = playerName.trim().slice(0, 12);
  return createGameSession(mode, difficulty, [true, false, false], names, 0);
}

/**
 * 创建联机对局（humanSeats 中的座位为真人，其余由 AI 补齐）
 */
export function createOnlineGame(
  mode: GameMode,
  difficulty: Difficulty,
  seatNames: (string | null)[],
  viewerSeat: Seat,
): { gameId: string; state: GameState; snapshots: Snapshot[] } {
  const humans = seatNames.map((n) => !!n);
  return createGameSession(mode, difficulty, humans, pickOnlineAINames(seatNames.map((n) => n ?? '')), viewerSeat);
}

// 座位是否为真人（决定 AI 是否接管该座位）
function isHumanSeat(game: InternalGame, seat: Seat): boolean {
  return game.humans[seat] ?? seat === 0;
}

/**
 * 指定地主
 */
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

/**
 * 闷抓模式：处理明牌玩家选择「闷抓」或「看牌」
 */
function processMenzhuaChoice(game: InternalGame, seat: Seat, choice: 'menzhua' | 'kanpai'): void {
  if (game.phase !== 'menzhuaChoice') return;
  if (seat !== game.mingCardSeat || seat !== game.currentSeat) return;

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
    const startSeat = seat;
    game.currentSeat = startSeat;
    game.bidState = {
      currentBidder: startSeat,
      bids: [],
      highestBid: 0,
      highestSeat: null,
      startSeat,
      bidCount: 0,
    };
  }
}

/**
 * 玩家闷抓选择
 */
export function playerMenzhua(gameId: string, choice: 'menzhua' | 'kanpai', seat: Seat = 0): { state: GameState; snapshots: Snapshot[]; error?: string } {
  const game = getGame(gameId);
  if (!game) return { state: null as any, snapshots: [], error: '对局不存在' };
  if (game.phase !== 'menzhuaChoice') return { state: toPublicState(game, seat), snapshots: [], error: '当前非闷抓选择阶段' };
  if (!isHumanSeat(game, seat)) return { state: toPublicState(game, seat), snapshots: [], error: '该座位不是真人' };
  if (game.currentSeat !== seat) return { state: toPublicState(game, seat), snapshots: [], error: '非你的回合' };
  if (seat !== game.mingCardSeat) return { state: toPublicState(game, seat), snapshots: [], error: '非明牌持有者' };

  processMenzhuaChoice(game, seat, choice);
  const snapshots: Snapshot[] = [];

  if (choice === 'kanpai') {
    if (game.bidState && game.bidState.highestBid < 3 && game.bidState.bidCount < 3 && !isHumanSeat(game, game.currentSeat)) {
      runAIBids(game, snapshots, seat);
    }
  } else {
    if ((game.phase as string) === 'playing' && !isHumanSeat(game, game.currentSeat)) {
      runAIPlays(game, snapshots, seat);
    }
  }

  return { state: toPublicState(game, seat), snapshots };
}

/**
 * 推进 AI 叫分（直到轮到某个真人对局或叫分结束）
 */
function runAIBids(game: InternalGame, snapshots: Snapshot[], viewerSeat: Seat): void {
  if (game.phase === 'menzhuaChoice') {
    if (isHumanSeat(game, game.currentSeat)) return;
    const seat = game.currentSeat;
    if (seat !== game.mingCardSeat) return;

    snapshots.push({
      state: toPublicState(game, viewerSeat),
      event: { seat: game.currentSeat, action: 'turn', delay: 200 },
    });

    const ctx = {
      hand: game.hands[seat],
      seat,
      currentHigh: 0,
      difficulty: game.difficulty,
      isFirstBidder: true,
    };
    const bidEstimate = decideBid(ctx);
    const choice: 'menzhua' | 'kanpai' = bidEstimate >= 2 ? 'menzhua' : 'kanpai';
    processMenzhuaChoice(game, seat, choice);
    const event: AIEvent = { seat, action: 'bid', value: choice === 'menzhua' ? 3 : 0, delay: bidDelay() };
    snapshots.push({ state: toPublicState(game, viewerSeat), event });

    if (choice === 'kanpai') {
      if (game.bidState && !isHumanSeat(game, game.currentSeat)) {
        runAIBids(game, snapshots, viewerSeat);
      }
    } else {
      if ((game.phase as string) === 'playing') {
        snapshots.push({
          state: toPublicState(game, viewerSeat),
          event: { seat: game.currentSeat, action: 'turn', delay: 600 },
        });
        if (!isHumanSeat(game, game.currentSeat)) {
          runAIPlays(game, snapshots, viewerSeat);
        }
      }
    }
    return;
  }

  if (!game.bidState) return;
  // 初始快照：玩家动作后、AI 动作前的状态（turn 标记，不发声）
  snapshots.push({
    state: toPublicState(game, viewerSeat),
    event: { seat: game.currentSeat, action: 'turn', delay: 200 },
  });
  let guard = 0;
  while (game.bidState && !isHumanSeat(game, game.currentSeat) && guard < 20) {
    guard++;
    const seat = game.currentSeat;
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
    snapshots.push({ state: toPublicState(game, viewerSeat), event });

    // 叫分结束条件：有人叫3或已叫满3人
    if (game.bidState && (game.bidState.highestBid === 3 || game.bidState.bidCount >= 3)) {
      finishBidding(game);
      // 无人叫分会触底重发（重置 bidState、phase 仍 bidding），继续推进新一轮叫分；
      // 正常结束则 assignLandlord 将 bidState 置空，循环条件不满足自然退出。
      continue;
    }
  }

  // 叫分结束进入出牌阶段：补一个“地主确定、底牌翻开”的状态快照（不发声），
  // 保证前端正确跳出叫分阶段；若地主是 AI 则继续推进 AI 出牌。
  if (game.phase === 'playing') {
    snapshots.push({
      state: toPublicState(game, viewerSeat),
      event: { seat: game.currentSeat, action: 'turn', delay: 600 },
    });
    if (!isHumanSeat(game, game.currentSeat)) {
      runAIPlays(game, snapshots, viewerSeat);
    }
  }
}

/**
 * 处理单个叫分
 */
function processBid(game: InternalGame, seat: Seat, bid: number): void {
  if (!game.bidState) return;
  // bid=0 表示不叫；否则必须大于当前最高分
  const validBid = bid > game.bidState.highestBid ? bid : 0;
  game.bidState.bids.push({ seat, bid: validBid });
  game.bidState.bidCount++;
  if (validBid > game.bidState.highestBid) {
    game.bidState.highestBid = validBid;
    game.bidState.highestSeat = seat;
  }
  log(game, seat, 'bid', validBid);
  game.currentSeat = nextSeat(seat);
}

/**
 * 叫分结束，确定地主
 */
function finishBidding(game: InternalGame): void {
  if (!game.bidState) return;
  if (game.bidState.highestSeat === null || game.bidState.highestBid === 0) {
    if (game.bidRedealCount < 1) {
      game.bidRedealCount++;
      const { hands, bottom } = game.mode === 'unshuffled' ? dealUnshuffled() : deal();
      game.hands = hands;
      game.bottomCards = bottom;

      if (game.mode === 'menzhua') {
        game.phase = 'menzhuaChoice';
        game.menzhuaPhase = 'waiting';
        game.handRevealed = false;
        game.bidState = null;
        const all51: Card[] = [];
        const seatOfCard: Map<string, 0 | 1 | 2> = new Map();
        for (let s = 0; s < 3; s++) {
          for (const c of hands[s]) {
            all51.push(c);
            seatOfCard.set(c.id, s as 0 | 1 | 2);
          }
        }
        const pickIdx = Math.floor(Math.random() * all51.length);
        game.mingCard = all51[pickIdx];
        game.mingCardSeat = seatOfCard.get(game.mingCard.id)!;
        game.currentSeat = game.mingCardSeat;
        return;
      }

      const startSeat = Math.floor(Math.random() * 3) as Seat;
      game.currentSeat = startSeat;
      game.bidState = {
        currentBidder: startSeat, bids: [], highestBid: 0, highestSeat: null,
        startSeat, bidCount: 0,
      };
      return;
    }
    assignLandlord(game, game.bidState.startSeat, 1);
  } else {
    assignLandlord(game, game.bidState.highestSeat!, game.bidState.highestBid);
  }
  game.phase = 'playing';
  game.currentSeat = game.landlordSeat!;
}

/**
 * 玩家叫分（seat 指定执行叫分的真人座位，默认单人模式座位 0）
 */
export function playerBid(gameId: string, bid: number, seat: Seat = 0): { state: GameState; snapshots: Snapshot[]; error?: string } {
  const game = getGame(gameId);
  if (!game) return { state: null as any, snapshots: [], error: '对局不存在' };
  if (game.phase !== 'bidding') return { state: toPublicState(game, seat), snapshots: [], error: '当前非叫分阶段' };
  if (!isHumanSeat(game, seat)) return { state: toPublicState(game, seat), snapshots: [], error: '该座位不是真人' };
  if (game.currentSeat !== seat) return { state: toPublicState(game, seat), snapshots: [], error: '非你的回合' };
  if (!game.bidState) return { state: toPublicState(game, seat), snapshots: [], error: '叫分状态异常' };
  if (bid !== 0 && bid <= game.bidState.highestBid) {
    return { state: toPublicState(game, seat), snapshots: [], error: '叫分必须高于当前最高分' };
  }

  processBid(game, seat, bid);
  const snapshots: Snapshot[] = [];

  // 推进 AI 叫分
  if (game.bidState && game.bidState.highestBid < 3 && game.bidState.bidCount < 3) {
    runAIBids(game, snapshots, seat);
  } else {
    finishBidding(game);
    // 若进入出牌阶段且轮到 AI，推进 AI 出牌
    if ((game.phase as string) === 'playing' && !isHumanSeat(game, game.currentSeat)) {
      runAIPlays(game, snapshots, seat);
    }
  }

  return { state: toPublicState(game, seat), snapshots };
}

/**
 * 推进 AI 出牌（直到轮到某个真人座位或游戏结束）
 */
function runAIPlays(game: InternalGame, snapshots: Snapshot[], viewerSeat: Seat): void {
  // 初始快照：玩家动作后、AI 动作前的状态（turn 标记，不发声）
  snapshots.push({
    state: toPublicState(game, viewerSeat),
    event: { seat: game.currentSeat, action: 'turn', delay: 200 },
  });
  let guard = 0;
  while ((game.phase as string) === 'playing' && !isHumanSeat(game, game.currentSeat) && guard < 20) {
    guard++;
    const seat = game.currentSeat;
    const ctx = makeAIContext(game, seat);
    const play = decidePlay(ctx);

    let event: AIEvent;
    if (play) {
      executePlay(game, seat, play);
      event = { seat, action: 'play', value: play, delay: playDelay(play) };
    } else {
      executePass(game, seat);
      event = { seat, action: 'pass', delay: passDelay() };
    }
    snapshots.push({ state: toPublicState(game, viewerSeat), event });

    if ((game.phase as string) === 'finished') break;
  }
}

/**
 * 执行出牌
 */
function executePlay(game: InternalGame, seat: Seat, play: Play): void {
  // 从手牌移除
  const ids = new Set(play.cards.map((c) => c.id));
  game.hands[seat] = game.hands[seat].filter((c) => !ids.has(c.id));
  game.lastPlay = { seat, play };
  game.lastValidPlay = { seat, play };
  game.seatLastPlays[seat] = play; // 记录该座位最近出的牌
  game.seatPassed[seat] = false;  // 本轮该座位最近动作为出牌
  game.passCount = 0;
  game.playCounts[seat]++;
  log(game, seat, 'play', play);
  updateCardTracker(game, play.cards);

  // 炸弹/火箭倍数
  if (play.type === 'bomb') game.multiplier.bombs++;
  if (play.type === 'rocket') game.multiplier.bombs++;

  // 判胜
  if (game.hands[seat].length === 0) {
    finishGame(game, seat);
    return;
  }
  game.currentSeat = nextSeat(seat);
}

/**
 * 执行不出
 */
function executePass(game: InternalGame, seat: Seat): void {
  game.lastPlay = { seat, play: { type: 'single', cards: [], mainRank: 0 as any, length: 0 } };
  game.passCount++;
  game.seatPassed[seat] = true; // 本轮该座位最近动作为不出（气泡持续到本轮结束）
  log(game, seat, 'pass');
  // 两人不出后，上家有效出牌者重新领出，清空桌面所有出牌展示
  if (game.passCount >= 2 && game.lastValidPlay) {
    game.currentSeat = game.lastValidPlay.seat;
    game.lastValidPlay = null;
    game.lastPlay = null;
    game.passCount = 0;
    game.seatLastPlays = [null, null, null]; // 新一轮，清空桌面
    game.seatPassed = [false, false, false];
  } else {
    game.currentSeat = nextSeat(seat);
  }
}

/** 玩家出牌时可选择的牌型解（癞子多解时供前端展示选择） */
export interface PlayChoice {
  type: string;
  mainRank: number;
  length: number;
  isLaiziBomb?: boolean;
  beats: boolean; // 能否压过当前上家牌（领出阶段恒为 true）
}

/**
 * 分析玩家当前选牌可构成的所有牌型解（癞子模式下可能多解）。
 * 不要求轮到该玩家（选牌预览阶段即可调用）。
 */
export function playerAnalyze(gameId: string, cards: Card[], seat: Seat = 0): { plays: PlayChoice[]; error?: string } {
  const game = getGame(gameId);
  if (!game) return { plays: [], error: '对局不存在' };
  if (game.phase !== 'playing') return { plays: [], error: '当前非出牌阶段' };
  if (!isHumanSeat(game, seat)) return { plays: [], error: '该座位不是真人' };

  // 校验牌是否都在手中
  const handIds = new Set(game.hands[seat].map((c) => c.id));
  if (!cards.every((c) => handIds.has(c.id))) {
    return { plays: [], error: '选牌包含不在手中的牌' };
  }

  const laiziRanks = laiziRanksOf(game);
  const plays = laiziRanks.length > 0
    ? identifyPlaysWithLaizi(cards, laiziRanks, laiziOpts(game))
    : (() => { const p = identifyPlay(cards, laiziOpts(game)); return p ? [p] : []; })();

  const last = game.lastValidPlay?.play ?? null;
  return {
    plays: plays.map((p) => ({
      type: p.type,
      mainRank: p.mainRank,
      length: p.length,
      isLaiziBomb: p.isLaiziBomb,
      beats: !last || canBeat(p, last),
    })),
  };
}

/**
 * 玩家出牌（seat 指定执行的真人座位，默认单人模式座位 0）
 * choice 指定玩家选择的牌型解（癞子多解时由前端传入；缺省时自动取最强解）
 */
export function playerPlay(gameId: string, cards: Card[], seat: Seat = 0, choice?: { type: string; mainRank: number }): { state: GameState; snapshots: Snapshot[]; error?: string } {
  const game = getGame(gameId);
  if (!game) return { state: null as any, snapshots: [], error: '对局不存在' };
  if (game.phase !== 'playing') return { state: toPublicState(game, seat), snapshots: [], error: '当前非出牌阶段' };
  if (!isHumanSeat(game, seat)) return { state: toPublicState(game, seat), snapshots: [], error: '该座位不是真人' };
  if (game.currentSeat !== seat) return { state: toPublicState(game, seat), snapshots: [], error: '非你的回合' };

  // 校验牌是否都在手中
  const handIds = new Set(game.hands[seat].map((c) => c.id));
  if (!cards.every((c) => handIds.has(c.id))) {
    return { state: toPublicState(game, seat), snapshots: [], error: '选牌包含不在手中的牌' };
  }

  const laiziRanks = laiziRanksOf(game);
  let play: Play | null;
  if (laiziRanks.length > 0 && choice) {
    // 玩家指定的牌型解：在所有合法解中精确匹配
    const all = identifyPlaysWithLaizi(cards, laiziRanks, laiziOpts(game));
    play = all.find((p) => p.type === choice.type && p.mainRank === choice.mainRank) ?? null;
    if (!play) return { state: toPublicState(game, seat), snapshots: [], error: '所选牌型与选牌不符' };
  } else if (laiziRanks.length > 0) {
    play = identifyPlayWithLaizi(cards, laiziRanks, laiziOpts(game));
  } else {
    play = identifyPlay(cards, laiziOpts(game));
  }
  if (!play) return { state: toPublicState(game, seat), snapshots: [], error: '不是合法牌型' };

  // 若需跟牌，校验能否压过
  if (game.lastValidPlay && !canBeat(play, game.lastValidPlay.play)) {
    return { state: toPublicState(game, seat), snapshots: [], error: '牌型无法压过上家' };
  }

  executePlay(game, seat, play);
  const snapshots: Snapshot[] = [];
  if ((game.phase as string) === 'playing' && !isHumanSeat(game, game.currentSeat)) {
    runAIPlays(game, snapshots, seat);
  }
  return { state: toPublicState(game, seat), snapshots };
}

/**
 * 玩家不出（seat 指定执行的真人座位，默认单人模式座位 0）
 */
export function playerPass(gameId: string, seat: Seat = 0): { state: GameState; snapshots: Snapshot[]; error?: string } {
  const game = getGame(gameId);
  if (!game) return { state: null as any, snapshots: [], error: '对局不存在' };
  if (game.phase !== 'playing') return { state: toPublicState(game, seat), snapshots: [], error: '当前非出牌阶段' };
  if (!isHumanSeat(game, seat)) return { state: toPublicState(game, seat), snapshots: [], error: '该座位不是真人' };
  if (game.currentSeat !== seat) return { state: toPublicState(game, seat), snapshots: [], error: '非你的回合' };
  if (!game.lastValidPlay) return { state: toPublicState(game, seat), snapshots: [], error: '领出阶段不可不出' };

  executePass(game, seat);
  const snapshots: Snapshot[] = [];
  if ((game.phase as string) === 'playing' && !isHumanSeat(game, game.currentSeat)) {
    runAIPlays(game, snapshots, seat);
  }
  return { state: toPublicState(game, seat), snapshots };
}

/**
 * 获取提示（seat 指定真人座位）
 */
export function playerHint(gameId: string, seat: Seat = 0): Card[] | null {
  const game = getGame(gameId);
  if (!game || game.phase !== 'playing' || game.currentSeat !== seat || !isHumanSeat(game, seat)) return null;
  return getHint(game.hands[seat], game.lastValidPlay?.play ?? null, laiziRanksOf(game), multiBombOf(game));
}

/**
 * 查询状态（按观众座位返回）
 */
export function getState(gameId: string, viewerSeat = 0): GameState | null {
  const game = getGame(gameId);
  return game ? toPublicState(game, viewerSeat) : null;
}

/**
 * 游戏结束结算
 */
function finishGame(game: InternalGame, winnerSeat: Seat): void {
  const landlordWon = winnerSeat === game.landlordSeat;
  const m = game.multiplier;

  // 春天判定
  const peasantPlays = [0, 1, 2]
    .filter((s) => s !== game.landlordSeat)
    .reduce((sum, s) => sum + game.playCounts[s], 0);
  if (landlordWon && peasantPlays === 0) m.spring = true;
  if (!landlordWon && game.playCounts[game.landlordSeat!] <= 1) m.antiSpring = true;

  // 倍数计算
  const bombMultiplier = Math.pow(2, m.bombs);
  m.total = m.base * m.bid * bombMultiplier * (m.spring ? 2 : 1) * (m.antiSpring ? 2 : 1) * (m.menzhua ? 2 : 1);

  // 得分：地主胜 → 地主 +2*total，农民各 -total；农民胜 → 地主 -2*total，农民各 +total
  const scores = [0, 0, 0];
  const total = m.total;
  for (let s = 0; s < 3; s++) {
    if (s === game.landlordSeat) {
      scores[s] = landlordWon ? 2 * total : -2 * total;
    } else {
      scores[s] = landlordWon ? -total : total;
    }
  }

  game.result = {
    winner: landlordWon ? 'landlord' : 'peasant',
    landlordSeat: game.landlordSeat!,
    scores,
  };
  game.phase = 'finished';
}
