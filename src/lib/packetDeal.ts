import type { Card, PlayerPublic, Seat } from '@shared/types';
import { sortCardsDesc } from './cards';
import { PACKET_DEAL } from '../config/dealAnimations';

export interface PacketCard {
  card: Card;
  seat: Seat;
  arrivalIndex: number;
  sortedIndex: number;
  packet: number;
  delay: number;
  tilt: number;
  offsetY: number;
}

function randomFor(seed: string) {
  let value = 2166136261;
  for (const char of seed) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return () => {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

export function shuffledCards(cards: Card[], seed: string): Card[] {
  const shuffled = [...cards];
  const random = randomFor(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (shuffled.length > 1 && shuffled.every((card, i) => card.id === cards[i].id)) shuffled.push(shuffled.shift()!);
  return shuffled;
}

/** Freeze a visual deal without mutating server hands or reading other seats' cards. */
export function buildPacketDeal(players: PlayerPublic[], mySeat: Seat, gameId: string, laiziRanks: number[] = []): PacketCard[] {
  const seats: Seat[] = [((mySeat + 2) % 3) as Seat, mySeat, ((mySeat + 1) % 3) as Seat];
  return seats.flatMap((seat, seatOrder) => {
    const player = players.find(p => p.seat === seat);
    const count = Math.min(player?.cardCount ?? 17, 17);
    const sorted = seat === mySeat && player?.hand
      ? sortCardsDesc(player.hand, laiziRanks).slice(0, count)
      : Array.from({ length: count }, (_, i): Card => ({ id: `hidden-${seat}-${i}`, suit: 'club', rank: 3 }));
    const shuffled = shuffledCards(sorted, `${gameId}:${seat}`);
    const random = randomFor(`${gameId}:${seat}`);
    const sortedIndices = new Map(sorted.map((card, i) => [card.id, i]));
    return shuffled.map((card, arrivalIndex) => {
      let packet = 0, firstIndex = 0;
      while (packet < PACKET_DEAL.batches.length - 1 && arrivalIndex >= firstIndex + PACKET_DEAL.batches[packet]) {
        firstIndex += PACKET_DEAL.batches[packet++];
      }
      return {
        card, seat, arrivalIndex, sortedIndex: sortedIndices.get(card.id)!, packet,
        delay: (packet * 3 + seatOrder) * PACKET_DEAL.packetGap + (arrivalIndex - firstIndex) * PACKET_DEAL.cardGap,
        tilt: (random() - .5) * 16, offsetY: (random() - .5) * 14,
      };
    });
  });
}

export function packetDealTimeline(items: PacketCard[]) {
  const sortAt = Math.max(0, ...items.map(item => item.delay)) + PACKET_DEAL.flight + PACKET_DEAL.pause;
  return { sortAt, doneAt: sortAt + PACKET_DEAL.sort + PACKET_DEAL.settle };
}
