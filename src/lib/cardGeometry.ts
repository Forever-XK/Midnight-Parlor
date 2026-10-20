export interface Point { x: number; y: number }
export interface CardBounds { left: number; top: number; width: number; height: number }

export function boundsInTable(bounds: CardBounds, table: CardBounds, width: number, height: number, rotated: boolean) {
  const sx = (rotated ? table.height : table.width) / width || 1;
  const sy = (rotated ? table.width : table.height) / height || 1;
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const w = (rotated ? bounds.height : bounds.width) / sx;
  const h = (rotated ? bounds.width : bounds.height) / sy;
  return {
    x: (rotated ? centerY - table.top : centerX - table.left) / sx - w / 2,
    y: (rotated ? table.left + table.width - centerX : centerY - table.top) / sy - h / 2,
    width: w, height: h,
  };
}

/** Convert a viewport displacement into the table's scaled/rotated coordinates. */
export function cardFlightPose(source: CardBounds, target: CardBounds, localWidth: number, rotated: boolean) {
  const zoom = (rotated ? target.height : target.width) / localWidth || 1;
  const dx = source.left + source.width / 2 - target.left - target.width / 2;
  const dy = source.top + source.height / 2 - target.top - target.height / 2;
  return { x: (rotated ? dy : dx) / zoom, y: (rotated ? -dx : dy) / zoom,
    scale: (rotated ? source.height : source.width) / ((rotated ? target.height : target.width) || 1) };
}

export function measureHandTargets(element: HTMLElement): Map<string, Point> {
  const targets = new Map<string, Point>();
  if (document.body.classList.contains('ddz-rotated')) return targets;
  const rect = element.getBoundingClientRect();
  const scaleX = rect.width / element.clientWidth;
  const scaleY = rect.height / element.clientHeight;
  const scope = element.closest('.personalization-stage') ?? document;
  scope.querySelectorAll<HTMLElement>('.dph-hand-tray [data-card-id]').forEach(card => {
    const bounds = card.getBoundingClientRect();
    if (card.dataset.cardId) targets.set(card.dataset.cardId, {
      x: (bounds.left - rect.left) / scaleX - element.clientWidth / 2,
      y: (bounds.top - rect.top) / scaleY - element.clientHeight / 2,
    });
  });
  return targets;
}
