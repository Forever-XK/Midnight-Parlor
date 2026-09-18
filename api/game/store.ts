// 游戏会话内存存储
import type { GameState, GameMode } from '@shared/types';
import { findBeatingPlays, findBeatingPlaysWithLaizi } from './rules';

export interface InternalGame {
  gameId: string;
  mode: GameMode;
  difficulty: 'casual' | 'standard' | 'master';
  laiziRank: number | null; // 癞子点数（仅癞子模式）
  tianLaiziRank: number | null; // 天癞子（天地癞子模式，发牌后抽取）
  diLaiziRank: number | null;  // 地癞子（天地癞子模式，确定地主后抽取）
  phase: 'dealing' | 'menzhuaChoice' | 'bidding' | 'playing' | 'finished';
  currentSeat: 0 | 1 | 2;
  hands: Card[][]; // 完整手牌 [seat0, seat1, seat2]
  bottomCards: Card[];
  revealedBottom: boolean;
  roles: Array<'landlord' | 'peasant' | null>;
  landlordSeat: 0 | 1 | 2 | null;
  lastPlay: { seat: 0 | 1 | 2; play: Play } | null;
  lastValidPlay: { seat: 0 | 1 | 2; play: Play } | null;
  seatLastPlays: (Play | null)[]; // 每个座位最近一次出的牌（不含 pass），展示在玩家面前
  seatPassed: boolean[]; // 本轮各座位最近动作是否为「不出」（新一轮清空）
  passCount: number;
  bidState: import('@shared/types').BidState | null;
  multiplier: import('@shared/types').Multiplier;
  cardTracker: Map<number, number>;
  playCounts: number[]; // 各座位成功出牌次数（春天判定）
  result: {
    winner: 'landlord' | 'peasant';
    landlordSeat: 0 | 1 | 2;
    scores: number[];
  } | null;
  log: import('@shared/types').LogEntry[];
  playerNames: string[];
  bidRedealCount: number;
  humans: boolean[]; // 各座位是否为真人（联机对局中决定 AI 何时接管）
  mingCard: Card | null;
  mingCardSeat: 0 | 1 | 2 | null;
  menzhuaPhase: 'waiting' | 'kanpai' | null;
  handRevealed: boolean;
  menzhuaDoubled: boolean;
}

import type { Card, Play } from '@shared/types';

const games = new Map<string, InternalGame>();

export function saveGame(game: InternalGame): void {
  games.set(game.gameId, game);
}

export function getGame(gameId: string): InternalGame | undefined {
  return games.get(gameId);
}

export function deleteGame(gameId: string): void {
  games.delete(gameId);
}

// 当前生效的癞子点数列表（天地癞子模式：天+地；癞子模式：单个）
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

export function toPublicState(game: InternalGame, viewerSeat = 0): GameState {
  // 记牌器：除观众手牌外，场上尚未打出的各点数张数（index 0..14 ↔ rank 17..3，从大到小）
  const remainingCards: number[] = [];
  for (let rank = 17; rank >= 3; rank--) {
    const total = rank >= 16 ? 1 : 4; // 小王/大王各 1 张，其余点数各 4 张
    const inHand = game.hands[viewerSeat].filter((c) => c.rank === rank).length;
    const played = game.cardTracker.get(rank) || 0;
    remainingCards.push(total - inHand - played);
  }

  // 观众是否有能压过 lastValidPlay 的牌型（仅观众跟牌回合计算，用于「要不起」按钮）
  let hasValidPlay: boolean | undefined;
  if (game.phase === 'playing' && game.currentSeat === viewerSeat && game.lastValidPlay) {
    const hand = game.hands[viewerSeat];
    const last = game.lastValidPlay.play;
    const laiziRanks = laiziRanksOf(game);
    const opts = { multiBomb: multiBombOf(game) };
    const plays = laiziRanks.length > 0
      ? findBeatingPlaysWithLaizi(hand, last, laiziRanks, opts)
      : findBeatingPlays(hand, last, opts);
    hasValidPlay = plays.length > 0;
  }

  const isMenzhua = game.mode === 'menzhua';
  const isFinished = game.phase === 'finished';
  const hideHandMenzhua = isMenzhua && !game.handRevealed && !isFinished;
  const landlordSeat = game.landlordSeat;
  const bottomVisibleForViewer = !isMenzhua || landlordSeat === null || viewerSeat === landlordSeat;
  const revealedBottomForViewer = isMenzhua && landlordSeat !== null
    ? viewerSeat === landlordSeat
    : game.revealedBottom;

  return {
    gameId: game.gameId,
    mode: game.mode,
    difficulty: game.difficulty,
    playerName: game.playerNames[viewerSeat] ?? undefined,
    laiziRank: game.laiziRank ?? undefined,
    tianLaiziRank: game.tianLaiziRank ?? undefined,
    diLaiziRank: game.diLaiziRank ?? undefined,
    phase: game.phase,
    currentSeat: game.currentSeat,
    players: game.hands.map((hand, seat) => ({
      seat: seat as 0 | 1 | 2,
      name: game.playerNames[seat],
      isHuman: game.humans[seat] ?? seat === 0,
      cardCount: hand.length,
      hand: (hideHandMenzhua && seat === viewerSeat) ? undefined : (seat === viewerSeat || isFinished ? [...hand] : undefined),
      role: game.roles[seat] ?? undefined,
      hasMingCard: game.mingCardSeat === (seat as 0 | 1 | 2),
    })),
    // 底牌可见：游戏结束后全局可见；进行中按 bottomVisibleForViewer
    // （非 menzhua / 观众是地主）。注意 menzhua 模式 assignLandlord
    // 会把 game.revealedBottom 故意保留为 false（由这里按观众位兜底），
    // 避免再被 game.revealedBottom 一起拦住导致地主也看不到底牌。
    bottomCards: isFinished || (landlordSeat !== null && bottomVisibleForViewer)
      ? [...game.bottomCards]
      : [],
    revealedBottom: revealedBottomForViewer,
    lastPlay: game.lastPlay,
    lastValidPlay: game.lastValidPlay,
    seatLastPlays: game.seatLastPlays.map((p) => (p ? { ...p, cards: [...p.cards] } : null)),
    seatPassed: [...game.seatPassed],
    passCount: game.passCount,
    bidState: game.bidState ? { ...game.bidState, bids: [...game.bidState.bids] } : null,
    multiplier: { ...game.multiplier },
    result: game.result,
    remainingCards,
    hasValidPlay,
    log: game.log,
    mingCard: game.mingCard ?? undefined,
    mingCardSeat: game.mingCardSeat ?? undefined,
    handRevealed: game.handRevealed,
    menzhuaDoubled: game.menzhuaDoubled,
  };
}
