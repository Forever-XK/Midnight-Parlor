// 联机房间管理 —— 创建/加入/开始对局，AI 补齐空座位
import type { Card, Difficulty, GameMode, GameState, Seat, Snapshot } from '@shared/types';
import {
  createOnlineGame, playerBid, playerPlay, playerPass, playerHint, getState, playerMenzhua, playerAnalyze, type PlayChoice,
} from '../game/gameService';

export interface RoomPlayer {
  clientId: string;
  name: string;
  seat: Seat;
  isHost: boolean;
}

// 兼容：aiPlayers 字段在 WS 调度中未强依赖，类型用宽松数组避免 aiTypes 缺失
export type AIPlayerPlaceholder = { hand: string[] };

export interface Room {
  roomId: string;
  mode: GameMode;
  difficulty: Difficulty;
  hostId: string;
  players: (RoomPlayer | null)[]; // 座位索引
  status: 'waiting' | 'playing' | 'finished';
  gameId: string | null;
  createdAt: number;
  // ===== 联机调度器扩展字段（WebSocket 用）=====
  state?: GameState | null;        // 最新 GameState 副本（与 gameService 中 session 同步）
  snapshots?: Snapshot[];          // 本房间累计快照
  aiPlayers?: AIPlayerPlaceholder[]; // 占位，避免 aiTypes 模块缺失
  mySeat?: Seat | null;
}

export interface RoomListItem {
  roomId: string;
  mode: GameMode;
  hostName: string;
  playerCount: number;
  playerNames: string[];
}

const rooms = new Map<string, Room>();
let roomSeq = 0;

function genRoomId(): string {
  roomSeq = (roomSeq + 1) % 10000;
  return `room_${Date.now().toString(36)}_${roomSeq}`;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

function saveRoom(room: Room): void {
  rooms.set(room.roomId, room);
  // 简单清理：删除 6 小时前未开始的房间
  if (rooms.size > 500) {
    const cutoff = Date.now() - 6 * 3600 * 1000;
    for (const [id, r] of rooms) {
      if (r.status === 'waiting' && r.createdAt < cutoff) rooms.delete(id);
    }
  }
}

// 找到某 clientId 在房间中的座位
export function seatOf(room: Room, clientId: string): Seat | null {
  for (let s = 0; s < 3; s++) {
    if (room.players[s] && room.players[s]!.clientId === clientId) return s as Seat;
  }
  return null;
}

export function listRooms(): RoomListItem[] {
  return [...rooms.values()]
    .filter((r) => r.status === 'waiting')
    .map((r) => ({
      roomId: r.roomId,
      mode: r.mode,
      hostName: r.players.find((p) => p && p.isHost)?.name ?? '房主',
      playerCount: r.players.filter((p) => p !== null).length,
      playerNames: r.players.filter((p): p is RoomPlayer => p !== null).map((p) => p.name),
    }));
}

export function createRoom(clientId: string, name: string, mode: GameMode, difficulty: Difficulty): { room: Room; error?: string } {
  const room: Room = {
    roomId: genRoomId(),
    mode,
    difficulty,
    hostId: clientId,
    players: [null, null, null],
    status: 'waiting',
    gameId: null,
    createdAt: Date.now(),
  };
  room.players[0] = { clientId, name, seat: 0, isHost: true };
  saveRoom(room);
  return { room };
}

export function joinRoom(roomId: string, clientId: string, name: string): { room?: Room; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: '房间不存在' };
  if (room.status !== 'waiting') return { error: '房间已开始' };
  if (seatOf(room, clientId) !== null) return { room };
  const free = room.players.findIndex((p) => p === null);
  if (free === -1) return { error: '房间已满' };
  room.players[free] = { clientId, name, seat: free as Seat, isHost: false };
  return { room };
}

export function leaveRoom(roomId: string, clientId: string): { room?: Room; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: '房间不存在' };
  const seat = seatOf(room, clientId);
  if (seat !== null) {
    room.players[seat] = null;
    // 房主离开 → 转移给下一个玩家，否则销毁房间
    if (room.hostId === clientId) {
      const next = room.players.find((p) => p !== null);
      if (next) {
        room.hostId = next.clientId;
        next.isHost = true;
      } else {
        rooms.delete(roomId);
        return { error: '房间已销毁' };
      }
    }
  }
  return { room };
}

// 获取房间公开信息（含对局状态，按观众座位返回）
export function roomState(room: Room, clientId: string): {
  roomId: string; mode: GameMode; difficulty: Difficulty; hostId: string;
  players: (RoomPlayer | null)[]; status: Room['status']; gameId: string | null;
  mySeat: Seat | null; state: GameState | null;
} {
  const mySeat = seatOf(room, clientId);
  const game = room.gameId && mySeat !== null ? getState(room.gameId, mySeat) : null;
  return {
    roomId: room.roomId,
    mode: room.mode,
    difficulty: room.difficulty,
    hostId: room.hostId,
    players: room.players,
    status: room.status,
    gameId: room.gameId,
    mySeat,
    state: game,
  };
}

export function startRoom(roomId: string, clientId: string): { error?: string; gameId?: string; state?: GameState; snapshots?: Snapshot[] } {
  const room = rooms.get(roomId);
  if (!room) return { error: '房间不存在' };
  if (room.hostId !== clientId) return { error: '只有房主可以开始' };
  if (room.status !== 'waiting') return { error: '房间已开始' };
  const seatNames = room.players.map((p) => p?.name ?? null);
  if (seatNames.every((n) => n === null)) return { error: '还没有玩家' };
  const mySeat = seatOf(room, clientId)!;
  const result = createOnlineGame(room.mode, room.difficulty, seatNames, mySeat);
  room.gameId = result.gameId;
  room.status = 'playing';
  // 初始化 WS 调度所需字段
  room.state = result.state;
  room.snapshots = result.snapshots || [];
  room.aiPlayers = room.state.players.map(() => ({ hand: [] as string[] }));
  room.mySeat = mySeat;
  return { gameId: result.gameId, state: result.state, snapshots: result.snapshots };
}

// 供 WS 恢复 AI 占位（aiPlayers 目前仅占位，实际 AI 用 gameService InternalGame）
export function rebuildRoomAI(roomId: string): AIPlayerPlaceholder[] | null {
  const room = rooms.get(roomId);
  if (!room || !room.state) return null;
  room.aiPlayers = room.state.players.map((p) => ({ hand: (p.hand ?? []).map((c) => c.id) }));
  return room.aiPlayers;
}

// ===== 对局动作（转发到通用游戏引擎，按座位执行） =====

export function removeRoom(roomId: string): void {
  rooms.delete(roomId);
}

interface ActionOut {
  state: GameState | null;
  error?: string;
  snapshots?: Snapshot[];
}

function runOnSeat(roomId: string, clientId: string, fn: (gameId: string, seat: Seat) => ActionOut): ActionOut {
  const room = rooms.get(roomId);
  if (!room) return { state: null, error: '房间不存在' };
  if (!room.gameId) return { state: null, error: '对局尚未开始' };
  const seat = seatOf(room, clientId);
  if (seat === null) return { state: null, error: '你不在该房间中' };
  const r = fn(room.gameId, seat);
  // 无论成功或失败，同步最新状态到 room.state（失败时也可能返回最新 state）
  if (r.state) room.state = r.state;
  if (r.snapshots && r.snapshots.length > 0) {
    room.snapshots = (room.snapshots || []).concat(r.snapshots);
  }
  return r;
}

export function onlineBid(roomId: string, clientId: string, bid: number): ActionOut {
  return runOnSeat(roomId, clientId, (gameId, seat) => {
    const r = playerBid(gameId, bid, seat);
    return { state: r.state, snapshots: r.snapshots, error: r.error };
  });
}

export function onlinePlay(roomId: string, clientId: string, cards: Card[], choice?: { type: string; mainRank: number }): ActionOut {
  return runOnSeat(roomId, clientId, (gameId, seat) => {
    const r = playerPlay(gameId, cards, seat, choice);
    return { state: r.state, snapshots: r.snapshots, error: r.error };
  });
}

/** 联机：分析选牌可构成的所有牌型解（癞子多解选择用） */
export function onlineAnalyze(roomId: string, clientId: string, cards: Card[]): { plays: PlayChoice[]; error?: string } {
  const room = rooms.get(roomId);
  if (!room) return { plays: [], error: '房间不存在' };
  if (!room.gameId) return { plays: [], error: '对局尚未开始' };
  const seat = seatOf(room, clientId);
  if (seat === null) return { plays: [], error: '你不在该房间中' };
  return playerAnalyze(room.gameId, cards, seat);
}

export function onlinePass(roomId: string, clientId: string): ActionOut {
  return runOnSeat(roomId, clientId, (gameId, seat) => {
    const r = playerPass(gameId, seat);
    return { state: r.state, snapshots: r.snapshots, error: r.error };
  });
}

export function onlineMenzhua(roomId: string, clientId: string, choice: 'menzhua' | 'kanpai'): ActionOut {
  return runOnSeat(roomId, clientId, (gameId, seat) => {
    const r = playerMenzhua(gameId, choice, seat);
    return { state: r.state, snapshots: r.snapshots, error: r.error };
  });
}

export function onlineHint(roomId: string, clientId: string): Card[] | null {
  const room = rooms.get(roomId);
  if (!room || !room.gameId) return null;
  const seat = seatOf(room, clientId);
  if (seat === null) return null;
  return playerHint(room.gameId, seat);
}