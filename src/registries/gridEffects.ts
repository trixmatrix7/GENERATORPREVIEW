import { RegistryEntry, createRegistry } from './types.js';

// Grid-effect registry — full-grid or multi-cell visual effects layered over
// the reel area. These complement the per-symbol `symbolAnimations` and the
// per-text `textAnimations`.
//
// Examples: a shock wave when 3 scatters land, a screen shake on mega-wins,
// a full-grid flash on jackpot, a slow-motion dim during anticipation.

export type GridEffectScope =
  | 'full-canvas'    // entire pixi canvas (background, reels, overlays)
  | 'full-grid'      // just the reel area
  | 'reel'           // a single reel column
  | 'symbol-row'     // a horizontal row across all reels
  | 'specific-cells'; // arbitrary set of (row, col) cells

export interface GridEffectEntry extends RegistryEntry {
  trigger: string;
  scope: GridEffectScope;
  duration: number;       // seconds
  intensity: 'subtle' | 'medium' | 'strong';
}

const entries: readonly GridEffectEntry[] = [
  {
    id: 'fs-trigger-shock',
    name: 'Free-Spins Trigger Shock',
    description: 'Concentric shock-wave rings radiating from the grid centre, punctuating the free-spins trigger. Centre-anchored because the triggering board is only revealed on the last free-spin step (not per-scatter).',
    version: '1.0.0',
    implemented: true,
    trigger: 'scatterCount >= 3',
    scope: 'full-grid',
    duration: 1.2,
    intensity: 'strong',
  },
  {
    id: 'mega-win-screen-shake',
    name: 'Mega Win Screen Shake',
    description: 'Camera shake on the canvas during the mega+ win presentation (PixiApp.playCoinWin).',
    version: '1.0.0',
    implemented: true,
    trigger: 'win >= 50× bet',
    scope: 'full-canvas',
    duration: 0.6,
    intensity: 'medium',
  },
  {
    id: 'jackpot-full-flash',
    name: 'Jackpot Flash',
    description: 'Strong full-grid white flash followed by a golden sparkle shower, fired on the top (epic) win tier — the jackpot-class hit.',
    version: '1.0.0',
    implemented: true,
    trigger: 'win == maxWinCap',
    scope: 'full-grid',
    duration: 1.5,
    intensity: 'strong',
  },
  {
    id: 'near-miss-grid-dim',
    name: 'Near-Miss Grid Dim',
    description: 'Brief 30% dim on the rest of the grid when a near-miss tease fires, drawing focus to the teased symbol.',
    version: '0.1.0',
    implemented: false,
    trigger: 'near-miss tease active',
    scope: 'full-grid',
    duration: 0.5,
    intensity: 'subtle',
  },
  {
    id: 'reel-anticipation-slow',
    name: 'Reel Anticipation Slow',
    description: 'Reels after the rightmost scatter decelerate progressively slower when ≥2 scatters are on screen (ReelSet.detectNearMiss); intensity scales with scatter count.',
    version: '1.0.0',
    implemented: true,
    trigger: 'scatterCount on reels 0-3 == 2',
    scope: 'reel',
    duration: 1.5,
    intensity: 'medium',
  },
  {
    id: 'win-row-highlight-band',
    name: 'Winning Row Highlight Band',
    description: 'Horizontal glowing band sweeps across the row of a 5-of-a-kind win (ReelSet.spawnLightSweep).',
    version: '1.0.0',
    implemented: true,
    trigger: '5-of-a-kind win on a single row',
    scope: 'symbol-row',
    duration: 0.8,
    intensity: 'medium',
  },
] as const;

export const gridEffectRegistry = createRegistry(entries, { compatibleGrids: ['5x3', '5x5'] });
