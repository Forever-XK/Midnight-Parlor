/** Seconds. Keep visual timing and completion callbacks on the same timeline. */
export const LAIZI_DRAW = {
  enter: 0.25,
  spin: 1.25,
  turns: 3,
  flip: 0.35,
  hold: 0.65,
  exit: 0.2,
};

export const CLASSIC_DEAL = { cardGap: .072, flight: .4, pause: .15 };

export const PACKET_DEAL = {
  batches: [4, 4, 4, 5] as readonly number[],
  packetGap: 0.3,
  cardGap: 0.025,
  flight: 0.5,
  pause: 0.5,
  sort: 0.85,
  settle: 0.4,
};
