// FX library contract — every showcase effect is a self-contained function
// against this context. Effects are THEME-AGNOSTIC (grid-relative anchors,
// theme accent injected) and OUTCOME-NEUTRAL (visual only), so each one maps
// 1:1 onto a generator registry entry (gridEffects / winPresentation) later.

import type { Container } from 'pixi.js';
import type { gsap as GsapType } from 'gsap';

export interface FxRect { x: number; y: number; w: number; h: number }

export interface FxContext {
  /** Overlay container in GRID-LOCAL coords (same space as cellRect/reelRect),
   *  rendered above the reels. Cleared automatically when the effect ends. */
  layer: Container;
  /** Grid shape. */
  grid: { reels: number; rows: number };
  /** Cell / reel / whole-grid rects in layer-local px. */
  cellRect(reel: number, row: number): FxRect;
  reelRect(reel: number): FxRect;
  gridRect(): FxRect;
  /** Theme accent + win-line gold (use these instead of hard-coded colors). */
  accent: number;
  gold: number;
  /** gsap instance — register EVERY tween/timeline via track() so the effect
   *  is cancellable (dev invariant: win FX cancellable, ≤1.5s core beat). */
  gsap: typeof GsapType;
  track<T extends { kill(): void }>(t: T): T;
  /** Random helpers (cosmetic only — never outcome-affecting). */
  rand(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
}

export type FxGroup = 'win' | 'anticipation' | 'ambient' | 'transition' | 'symbol';

export interface FxEntry {
  id: string;            // kebab-case, unique
  name: string;          // button label
  group: FxGroup;
  description: string;   // one line — what it looks like
  /** Runs the effect. Everything added to ctx.layer + tracked tweens are
   *  auto-cleaned ~4s later (or when the next effect starts). */
  run(ctx: FxContext): void;
}
