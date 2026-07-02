// GameConfig — bundles per-game data for the Pixi engine.
//
// Static-everywhere universals (BPS_DIVISOR, MIN_MATCHING_REELS, SymbolId
// enum, atlas-mapping, dark/light mode tokens from CANVAS_THEME)
// intentionally do NOT live in this interface — they don't change between
// generated games and are imported directly.
//
// What IS per-game:
//   - the grid shape (5×3 vs 5×5, and post-V2 any 3–7 × 3–5)
//   - the math (reel strips, paytable, FS params, max-win)
//   - the theme (branding palette, per-symbol colours/labels for placeholder
//     tile rendering when no atlases are loaded)
//
// Production code paths (App.tsx → useGameState → PixiApp) keep working by
// passing DEFAULT_GAME_CONFIG (or omitting the param) — V1 5×3 default. The
// wizard preview and future per-game deployments build their own GameConfig
// with the right gridConfig for the math profile.

import { REEL_STRIPS, REEL_LENGTHS, VISIBLE_ROWS } from '@/config/reels';
import { PAY_TABLE, SCATTER_PAY, type PayEntry } from '@/config/paytable';
import { GAME_CONFIG } from '@/config/gameConfig';
import { CANVAS_THEME } from '@/config/canvasTheme';
import { SYMBOLS, type SymbolIdType } from '@/config/symbols';
import { GRID_5x3, GRID_5x5, type GridConfig } from '@/config/gridConfig';
import type { ComponentType } from 'react';
import type { Texture } from 'pixi.js';

/** Generic icon component that accepts size/color/weight props.
 *  Both Lucide (lucide-react) and Phosphor (@phosphor-icons/react) match
 *  this shape — we support either, swappable per theme without changing
 *  the renderer. Phosphor's `weight` prop ("fill" | "duotone" | etc.) is
 *  what gives icons proper game-art weight; Lucide's strokeWidth is
 *  wider-stroke equivalent. */
export type ThemeIcon = ComponentType<{
  size?: number | string;
  color?: string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
}> & {
  // Some icon libs return ForwardRef components — the call site renders via
  // createElement so we don't need to express that here.
  displayName?: string;
};

/** Per-game theme tokens used by PixiApp + AnimatedSymbol for branding.
 *  Dark/light mode tokens (background, frame, separator etc.) stay
 *  in CANVAS_THEME.modes — they're orthogonal to per-game theme. */
export interface GameTheme {
  /** Title text shown above the reels (e.g. "FANTASY SLOTS"). */
  title: string;
  /** Primary brand colour — ambient glow, title shadow, frame highlight. */
  accent: number;
  /** Secondary accent — inner glow, win banner gradient end. */
  accent2: number;
  /** Win banner background colour. */
  winBanner: number;
  /** Per-symbol placeholder colour, indexed by SymbolId. */
  symbolColors: Record<SymbolIdType, number>;
  /** Per-symbol fallback glyph (emoji or letter) for the placeholder tile —
   *  used when no Lucide icon is supplied (production game / unthemed). */
  symbolLabels: Record<SymbolIdType, string>;
  /** Per-symbol icon component (Phosphor or Lucide). The renderer
   *  pre-rasterises these to Pixi Textures (white-on-colour) at init time
   *  so themed games show proper vector iconography. Optional — themes
   *  without iconComponents fall through to symbolLabels rendering. */
  iconComponents?: Partial<Record<SymbolIdType, ThemeIcon>>;
  /** Set at runtime by PixiApp.init() once Lucide components have been
   *  rasterised. AnimatedSymbol reads this to render sprites. */
  iconTextures?: Map<number, Texture>;
  /** User-uploaded PNG overrides (wizard Asset Swap). When set, takes
   *  precedence over iconTextures and renders without tint at near-full
   *  tile size — these are the user's own art and shouldn't be recoloured. */
  userAssetTextures?: Map<number, Texture>;
}

export interface GameConfig {
  /** Grid shape (reelCount × visibleRows). Drives evaluator loop bounds,
   *  renderer layout, and validator parity. Defaults to GRID_5x3 in
   *  DEFAULT_GAME_CONFIG so V1 callers get unchanged behaviour. */
  readonly gridConfig: GridConfig;
  readonly reelStrips: ReadonlyArray<ReadonlyArray<number>>;
  readonly reelLengths: ReadonlyArray<number>;
  readonly payTable: Partial<Record<number, PayEntry>>;
  readonly scatterPay: PayEntry;
  readonly freeSpinsCount: number;
  readonly freeSpinsCap: number;
  readonly freeSpinsMultiplier: number;
  readonly maxWinMultiplier: number;
  readonly theme: GameTheme;
  /** Whether the near-miss anticipation tease plays — gated by the build's
   *  'near-miss-tease' feature. Undefined = enabled (V1 / default behaviour,
   *  so existing callers don't regress). */
  readonly nearMissTease?: boolean;
  /** Bonus-buy cost as a multiple of the bet (the 'bonus-buy' feature). Buying
   *  pays this × bet to jump straight into the free-spins round. Undefined when
   *  the feature isn't selected. */
  readonly bonusBuyCost?: number;
}

/** Default theme — chain.wtf branded blue. Mirrors current static SYMBOLS map. */
export const DEFAULT_GAME_THEME: GameTheme = {
  title: CANVAS_THEME.title,
  accent: CANVAS_THEME.accent,
  accent2: CANVAS_THEME.accent2,
  winBanner: CANVAS_THEME.winBanner,
  symbolColors: Object.fromEntries(
    Object.entries(SYMBOLS).map(([id, def]) => [Number(id), def.placeholderColor]),
  ) as Record<SymbolIdType, number>,
  symbolLabels: Object.fromEntries(
    Object.entries(SYMBOLS).map(([id, def]) => [Number(id), def.label]),
  ) as Record<SymbolIdType, string>,
};

/** Grid derived from the PER-BUILD reels config (reels.ts is regenerated by
 *  contractRenderer for each game). Without this, a deployed 5×5 game would keep
 *  the hardcoded 5×3 grid — its board would be built/rendered/evaluated as 3 rows
 *  while the reels carry 5 — so the production path (App.tsx → `new PixiApp()`,
 *  which uses DEFAULT_GAME_CONFIG) silently broke 5×5. Baseline reels.ts is 5×3,
 *  so this stays GRID_5x3 there. (V2 is 5 reels; ≥6-reel grids are Stage 3.) */
const DEFAULT_GRID: GridConfig = (VISIBLE_ROWS as number) === 5 ? GRID_5x5 : GRID_5x3;

/** Default config — production code path (App.tsx/harness) uses this. The grid
 *  now follows the build's reels.ts so 5×5 deployments render + evaluate 5 rows;
 *  a 5×3 build is byte-for-byte unchanged. */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  gridConfig: DEFAULT_GRID,
  reelStrips: REEL_STRIPS,
  reelLengths: REEL_LENGTHS,
  payTable: PAY_TABLE,
  scatterPay: SCATTER_PAY,
  freeSpinsCount: GAME_CONFIG.freeSpinsCount,
  freeSpinsCap: GAME_CONFIG.freeSpinsCap,
  freeSpinsMultiplier: GAME_CONFIG.freeSpinsMultiplier,
  maxWinMultiplier: 5000,
  theme: DEFAULT_GAME_THEME,
};
