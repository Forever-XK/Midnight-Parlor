import type { GameState } from './types';

export function dealKey(state: Pick<GameState, 'gameId' | 'dealNumber'>): string {
  return state.dealNumber ? `${state.gameId}:deal:${state.dealNumber}` : state.gameId;
}
