import { RegistryEntry, createRegistry } from './types.js';

// Win-screen tier registry — tiered celebration presets selected based on
// total win as a multiple of the bet. The base `winPresentation` registry
// covers the baseline presentation (dim/highlight, banner-pop). These tiers
// layer additional choreography on top for big wins.
//
// Selection logic: pick the highest tier whose `[minMultiplier, maxMultiplier]`
// band contains the win-multiplier ratio (totalWin / wager). Ranges are
// non-overlapping by construction; the validator checks this.

export interface WinScreenTierEntry extends RegistryEntry {
  /** Inclusive lower bound on win/bet ratio for this tier to fire. */
  minMultiplier: number;
  /** Exclusive upper bound. Use Infinity for top tier. */
  maxMultiplier: number;
  /** Components composed for this tier (text animations, grid effects, sounds). */
  components: string[];
  /** Total presentation duration in seconds. */
  duration: number;
}

const entries: readonly WinScreenTierEntry[] = [
  {
    id: 'small-win',
    name: 'Small Win',
    description: 'Wins under 2× bet. Quiet — just the standard dim/highlight pulse, no banner.',
    version: '1.0.0',
    implemented: true,
    minMultiplier: 0,
    maxMultiplier: 2,
    components: ['dim-highlight-pulse'],
    duration: 1.5,
  },
  {
    id: 'normal-win',
    name: 'Normal Win',
    description: 'Wins 2× – 10× bet. Adds the win-counter rollup and standard banner pop.',
    version: '1.0.0',
    implemented: true,
    minMultiplier: 2,
    maxMultiplier: 10,
    components: ['dim-highlight-pulse', 'banner-pop', 'banner-zoom-in'],
    duration: 2.0,
  },
  {
    id: 'big-win',
    name: 'Big Win',
    description: 'Wins 10× – 50× bet. Layers in win-counter roll-up and a stronger banner.',
    version: '1.0.0',
    implemented: true,
    minMultiplier: 10,
    maxMultiplier: 50,
    components: ['dim-highlight-pulse', 'banner-pop', 'win-counter-rollup'],
    duration: 3.0,
  },
  {
    id: 'mega-win',
    name: 'Mega Win',
    description: 'Wins 50× – 250× bet. Adds the screen-shake grid effect and banner shake.',
    version: '1.0.0',
    implemented: true,
    minMultiplier: 50,
    maxMultiplier: 250,
    components: ['banner-pop', 'banner-shake', 'win-counter-rollup', 'mega-win-screen-shake'],
    duration: 4.5,
  },
  {
    id: 'super-mega-win',
    name: 'Super Mega Win',
    description: 'Wins 250× – 1000× bet. Adds particle bursts and a longer counter rollup.',
    version: '0.1.0',
    implemented: false,
    minMultiplier: 250,
    maxMultiplier: 1000,
    components: ['banner-pop', 'banner-shake', 'win-counter-rollup', 'mega-win-screen-shake'],
    duration: 6.0,
  },
  {
    id: 'epic-win',
    name: 'Epic Win',
    description: 'Wins 1000× – maxWin. Full jackpot flash, ambient lighting shift, prolonged celebration.',
    version: '0.1.0',
    implemented: false,
    minMultiplier: 1000,
    maxMultiplier: Infinity,
    components: ['jackpot-full-flash', 'banner-shake', 'win-counter-rollup', 'mega-win-screen-shake'],
    duration: 8.0,
  },
] as const;

export const winScreenTierRegistry = createRegistry(entries, { compatibleGrids: ['5x3', '5x5'] });
