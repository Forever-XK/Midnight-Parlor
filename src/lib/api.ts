// 前端 API 通信层
import axios from 'axios';
import type {
  Card, CreateGameResponse, Difficulty, GameMode, GameState, Snapshot, Stats,
} from '@shared/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

export async function createGame(mode: GameMode, difficulty: Difficulty, playerName?: string): Promise<CreateGameResponse> {
  const { data } = await api.post('/game/create', { mode, difficulty, playerName });
  return data;
}

export async function bidGame(gameId: string, bid: number): Promise<{ state: GameState; snapshots: Snapshot[] }> {
  const { data } = await api.post(`/game/${gameId}/bid`, { bid });
  return data;
}

/** 癞子多解：选牌可构成的一种牌型解 */
export interface PlayChoiceInfo {
  type: string;
  mainRank: number;
  length: number;
  isLaiziBomb?: boolean;
  beats: boolean; // 能否压过当前上家牌（领出阶段恒为 true）
}

export async function playGame(
  gameId: string,
  cards: Card[],
  choice?: { type: string; mainRank: number },
): Promise<{ state: GameState; snapshots: Snapshot[] }> {
  const { data } = await api.post(`/game/${gameId}/play`, {
    cards,
    playType: choice?.type,
    mainRank: choice?.mainRank,
  });
  return data;
}

/** 分析选牌可构成的所有牌型解（癞子多解选择用） */
export async function analyzeGame(gameId: string, cards: Card[]): Promise<{ plays: PlayChoiceInfo[] }> {
  const { data } = await api.post(`/game/${gameId}/analyze`, { cards });
  return data;
}

export async function passGame(gameId: string): Promise<{ state: GameState; snapshots: Snapshot[] }> {
  const { data } = await api.post(`/game/${gameId}/pass`, {});
  return data;
}

export async function hintGame(gameId: string): Promise<{ cards: Card[] | null }> {
  const { data } = await api.post(`/game/${gameId}/hint`, {});
  return data;
}

export async function menzhuaGame(
  gameId: string,
  choice: 'menzhua' | 'kanpai',
): Promise<{ state: GameState; snapshots: Snapshot[] }> {
  const { data } = await api.post(`/game/${gameId}/menzhua`, { choice });
  return data;
}

export async function getStats(user?: string): Promise<Stats> {
  const { data } = await api.get('/stats', { params: user ? { user } : undefined });
  return data;
}
