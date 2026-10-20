import type { CardBounds } from './cardGeometry';

const origins = new Map<string, { bounds: CardBounds; at: number }>();

/** Capture selected cards before the request changes/removes the visible hand. */
export function captureHandOrigins(gameId: string, selected: Set<string>) {
  origins.clear();
  document.querySelectorAll<HTMLElement>('.dph-hand-tray [data-card-id]').forEach(element => {
    const id = element.dataset.cardId;
    if (!id || !selected.has(id)) return;
    const bounds = (element.firstElementChild ?? element).getBoundingClientRect();
    origins.set(`${gameId}:${id}`, { bounds, at: performance.now() });
  });
}

export function takeHandOrigin(gameId: string, cardId: string) {
  const key = `${gameId}:${cardId}`;
  const source = origins.get(key);
  origins.delete(key);
  return source && performance.now() - source.at < 15000 ? source.bounds : undefined;
}
