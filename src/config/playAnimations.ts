import { DPH_THEME } from './dphTheme';

export type HeavyPlay = 'bomb' | 'rocket';

/** Cards hit the table on the existing bomb / rocket explosion frame. */
export function heavyPlayTiming(type: HeavyPlay) {
  const impactMs = type === 'bomb' ? DPH_THEME.effects.bombThrowMs
    : DPH_THEME.effects.rocketLaunchMs + DPH_THEME.effects.rocketFallMs;
  const durationMs = impactMs + 220;
  return { impactMs, duration: durationMs / 1000,
    times: [0, impactMs * .16, impactMs * .5, impactMs * .82, impactMs, impactMs + 80, durationMs].map(ms => ms / durationMs) };
}

export function heavyCardMotion(source: { x: number; y: number; scale: number }, type: HeavyPlay, index: number, count: number) {
  const fan = index - (count - 1) / 2;
  const direction = source.x > 0 ? -1 : 1;
  return {
    x: [source.x, source.x * 1.04, fan * 25, fan * 22, 0, 0, 0],
    y: [source.y, source.y - 32, -118, -138, 5, -8, 0],
    scale: [source.scale, source.scale * 1.06, 1.52, type === 'rocket' ? 1.72 : 1.62, .95, 1.05, 1],
    rotate: [0, -direction * 18, fan * 5 + direction * 8, fan * 3, 0, 0, 0],
    rotateX: [0, -18, 20, 28, -10, 3, 0],
    opacity: 1,
  };
}
