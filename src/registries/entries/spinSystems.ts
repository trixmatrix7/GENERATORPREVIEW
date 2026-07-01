// Spin systems — the visual spin/fill style (OVERLAY, swappable + code-addable).
// The math + fill order are SPEC and frozen; this only changes how the board
// animates in. Add your own by pasting a SpinSystemEntry in the code panel.
import type { SpinSystemEntry } from '../types';

export const spinSystems: SpinSystemEntry[] = [
  {
    id: 'spin-reel',
    name: 'Reel Spin (spec)',
    description:
      'SPEC-ACCURATE default. Each reel vertically scrolls its real 40-symbol strip (engine/reels.ts) and decelerates to a stop on seed%40, so you see the actual neighbouring strip symbols pass by and land on strip[(stop+row)%40] = the spec board. Derived purely from the spec — no invented feel.',
    version: '1.0.0',
    implemented: true,
    style: 'reel-spin',
    params: { spinMs: 640, staggerMs: 120 },
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'spin-drop',
    name: 'Drop',
    description: 'Alternative: symbols fall in from above per column (staggered) with an outBack settle.',
    version: '1.0.0',
    implemented: true,
    style: 'drop',
    params: { dropDurationMs: 400, staggerMs: 60, rowGapMs: 30 },
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'spin-slam',
    name: 'Slam',
    description: 'Fast drop + heavy squash impact. Punchy, high-tempo feel.',
    version: '1.0.0',
    implemented: true,
    style: 'slam',
    params: { dropDurationMs: 220, staggerMs: 40, rowGapMs: 14 },
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'spin-fade',
    name: 'Fade In',
    description: 'Symbols fade + scale in per cell (cascade-style materialise). No drop.',
    version: '1.0.0',
    implemented: true,
    style: 'fade',
    params: { fadeMs: 320, staggerMs: 26 },
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
];
