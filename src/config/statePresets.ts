// State-animation PRESETS — 10 differently-flavoured AAA parameter sets for
// the symbol states (landing / landBounce / win / idle / featured). Each
// preset only overrides FALLBACK_TIMINGS fields, i.e. exactly the knobs the
// dev's symbolAnimations registry declares chat-adjustable (durations,
// easings-by-value, scales) — so every preset is generator-replicable as a
// symbolAnimations entry set with any theme. The dev's config file itself
// stays byte-identical; AnimatedSymbol merges the active preset at play time.

import { FALLBACK_TIMINGS } from './symbolAnimations';

type Widen<X> = { -readonly [K in keyof X]: X[K] extends number ? number : X[K] };
type T = { [K in keyof typeof FALLBACK_TIMINGS]: Widen<(typeof FALLBACK_TIMINGS)[K]> };
export interface StatePreset {
  id: string;
  name: string;
  description: string;
  landing?: Partial<T['landing']>;
  landBounce?: Partial<T['landBounce']>;
  win?: Partial<T['win']>;
  idle?: Partial<T['idle']>;
  featured?: Partial<T['featured']>;
}

export const STATE_PRESETS: readonly StatePreset[] = [
  {
    id: 'dev-default', name: 'Dev Default',
    description: 'The generator baseline — untouched FALLBACK_TIMINGS.',
  },
  {
    id: 'heavy-slam', name: 'Heavy Slam',
    description: 'Symbols land like weights: deep squash, hard short bounce, brief stunned pause.',
    landing: { downDuration: 0.05, upDuration: 0.12, settleDuration: 0.2, scaleCompress: 0.66, scaleOvershoot: 1.24, rotationKick: 1 },
    landBounce: { squashDuration: 0.05, overshootDuration: 0.08, settleDuration: 0.22, scaleSquashY: 0.82, scaleStretchY: 1.1 },
    win: { scalePeak: 1.42, pulseUp: 0.22, pulseHold: 0.34, pulseDown: 0.26, pulsePause: 0.5 },
  },
  {
    id: 'crack-slam', name: 'Crack Slam',
    description: 'Crack Farm intensity — symbols SLAM in hard: fast heavy drop, deep wooden squash, sharp snap-back (pairs with the wood-clatter drop SFX).',
    landing: { downDuration: 0.035, upDuration: 0.10, settleDuration: 0.16, scaleCompress: 0.58, scaleOvershoot: 1.32, rotationKick: 2 },
    landBounce: { squashDuration: 0.04, overshootDuration: 0.07, settleDuration: 0.18, scaleSquashY: 0.76, scaleStretchY: 1.16 },
    win: { scalePeak: 1.46, pulseUp: 0.2, pulseHold: 0.3, pulseDown: 0.24, pulsePause: 0.45 },
  },
  {
    id: 'bubbly-pop', name: 'Bubbly Pop',
    description: 'Light, candy-like: quick springy lands, fast cheerful win pulses, lively breathe.',
    landing: { downDuration: 0.07, upDuration: 0.22, settleDuration: 0.1, scaleCompress: 0.84, scaleOvershoot: 1.3, rotationKick: 6 },
    landBounce: { overshootDuration: 0.14, scaleStretchY: 1.12 },
    win: { scalePeak: 1.3, pulseUp: 0.18, pulseHold: 0.14, pulseDown: 0.2, pulsePause: 0.22 },
    idle: { breatheDuration: 1.4, scalePeak: 1.07, floatAmplitude: 3 },
  },
  {
    id: 'silk-luxury', name: 'Silk Luxury',
    description: 'Slow, expensive motion: soft lands, long velvety win swells, barely-there idle.',
    landing: { downDuration: 0.1, upDuration: 0.3, settleDuration: 0.26, scaleCompress: 0.9, scaleOvershoot: 1.08, rotationKick: 0 },
    landBounce: { squashDuration: 0.1, overshootDuration: 0.16, settleDuration: 0.26, scaleSquashY: 0.95, scaleStretchY: 1.03 },
    win: { scalePeak: 1.24, pulseUp: 0.5, pulseHold: 0.4, pulseDown: 0.5, pulsePause: 0.6 },
    idle: { breatheDuration: 3.2, scalePeak: 1.03, floatAmplitude: 1 },
  },
  {
    id: 'electric-snap', name: 'Electric Snap',
    description: 'Twitchy neon energy: instant snaps, rapid strobing win pulses, fast shallow breathe.',
    landing: { downDuration: 0.04, upDuration: 0.09, settleDuration: 0.08, scaleCompress: 0.8, scaleOvershoot: 1.16, rotationKick: 8 },
    win: { scalePeak: 1.3, pulseUp: 0.12, pulseHold: 0.08, pulseDown: 0.12, pulsePause: 0.14 },
    idle: { breatheDuration: 1.0, scalePeak: 1.04, floatAmplitude: 1 },
    featured: { glowDuration: 0.22, scalePeak: 1.3, rotationSwing: 8 },
  },
  {
    id: 'jelly-wobble', name: 'Jelly Wobble',
    description: 'Everything is gelatine: exaggerated squash-stretch, wobbling wins, bouncy idle float.',
    landing: { downDuration: 0.09, upDuration: 0.26, settleDuration: 0.3, scaleCompress: 0.6, scaleOvershoot: 1.36, rotationKick: 10 },
    landBounce: { scaleSquashY: 0.8, scaleStretchY: 1.16, settleDuration: 0.3 },
    win: { scalePeak: 1.38, pulseUp: 0.26, pulseHold: 0.1, pulseDown: 0.34, pulsePause: 0.3 },
    idle: { breatheDuration: 1.8, scalePeak: 1.08, floatAmplitude: 4 },
  },
  {
    id: 'stealth-pro', name: 'Stealth Pro',
    description: 'Esports-clean minimalism: micro lands, tight controlled win pulse, no idle drift.',
    landing: { downDuration: 0.05, upDuration: 0.1, settleDuration: 0.08, scaleCompress: 0.92, scaleOvershoot: 1.06, rotationKick: 0 },
    landBounce: { scaleSquashY: 0.96, scaleStretchY: 1.02 },
    win: { scalePeak: 1.18, pulseUp: 0.2, pulseHold: 0.24, pulseDown: 0.22, pulsePause: 0.4 },
    idle: { breatheDuration: 2.6, scalePeak: 1.01, floatAmplitude: 0 },
  },
  {
    id: 'carnival-big', name: 'Carnival Big',
    description: 'Showmaster energy: theatrical lands with spin, huge slow win swell, waving idle.',
    landing: { downDuration: 0.08, upDuration: 0.3, settleDuration: 0.2, scaleCompress: 0.7, scaleOvershoot: 1.32, rotationKick: 14 },
    win: { scalePeak: 1.5, pulseUp: 0.4, pulseHold: 0.36, pulseDown: 0.4, pulsePause: 0.5 },
    idle: { breatheDuration: 2.2, scalePeak: 1.09, floatAmplitude: 5 },
    featured: { glowDuration: 0.5, scalePeak: 1.35, rotationSwing: 10 },
  },
  {
    id: 'heartbeat-tension', name: 'Heartbeat Tension',
    description: 'Thriller pacing: restrained lands, double-thump win pulses, slow deep idle breathing.',
    landing: { downDuration: 0.07, upDuration: 0.16, settleDuration: 0.18, scaleCompress: 0.82, scaleOvershoot: 1.14, rotationKick: 2 },
    win: { scalePeak: 1.32, pulseUp: 0.14, pulseHold: 0.1, pulseDown: 0.16, pulsePause: 0.65 },
    idle: { breatheDuration: 2.8, scalePeak: 1.06, floatAmplitude: 2 },
    featured: { glowDuration: 0.3, alphaMin: 0.3, scalePeak: 1.28 },
  },
  {
    id: 'arcade-retro', name: 'Arcade Retro',
    description: '8-bit soul: stepped-feeling fast lands, chunky quick win pumps, perky idle bop.',
    landing: { downDuration: 0.05, upDuration: 0.08, settleDuration: 0.06, scaleCompress: 0.76, scaleOvershoot: 1.2, rotationKick: 0 },
    landBounce: { squashDuration: 0.05, overshootDuration: 0.07, settleDuration: 0.1 },
    win: { scalePeak: 1.36, pulseUp: 0.1, pulseHold: 0.18, pulseDown: 0.1, pulsePause: 0.26 },
    idle: { breatheDuration: 1.2, scalePeak: 1.05, floatAmplitude: 3 },
  },
  {
    id: 'zero-motion', name: 'Zero Motion',
    description: 'Accessibility/perf baseline: near-static — minimal pulses only where meaning requires.',
    landing: { downDuration: 0.04, upDuration: 0.06, settleDuration: 0.05, scaleCompress: 0.97, scaleOvershoot: 1.02, rotationKick: 0 },
    landBounce: { scaleSquashY: 0.99, scaleStretchY: 1.0 },
    win: { scalePeak: 1.12, pulseUp: 0.24, pulseHold: 0.3, pulseDown: 0.24, pulsePause: 0.6 },
    idle: { breatheDuration: 4, scalePeak: 1.0, floatAmplitude: 0 },
  },
];

let active: StatePreset = STATE_PRESETS[0];

export function setActiveStatePreset(id: string): StatePreset {
  active = STATE_PRESETS.find(p => p.id === id) ?? STATE_PRESETS[0];
  return active;
}

export function getActiveStatePreset(): StatePreset {
  return active;
}

/** Merged timings for a state — FALLBACK_TIMINGS overlaid with the preset. */
export function presetTimings<K extends keyof T>(state: K): T[K] {
  const override = (active as unknown as Record<string, unknown>)[state] as Partial<T[K]> | undefined;
  return { ...FALLBACK_TIMINGS[state], ...(override ?? {}) };
}
