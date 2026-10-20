import type { GameState } from '@shared/types';

export const SPRING_EFFECT_MS = 2400;
export const VICTORY_EFFECT_MS = 1300;
export type ConclusionStep = { kind: 'wait'; ms: number } | { kind: 'hand'; ms: number; seat: number }
  | { kind: 'spring'; ms: number; reverse: boolean } | { kind: 'victory'; ms: number; winner: 'landlord' | 'peasant' }
  | { kind: 'result'; ms: number };

export function conclusionSteps(state: Pick<GameState, 'players' | 'multiplier'> & { result?: GameState['result'] }): ConclusionStep[] {
  const steps: ConclusionStep[] = [{ kind: 'wait', ms: 300 }];
  for (const player of state.players) {
    if (player.hand?.length) steps.push({ kind: 'hand', seat: player.seat, ms: 1500 });
  }
  if (state.multiplier.spring || state.multiplier.antiSpring) {
    steps.push({ kind: 'spring', reverse: state.multiplier.antiSpring, ms: SPRING_EFFECT_MS });
  }
  if (state.result) steps.push({ kind: 'victory', winner: state.result.winner, ms: VICTORY_EFFECT_MS });
  return [...steps, { kind: 'result', ms: 0 }];
}
