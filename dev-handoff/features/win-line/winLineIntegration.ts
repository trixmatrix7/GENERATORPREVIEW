// winLineIntegration.ts — how to wire WaysLightComet into your reel layer.
// This is the EXACT fire logic from the runtime (fireWaysLight +
// fireWaysLightSequential), reduced to the two engine touch-points you provide:
//   • cellCentre(reel, row) — the pixel centre of a cell in reel-container coords
//   • waysLightContainer    — a Container on TOP of your reels for the fx
//
// Copy the two functions; swap the two `declare`d hooks for your own.

import {
  playWaysLight, clearAllWaysLight, waysLightConfig,
  WAYS_LIGHT_PRESETS, WAYS_LIGHT_SPEED_MS, WAYS_LIGHT_WIDTH_PX,
} from './WaysLightComet';
import type { Container } from 'pixi.js';

// A winning combination = its member cells as [row, reel] (your win evaluator's
// output). The comet groups these by reel and connects every cell of reel k to
// every cell of reel k+1 (bipartite = ways).
type Cell = [row: number, reel: number];
interface WinCombination { cells: Cell[]; matchCount?: number }

// ── YOUR two engine hooks ────────────────────────────────────────────────────
declare function cellCentre(reel: number, row: number): { x: number; y: number };
declare const waysLightContainer: Container;

// ── 1) live-config wiring (paste into your applyVisualParam switch) ───────────
// Also set the cell size once (so the comet head scales): at build time do
//   waysLightConfig.cellSize = yourCellWidthPx;
export function applyWinLineParam(id: string, value: string | number | boolean): boolean {
  switch (id) {
    case 'waysLight': waysLightConfig.enabled = String(value) !== 'off'; return true;
    case 'waysLightColor': {
      const preset = WAYS_LIGHT_PRESETS[String(value)];
      if (preset) waysLightConfig.color = preset.color;
      return true;
    }
    case 'waysLightSpeed': waysLightConfig.stepMs = WAYS_LIGHT_SPEED_MS[String(value)] ?? waysLightConfig.stepMs; return true;
    case 'waysLightWidth': waysLightConfig.width = WAYS_LIGHT_WIDTH_PX[String(value)] ?? waysLightConfig.width; return true;
    default: return false;
  }
}

// ── 2) fire it, per winning combination ──────────────────────────────────────
/** One winning combination → comet through its ways-connection. */
export function fireWaysLight(combo: WinCombination): Promise<void> {
  if (!waysLightConfig.enabled) return Promise.resolve();
  const byReel = new Map<number, Array<{ x: number; y: number }>>();
  for (const [row, reel] of combo.cells) {
    const arr = byReel.get(reel) ?? [];
    arr.push(cellCentre(reel, row));
    byReel.set(reel, arr);
  }
  const reels = [...byReel.keys()].sort((a, b) => a - b).map(k => byReel.get(k)!);
  if (reels.length >= 2) return playWaysLight(waysLightContainer, reels);
  return Promise.resolve();
}

/** Run each combo's comet ONE AFTER ANOTHER ("line nach line"). Call this after
 *  your win reveal, e.g. `void fireWaysLightSequential(winResult.combinations)`. */
export async function fireWaysLightSequential(combos: readonly WinCombination[]): Promise<void> {
  for (const combo of combos) {
    if (!waysLightConfig.enabled) return;
    await fireWaysLight(combo);
  }
}

// ── 3) on new spin / clearHighlights ─────────────────────────────────────────
// Call clearAllWaysLight() to kill any in-flight comet:
//   clearHighlights() { /* ...your teardown... */ clearAllWaysLight(); }
export { clearAllWaysLight };
