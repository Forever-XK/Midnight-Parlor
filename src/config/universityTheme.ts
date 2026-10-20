import type { Card } from '@shared/types';

/** Same rank convention as the game: A=14, 2=15, jokers=16/17. */
export function universityCardImage(card: Card, rank: number = card.rank) {
  return `${import.meta.env.BASE_URL}cards/university/${rank >= 16 ? 'joker' : card.suit}-${rank}.png`;
}
