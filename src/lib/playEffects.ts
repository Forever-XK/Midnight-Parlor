import type { Play, PlayType } from '@shared/types';

export type PlayEffectType = 'bomb' | 'rocket' | 'straight' | 'pair_straight' | 'airplane';

export function playEffectType(type: PlayType): PlayEffectType | null {
  if (type === 'airplane' || type === 'airplane_single' || type === 'airplane_pair') return 'airplane';
  return type === 'bomb' || type === 'rocket' || type === 'straight' || type === 'pair_straight' ? type : null;
}

/** Combo effects stay shorter and smaller than bombs and rockets. Milliseconds. */
export const COMBO_EFFECT_MS = { straight: 1200, pair_straight: 1250, airplane: 1400 };

/** Only a rendered hand's flight event may request an effect, never game.log. */
export function effectForPlayedHand(gameId: string, play: Play, seat?: number) {
  const type = playEffectType(play.type);
  return type ? { type, key: `${gameId}:${play.cards.map(card => card.id).join(',')}`, seat } : null;
}
