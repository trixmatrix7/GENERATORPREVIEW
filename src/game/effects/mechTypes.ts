// Mechanic-showcase contract — like fxTypes but with CELL-LEVEL powers: spawn
// symbol tiles, re-skin cells (display-only), roll the reels. Every mechanic
// is OUTCOME-NEUTRAL (visual showcase of a mechanic — the math never moves)
// and grid/theme-agnostic → 1:1 mappable onto generator baseFeatures /
// bonusMechanics entries later. Overlays ride the sticky lifecycle: whatever
// a mechanic leaves on screen is cleared by the next spin automatically.

import type { Container } from 'pixi.js';
import type { gsap as GsapType } from 'gsap';
import type { FxRect } from './fxTypes';

export interface MechContext {
  /** Overlay container in GRID-LOCAL coords, above the reels. Cleared on the
   *  next spin (sticky lifecycle) — don't destroy it yourself. */
  overlay: Container;
  grid: { reels: number; rows: number };
  cellRect(reel: number, row: number): FxRect;
  reelRect(reel: number): FxRect;
  gridRect(): FxRect;
  /** Spawn a full symbol TILE (opaque backing + the symbol's real art) popped
   *  into a cell with the premium landing beat. Returns the tile container
   *  (already positioned/scaled; animate it freely). withShine adds the AAA
   *  border. Symbol ids: 0 WILD, 1 SCATTER, 2/3 HIGH_A/B, 4/5 MID, 6-8 LOW. */
  spawnTile(symbolId: number, reel: number, row: number, withShine?: boolean): Container;
  /** Re-skin the UNDERLYING board cell (display-only; next spin rewrites it). */
  setCellSymbol(reel: number, row: number, symbolId: number): void;
  getCellSymbol(reel: number, row: number): number;
  /** Play a symbol state on the underlying cell ('win' | 'featured' | 'static'). */
  playCellState(reel: number, row: number, state: 'win' | 'featured' | 'static'): void;
  /** Roll ALL reels and settle on random display stops (display-only). */
  rollAndSettle(): Promise<void>;
  /** Momentary board dim veil (auto-removed when the mechanic's layer clears). */
  dimBoard(alpha?: number): void;
  undimBoard(): void;
  accent: number;
  gold: number;
  gsap: typeof GsapType;
  track<T extends { kill(): void }>(t: T): T;
  rand(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  /** Cancellation check — long choreographies should bail when false. */
  alive(): boolean;
}

export interface MechEntry {
  id: string;
  name: string;
  description: string;
  /** Full choreography — may await rolls/beats. Bail early if !ctx.alive(). */
  run(ctx: MechContext): Promise<void>;
}
