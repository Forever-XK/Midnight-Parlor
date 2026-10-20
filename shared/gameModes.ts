import type { GameMode } from './types';

export const GAME_MODES: readonly GameMode[] = ['classic', 'unshuffled', 'laizi', 'laizi_unshuffled', 'tiandilaizi', 'menzhua'];
export function isGameMode(value: unknown): value is GameMode {
  return typeof value === 'string' && (GAME_MODES as readonly string[]).includes(value);
}
export const usesPacketDeal = (mode: GameMode) => mode === 'unshuffled' || mode === 'laizi_unshuffled';
export const usesSingleLaizi = (mode: GameMode) => mode === 'laizi' || mode === 'laizi_unshuffled';
