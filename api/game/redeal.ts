import type { Seat } from '@shared/types';
import { usesSingleLaizi } from '@shared/gameModes';
import { dealForMode, pickLaiziRank } from './cards';
import type { InternalGame } from './store';

/** Shared by offline bidding and the WebSocket AI scheduler. */
export function redealGame(game: InternalGame): void {
  const { hands, bottom } = dealForMode(game.mode);
  game.bidRedealCount++;
  game.hands = hands;
  game.bottomCards = bottom;
  game.laiziRank = usesSingleLaizi(game.mode) ? pickLaiziRank() : null;
  game.tianLaiziRank = game.mode === 'tiandilaizi' ? pickLaiziRank() : null;
  game.diLaiziRank = null;
  game.completedBids = undefined;
  game.log = [];
  game.revealedBottom = false;
  game.mingCard = null;
  game.mingCardSeat = null;
  game.handRevealed = game.mode !== 'menzhua';
  game.menzhuaDoubled = false;
  game.menzhuaPhase = game.mode === 'menzhua' ? 'waiting' : null;
  let seat = Math.floor(Math.random() * 3) as Seat;
  if (game.mode === 'menzhua') {
    const index = Math.floor(Math.random() * 51);
    seat = Math.floor(index / 17) as Seat;
    game.mingCard = hands[seat][index % 17];
    game.mingCardSeat = seat;
  }
  game.currentSeat = seat;
  game.phase = game.mode === 'menzhua' ? 'menzhuaChoice' : 'bidding';
  game.bidState = game.mode === 'menzhua' ? null : {
    currentBidder: seat, startSeat: seat, bids: [], highestBid: 0, highestSeat: null, bidCount: 0,
  };
}
