// 斗地主共享类型定义 —— 前后端共用

// 花色
export type Suit = 'spade' | 'heart' | 'club' | 'diamond' | 'joker';

// 牌点值：3-15 对应 3,4,...,10,J,Q,K,A,2；16=小王；17=大王
export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 ;

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

// 牌型种类
export type PlayType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'triple_single'
  | 'triple_pair'
  | 'straight'
  | 'pair_straight'
  | 'airplane'
  | 'airplane_single'
  | 'airplane_pair'
  | 'four_two_single'
  | 'four_two_pair'
  | 'bomb'
  | 'rocket';

// 识别出的一个牌型
export interface Play {
  type: PlayType;
  cards: Card[];
  mainRank: number; // 主牌点值，用于比较
  length: number; // 顺子/连对/飞机长度（三张组数）
  isLaiziBomb?: boolean; // 癞子炸标记：含癞子牌组成的炸弹，始终小于硬炸（四张同点）
  laiziAssign?: Record<string, number>; // 癞子牌实际充当的点数（cardId → 充当点数），用于出牌展示
}

// 玩家身份
export type Role = 'landlord' | 'peasant';

// 座位：0=玩家(底部), 1=AI上家(右上), 2=AI下家(左上)
export type Seat = 0 | 1 | 2;

export type Difficulty = 'casual' | 'standard' | 'master';
export type GameMode = 'classic' | 'unshuffled' | 'laizi' | 'tiandilaizi' | 'menzhua';

// 游戏阶段
//   dealing        发牌动画阶段（前端内部使用，后端通常直接进入后续阶段）
//   menzhuaChoice  闷抓模式专属：拿到明牌的玩家选择「闷抓」或「看牌」
//   bidding        经典/不洗牌/癞子/天地癞子 叫分，或 闷抓→看牌 后的叫分
//   playing        出牌
//   finished       结束
export type Phase = 'dealing' | 'menzhuaChoice' | 'bidding' | 'playing' | 'finished';

// 叫分状态
export interface BidState {
  currentBidder: Seat;
  bids: Array<{ seat: Seat; bid: number }>;
  highestBid: number;
  highestSeat: Seat | null;
  startSeat: Seat;
  bidCount: number; // 已叫人数
}

// 倍数信息
export interface Multiplier {
  base: number; // 底分
  bid: number; // 叫分
  bombs: number; // 炸弹数（含王炸）
  spring: boolean;
  antiSpring: boolean;
  menzhua: boolean; // 闷抓：输赢翻倍（闷抓直接当选地主）
  total: number;
}

// 玩家公开信息
export interface PlayerPublic {
  seat: Seat;
  name: string;
  isHuman: boolean;
  cardCount: number;
  hand?: Card[]; // 仅当玩家是本人或游戏结束时提供明牌
  role?: Role;
  hasMingCard?: boolean; // 闷抓模式：该玩家是否持有明牌（优先叫牌权标识）
}

// 游戏状态（前端可见）
export interface GameState {
  gameId: string;
  mode: GameMode;
  difficulty: Difficulty;
  playerName?: string; // 本局玩家（观察者座位）的用户名，战绩归属用
  laiziRank?: number; // 癞子点数（仅癞子模式）
  tianLaiziRank?: number; // 天地癞子模式 - 天癞子（发牌后抽取）
  diLaiziRank?: number; // 天地癞子模式 - 地癞子（确定地主后抽取）
  phase: Phase;
  currentSeat: Seat;
  players: PlayerPublic[];
  bottomCards: Card[];
  revealedBottom: boolean;
  lastPlay: { seat: Seat; play: Play } | null;
  lastValidPlay: { seat: Seat; play: Play } | null; // 当前需压过的有效牌
  seatLastPlays: (Play | null)[]; // 每个座位最近一次出的牌（不含 pass），展示在玩家面前
  seatPassed: boolean[]; // 本轮各座位最近动作是否为「不出」（新一轮清空），用于持续显示不出气泡
  passCount: number;
  bidState: BidState | null;
  multiplier: Multiplier;
  result: {
    winner: 'landlord' | 'peasant';
    landlordSeat: Seat;
    scores: number[]; // 各座位得分
  } | null;
  // 记牌器：除玩家手牌外场上各点数剩余张数，索引 0..14 对应 rank 17..3（大王,小王,2,A,K,...,3）
  remainingCards: number[];
  // 玩家当前是否有能压过 lastValidPlay 的牌型（仅玩家跟牌回合有意义；用于「要不起」按钮）
  hasValidPlay?: boolean;
  log: LogEntry[];

  // ===== 闷抓模式专属字段 =====
  // 发牌时随机翻出的明牌（获得此牌的玩家 = currentSeat，优先叫牌权）
  mingCard?: Card;
  // 明牌所在座位（冗余方便渲染，等同于 players[x].hasMingCard 的 True 者）
  mingCardSeat?: Seat;
  // 闷抓模式下，手牌是否已对玩家可见（false = 全暗牌，直到「看牌」或闷抓进入 playing）
  handRevealed?: boolean;
  // 是否为「闷抓翻倍」结算：闷抓直接当选地主时置 true，翻倍体现在 multiplier.menzhua
  menzhuaDoubled?: boolean;
}

export interface LogEntry {
  seat: Seat;
  action: 'bid' | 'play' | 'pass';
  value?: number | Play;
  ts: number;
}

// AI 事件（用于前端动画播放）。action='turn' 为回合切换标记（不发声）
export interface AIEvent {
  seat: Seat;
  action: 'bid' | 'play' | 'pass' | 'turn';
  value?: number | Play;
  delay: number; // 建议动画延迟（ms）
}

// 快照：某个 AI 动作后的游戏状态
export interface Snapshot {
  state: GameState;
  event: AIEvent;
}

// API 响应
export interface ActionResponse {
  state: GameState;
  snapshots: Snapshot[];
  error?: string;
}

export interface CreateGameResponse {
  gameId: string;
  state: GameState;
  snapshots: Snapshot[];
}

export interface Stats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  landlordWins: number;
  landlordGames: number;
  peasantWins: number;
  peasantGames: number;
  currentStreak: number;
  maxStreak: number;
  history: Array<{
    date: string;
    role: Role;
    won: boolean;
    score: number;
  }>;
}

// 表情/快捷语
export interface Emote {
  id: string;
  text: string;
  emoji: string;
}
