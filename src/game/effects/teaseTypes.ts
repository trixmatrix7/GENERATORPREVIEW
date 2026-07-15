// Near-miss TEASE preset contract. The real anticipation runtime (scatter
// detection + per-reel deceleration ladder) stays untouched — presets only
// re-style the VISUALS at the two hook points ReelSet dispatches:
//   onScatterLanded  — a scatter just landed during a tease (celebrate it)
//   onPendingReel    — a right-side reel enters the tease ladder while still
//                      spinning (position 0 = first teased reel; stagger your
//                      own beats off `position` — the decel adds 0.35s*(k+1))
// Everything drawn into ctx.layer + tracked tweens are cleared by the runtime
// when the tease resolves (hit or miss) — exits should still fade gracefully.

import type { Container } from 'pixi.js';
import type { gsap as GsapType } from 'gsap';
import type { FxRect } from './fxTypes';

export interface TeaseContext {
  layer: Container; // grid-local, above reels, auto-cleared on tease end
  grid: { reels: number; rows: number };
  cellRect(reel: number, row: number): FxRect;
  reelRect(reel: number): FxRect;
  gridRect(): FxRect;
  accent: number;
  gold: number;
  gsap: typeof GsapType;
  track<T extends { kill(): void }>(t: T): T;
  rand(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  /** Stage-dim a settled cell (eased). The runtime RESTORES every dimmed
   *  cell when the tease resolves — presets never need their own cleanup.
   *  No-ops on cells hidden behind expanding towers. */
  dimCell(reel: number, row: number, alpha: number): void;
  /** WHOLE-OBJECT motion handle for a settled cell — position drift only
   *  (in-place scaling/rotation warps upscaled art). The runtime snapshots
   *  the transform on first access and restores it when the tease resolves.
   *  Null while the reel spins or the cell hides behind a tower. */
  cellNode(reel: number, row: number): Container | null;
}

export interface TeasePreset {
  id: string;
  name: string;
  description: string;
  onScatterLanded(ctx: TeaseContext, reel: number, row: number): void;
  onPendingReel(ctx: TeaseContext, reel: number, position: number): void;
}
