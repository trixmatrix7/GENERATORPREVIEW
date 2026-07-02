// Per-symbol animation state configuration.
//
// Contract: each symbol can optionally declare any of four animation states —
//   'idle'      — subtle loop while the symbol sits visible on the grid
//   'landing'   — one-shot when the reel stops on that symbol
//   'win'       — plays on symbols that are part of a winning combination
//   'featured'  — anticipation state (e.g. a scatter glowing during a near-miss)
// Any state not declared falls through to 'static' (no active animation).
//
// Atlas convention:
//   /assets/symbols/<atlas>.json + /assets/symbols/<atlas>.png
//   The JSON must include animation clips named after the SymbolState values.
//   If the atlas file is absent (current state during handover), the symbol
//   renders as a static placeholder tile and the animation states play as
//   programmatic tweens on that tile. Drop an atlas in later and it takes
//   precedence automatically — no code changes.

import { SymbolId, type SymbolIdType } from './symbols';

/** One of five possible states for a rendered symbol cell. */
export type SymbolState = 'idle' | 'landing' | 'win' | 'featured' | 'static';

export interface SymbolAnimationConfig {
  /** Atlas filename (without extension) in /assets/symbols/. Null = no atlas. */
  atlas: string | null;
  /** Which states this symbol should react to. Others fall to 'static'. */
  states: readonly SymbolState[];
}

const REGULAR_STATES: readonly SymbolState[] = ['idle', 'landing', 'win'];
const SPECIAL_STATES: readonly SymbolState[] = ['idle', 'landing', 'win', 'featured'];

export const SYMBOL_ANIMATIONS: Record<SymbolIdType, SymbolAnimationConfig> = {
  [SymbolId.WILD]:    { atlas: 'symbol_wild',    states: SPECIAL_STATES },
  [SymbolId.SCATTER]: { atlas: 'symbol_scatter', states: SPECIAL_STATES },
  [SymbolId.HIGH_A]:  { atlas: 'symbol_high_a',  states: REGULAR_STATES },
  [SymbolId.HIGH_B]:  { atlas: 'symbol_high_b',  states: REGULAR_STATES },
  [SymbolId.MID_C]:   { atlas: 'symbol_mid_c',   states: REGULAR_STATES },
  [SymbolId.MID_D]:   { atlas: 'symbol_mid_d',   states: REGULAR_STATES },
  [SymbolId.LOW_E]:   { atlas: 'symbol_low_e',   states: REGULAR_STATES },
  [SymbolId.LOW_F]:   { atlas: 'symbol_low_f',   states: REGULAR_STATES },
  [SymbolId.LOW_G]:   { atlas: 'symbol_low_g',   states: REGULAR_STATES },
  [SymbolId.COIN]:    { atlas: 'symbol_coin',    states: SPECIAL_STATES }, // money symbol — lively idle/win
};

/** Tunings for the programmatic fallback tweens (used when no atlas is loaded). */
export const FALLBACK_TIMINGS = {
  landing: {
    downDuration: 0.06,   // compress — snappy slam
    upDuration: 0.18,     // overshoot — pronounced hang for impact
    settleDuration: 0.14, // settle — gentle ease-out
    scaleCompress: 0.78,  // deeper squash for heavier feel
    scaleOvershoot: 1.18, // taller stretch for bounce
    rotationKick: 3,      // degrees of rotation wobble on landing
  },
  /** Subtle settle played on EVERY symbol when its reel stops (not just
   *  WILD/SCATTER, which get the richer `landing`). No rotation and no idle
   *  follow-up, so the whole grid can react each spin without feeling busy —
   *  this is what gives every stop a tactile "thunk". */
  landBounce: {
    squashDuration: 0.07,    // compress on impact
    overshootDuration: 0.10, // stretch back past rest
    settleDuration: 0.16,    // ease to rest
    scaleSquashY: 0.90,      // vertical squash (x stretches inversely)
    scaleStretchY: 1.06,     // overshoot stretch
  },
  win: {
    // Fruit-Fortune style: winning symbols repeatedly scale UP (clearly bigger),
    // hold, then return to normal — a clean enlarge pulse, in sync with the
    // connecting line. No rotation, no dimming of the rest of the board.
    scalePeak: 1.34,  // how much bigger at the top of the pulse
    pulseUp: 0.30,    // grow to full size
    pulseHold: 0.30,  // hold big
    pulseDown: 0.32,  // shrink back to normal
    pulsePause: 0.45, // rest at normal size between pulses
  },
  idle: {
    breatheDuration: 2.0, // one full breathe cycle
    scalePeak: 1.05,      // slightly larger for visibility
    floatAmplitude: 2,    // pixels of vertical float
  },
  featured: {
    glowDuration: 0.4,    // faster pulse — urgency
    alphaMin: 0.4,        // deeper dim for contrast
    scalePeak: 1.25,      // big pop — impossible to miss
    rotationSwing: 5,     // degrees of wobble per glow
  },
  /** Near-miss: how much longer the targeted reel decelerates. */
  nearMiss: {
    extraDuration: 1.1,   // seconds added to stopOn duration (longer suspense)
    teasePause: 0.35,     // extra stagger before the reel begins to stop
  },
} as const;
