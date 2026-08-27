// 联机对战 API 通信层 + 身份信息持久化
import axios from 'axios';
import type { Card, Difficulty, GameMode, GameState, Seat, Snapshot } from '@shared/types';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

// ===== 身份持久化 =====
const CID_KEY = 'ddz_client_id';
const NAME_KEY = 'ddz_player_name';

export function getClientId(): string {
  let id = localStorage.getItem(CID_KEY);
  if (!id) {
    // 简单 UUID（浏览器无安全要求）
    id = (`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
    localStorage.setItem(CID_KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  return localStorage.getItem(NAME_KEY) || '';
}
export function setPlayerName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}

export interface RoomListItem {
  roomId: string;
  mode: GameMode;
  hostName: string;
  playerCount: number;
  playerNames: string[];
}

export interface RoomState {
  roomId: string;
  mode: GameMode;
  difficulty: Difficulty;
  hostId: string;
  players: ({ clientId: string; name: string; seat: Seat; isHost: boolean } | null)[];
  status: 'waiting' | 'playing' | 'finished';
  gameId: string | null;
  mySeat: Seat | null;
  state: GameState | null;
}

export interface WithSnapshots {
  snapshots?: Snapshot[];
}

export async function listRooms(): Promise<RoomListItem[]> {
  const { data } = await api.post('/multi/room/list', {});
  return data.rooms;
}

export async function createRoom(mode: GameMode, difficulty: Difficulty, name: string): Promise<string> {
  const { data } = await api.post('/multi/room/create', {
    clientId: getClientId(), name, mode, difficulty,
  });
  return data.roomId as string;
}

export async function joinRoom(roomId: string, name: string): Promise<string> {
  const { data } = await api.post(`/multi/room/${roomId}/join`, {
    clientId: getClientId(), name,
  });
  return data.roomId as string;
}

export async function leaveRoom(roomId: string): Promise<void> {
  await api.post(`/multi/room/${roomId}/leave`, { clientId: getClientId() });
}

export async function startRoom(roomId: string): Promise<{ gameId: string; state: GameState; snapshots?: Snapshot[] }> {
  const { data } = await api.post(`/multi/room/${roomId}/start`, { clientId: getClientId() });
  return data;
}

export async function fetchRoomState(roomId: string): Promise<RoomState> {
  const { data } = await api.get(`/multi/room/${roomId}/state`, {
    params: { clientId: getClientId() },
  });
  return data;
}

// ===== 对局动作 =====
export async function onlineBid(roomId: string, bid: number): Promise<{ state: GameState } & WithSnapshots> {
  const { data } = await api.post(`/multi/room/${roomId}/bid`, { clientId: getClientId(), bid });
  return data;
}
export async function onlinePlay(
  roomId: string,
  cards: Card[],
  choice?: { type: string; mainRank: number },
): Promise<{ state: GameState } & WithSnapshots> {
  const { data } = await api.post(`/multi/room/${roomId}/play`, {
    clientId: getClientId(),
    cards,
    playType: choice?.type,
    mainRank: choice?.mainRank,
  });
  return data;
}
/** 分析选牌可构成的所有牌型解（癞子多解选择用） */
export async function onlineAnalyze(roomId: string, cards: Card[]): Promise<{ plays: import('./api').PlayChoiceInfo[] }> {
  const { data } = await api.post(`/multi/room/${roomId}/analyze`, { clientId: getClientId(), cards });
  return data;
}
export async function onlinePass(roomId: string): Promise<{ state: GameState } & WithSnapshots> {
  const { data } = await api.post(`/multi/room/${roomId}/pass`, { clientId: getClientId() });
  return data;
}
export async function onlineHint(roomId: string): Promise<{ cards: Card[] | null }> {
  const { data } = await api.post(`/multi/room/${roomId}/hint`, { clientId: getClientId() });
  return data;
}
export async function onlineMenzhua(
  roomId: string,
  choice: 'menzhua' | 'kanpai',
): Promise<{ state: GameState } & WithSnapshots> {
  const { data } = await api.post(`/multi/room/${roomId}/menzhua`, {
    clientId: getClientId(),
    choice,
  });
  return data;
}