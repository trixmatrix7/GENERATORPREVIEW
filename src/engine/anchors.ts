// engine/anchors.ts — grid-relative anchor system. HARD INVARIANT: renderers
// position everything via anchors resolved against the current grid, never raw
// pixels, so one registry entry works on both 5x5 and 5x3. Mirrors the dev
// generator's src/engine/anchors.ts surface (cell / reel / grid / resolveAnchor).

import { computeLayout, type GridSpec, type GridLayout } from '../config/gridConfig';

export interface Rect {
  x: number; // center x
  y: number; // center y
  w: number;
  h: number;
}

export type Anchor =
  | { kind: 'cell'; reel: number; row: number }
  | { kind: 'reel'; reel: number }
  | { kind: 'row'; row: number }
  | { kind: 'grid' } // grid:center, full grid rect
  | { kind: 'line'; a: { reel: number; row: number }; b: { reel: number; row: number } };

export const cellAnchor = (reel: number, row: number): Anchor => ({ kind: 'cell', reel, row });
export const reelAnchor = (reel: number): Anchor => ({ kind: 'reel', reel });
export const rowAnchor = (row: number): Anchor => ({ kind: 'row', row });
export const gridAnchor = (): Anchor => ({ kind: 'grid' });
export const lineAnchor = (
  a: { reel: number; row: number },
  b: { reel: number; row: number },
): Anchor => ({ kind: 'line', a, b });

export function resolveAnchor(anchor: Anchor, grid: GridSpec, layout?: GridLayout): Rect {
  const L = layout ?? computeLayout(grid);
  switch (anchor.kind) {
    case 'cell': {
      const c = L.cellCenter(anchor.reel, anchor.row);
      return { x: c.x, y: c.y, w: L.cellW, h: L.cellH };
    }
    case 'reel': {
      const x = L.reelX(anchor.reel) + L.cellW / 2;
      return { x, y: L.height / 2, w: L.cellW, h: L.height };
    }
    case 'row': {
      const y = L.rowY(anchor.row) + L.cellH / 2;
      return { x: L.width / 2, y, w: L.width, h: L.cellH };
    }
    case 'grid':
      return { x: L.width / 2, y: L.height / 2, w: L.width, h: L.height };
    case 'line': {
      const ca = L.cellCenter(anchor.a.reel, anchor.a.row);
      const cb = L.cellCenter(anchor.b.reel, anchor.b.row);
      return { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2, w: Math.abs(cb.x - ca.x), h: Math.abs(cb.y - ca.y) };
    }
  }
}

/** Cell rect convenience used everywhere by the renderers. */
export function cellRect(reel: number, row: number, grid: GridSpec, layout?: GridLayout): Rect {
  return resolveAnchor(cellAnchor(reel, row), grid, layout);
}
