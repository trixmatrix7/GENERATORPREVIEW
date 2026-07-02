import { RegistryEntry, createRegistry } from './types.js';

// Text animation registry — animations applied to text/numeric HUD overlays
// (win amount counters, multiplier badges, free-spin counters, banners).
//
// Most entries are placeholders for future module PRs. The engine currently
// implements only a subset (banner pop is covered by winPresentation); the
// rest mark architectural intent so new mechanics drop in cleanly.

export type TextAnimationTarget =
  | 'winAmount'        // the running win counter on the HUD
  | 'multiplier'       // multiplier badge (e.g. "5×" during free spins)
  | 'banner'           // big top-screen banners ("BIG WIN!", "FREE SPINS!")
  | 'fsCounter'        // free-spins-remaining counter
  | 'tooltip'          // small floating info text
  | 'symbolOverlay';   // text drawn on top of a symbol (e.g. multiplier value)

export interface TextAnimationEntry extends RegistryEntry {
  target: TextAnimationTarget;
  trigger: string;
  duration: number;          // seconds
  easing: string;            // GSAP-compatible easing
  repeat: number;            // 0 = no repeat, -1 = infinite
}

const entries: readonly TextAnimationEntry[] = [
  {
    id: 'win-counter-rollup',
    name: 'Win Counter Roll-Up',
    description: 'Numeric counter animates from 0 to final win amount with easing-out deceleration.',
    version: '0.1.0',
    implemented: false,
    target: 'winAmount',
    trigger: 'win > 0',
    duration: 1.2,
    easing: 'power2.out',
    repeat: 0,
  },
  {
    id: 'multiplier-bounce',
    name: 'Multiplier Bounce',
    description: 'Multiplier badge scales up with elastic overshoot when a new multiplier is awarded.',
    version: '0.1.0',
    implemented: false,
    target: 'multiplier',
    trigger: 'multiplier increased',
    duration: 0.6,
    easing: 'elastic.out(1.2, 0.4)',
    repeat: 0,
  },
  {
    id: 'banner-zoom-in',
    name: 'Banner Zoom-In',
    description: 'Banner text scales from 0.5× to 1.1× then settles to 1.0× on entry.',
    version: '1.0.0',
    implemented: true,
    target: 'banner',
    trigger: 'win banner show',
    duration: 0.45,
    easing: 'back.out(2)',
    repeat: 0,
  },
  {
    id: 'banner-shake',
    name: 'Banner Shake',
    description: 'Subtle left-right shake on mega-win banners for emphasis.',
    version: '0.1.0',
    implemented: false,
    target: 'banner',
    trigger: 'win >= 50× bet',
    duration: 0.3,
    easing: 'rough({ template: power2.out, strength: 2, points: 8 })',
    repeat: 2,
  },
  {
    id: 'fs-counter-pulse',
    name: 'Free-Spin Counter Pulse',
    description: 'FS counter pulses when a re-trigger awards more spins.',
    version: '0.1.0',
    implemented: false,
    target: 'fsCounter',
    trigger: 'free spin re-trigger',
    duration: 0.5,
    easing: 'sine.inOut',
    repeat: 1,
  },
  {
    id: 'symbol-multiplier-overlay',
    name: 'Symbol Multiplier Overlay',
    description: 'Multiplier value drawn over a symbol fades in and gently floats.',
    version: '0.1.0',
    implemented: false,
    target: 'symbolOverlay',
    trigger: 'symbol carries multiplier',
    duration: 0.8,
    easing: 'power1.out',
    repeat: 0,
  },
] as const;

export const textAnimationRegistry = createRegistry(entries, { compatibleGrids: ['5x3', '5x5'] });
