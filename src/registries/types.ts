// registries/types.ts — the typed-registry contract. Shapes mirror the dev
// generator's interfaces so entries authored/tuned in this preview copy-paste
// straight into the real generator. winPresentation + gridEffects use the dev's
// EXACT interface; the rest are the proposed shapes from the export, confirmable.

export type GridTag = '5x5' | '5x3';
export type ModelTag = 'ways' | 'payline';

/** Base every registry entry extends. */
export interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  implemented: boolean; // false = inert (never renders) — the dev invariant
  compatibleGrids: GridTag[];
  compatibleModels: ModelTag[];
}

// ── Layer 1/2/3 — canvas layers (background · frame · backdrop) ──────────────
export interface CanvasLayerEntry extends RegistryEntry {
  layer: 'background' | 'reel-frame' | 'reel-backdrop';
  z: number; // 1..3
  params?: Record<string, number | string | boolean>;
}

// ── Layer 4 — per-cell symbol animations (the 4 states) ─────────────────────
export type SymbolState = 'idle' | 'landing' | 'win' | 'reset';
export interface SymbolAnimationEntry extends RegistryEntry {
  state: SymbolState;
  trigger: string; // 'symbol-land' | 'cell:winning' | 'scatterCount >= 2' | 'win-clear'
  scope: 'cell';
  anchor: 'cell:self' | 'cell:winning';
  duration: number; // seconds
  loop: boolean;
  easing?: string;
  baseScalePerKind?: Record<string, number>;
  popFactorPerKind?: Record<string, number>;
}

// ── Layer 5/6 — win presentation (EXACT interface) ──────────────────────────
export interface WinPresentationEntry extends RegistryEntry {
  trigger: string; // 'any win'
  duration: number; // seconds (per single presentation; the chain is cancellable)
  components: string[]; // ids resolved from other registries (gridEffects/sound/text)
}

// ── Layer 6/8 — grid effects (EXACT interface) ──────────────────────────────
export interface EffectStyle {
  colors?: number[]; // hex
  blend?: 'normal' | 'add';
  gradientStops?: { offset: number; color: number; alpha: number }[];
}
export interface GridEffectEntry extends RegistryEntry {
  trigger: string;
  scope: 'cell' | 'specific-cells' | 'reel' | 'full-grid';
  duration: number; // seconds
  intensity: 'subtle' | 'medium' | 'strong';
  loop?: boolean;
  cancellable?: boolean;
  style?: EffectStyle;
  params?: Record<string, number>;
}

// ── Layer 7 — win screens (tiered celebrations) ─────────────────────────────
export interface WinScreenTierEntry extends RegistryEntry {
  tier: 'big' | 'mega' | 'epic';
  thresholdX: number; // ×bet at/above which this screen plays
  duration: number; // seconds (mega/cancellable carve-out)
  params?: Record<string, number>;
}

// ── Layer 9 — transitions (FS intro/outro) ──────────────────────────────────
export interface TransitionAnimationEntry extends RegistryEntry {
  trigger: string; // 'scatterCount >= 3' | 'free spins start' | 'free spins end'
  duration: number;
  params?: Record<string, number>;
}

// ── Layer 10 — banner / counter text ────────────────────────────────────────
export interface TextAnimationEntry extends RegistryEntry {
  trigger: string;
  duration: number;
  params?: Record<string, number | string>;
}

// ── Layer 11 — sound cues (procedural Web-Audio) ────────────────────────────
export interface SoundEventEntry extends RegistryEntry {
  trigger: string;
  loop: boolean;
  volume: number;
  synth: {
    type: 'tone' | 'noise' | 'chime' | 'sweep' | 'thud' | 'riser' | 'siren';
    freq?: number;
    freqTo?: number;
    durationMs?: number;
    decay?: number;
  };
}

// ── Layer 12 — theme + symbol set ───────────────────────────────────────────
export interface ThemeSymbol {
  id: number; // SymbolId
  label: string;
  placeholderColor: number; // hex
  tex?: string; // asset filename for later swap (renders placeholder if absent)
}
export interface ThemeEntry extends RegistryEntry {
  themeId: string; // -> canvasTheme.ts
  symbols: ThemeSymbol[];
}

/** Union of everything for the generic store. */
export type AnyEntry =
  | CanvasLayerEntry
  | SymbolAnimationEntry
  | WinPresentationEntry
  | GridEffectEntry
  | WinScreenTierEntry
  | TransitionAnimationEntry
  | TextAnimationEntry
  | SoundEventEntry
  | ThemeEntry;

export type RegistryName =
  | 'canvasLayers'
  | 'symbolAnimations'
  | 'winPresentation'
  | 'gridEffects'
  | 'winScreenTiers'
  | 'transitionAnimations'
  | 'textAnimations'
  | 'soundEvents'
  | 'themes';
