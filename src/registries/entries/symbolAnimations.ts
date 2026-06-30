// Layer 4 — the 4 per-cell symbol animation STATES. These are the generator's
// generic Fantasy defaults (tune/replace via presets or the code panel).
import type { SymbolAnimationEntry } from '../types';
import { BASE_SCALE_PER_KIND, POP_FACTOR_PER_KIND } from '../../config/symbols';

const baseScale = BASE_SCALE_PER_KIND as Record<string, number>;
const popFactor = POP_FACTOR_PER_KIND as Record<string, number>;

export const symbolAnimations: SymbolAnimationEntry[] = [
  {
    id: 'symbol-idle-glow-pulse',
    name: 'Idle glow pulse',
    description:
      'Looping anticipation breathing while 2+ scatters are on board: scale base↔1.12, glow alpha 0.34↔0.85, each leg ~340ms. Cosmetic, cancellable.',
    version: '1.0.0',
    implemented: true,
    state: 'idle',
    trigger: 'scatterCount >= 2',
    scope: 'cell',
    anchor: 'cell:self',
    duration: 0.68,
    loop: true,
    easing: 'sine.inOut',
    baseScalePerKind: baseScale,
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'symbol-landing-squash',
    name: 'Landing impact (squash & stretch)',
    description:
      'Fire-and-forget impact on reel-stop: 3-step squash→stretch with a small y-dip that sells the slam. ~325ms.',
    version: '1.0.0',
    implemented: true,
    state: 'landing',
    trigger: 'symbol-land',
    scope: 'cell',
    anchor: 'cell:self',
    duration: 0.325,
    loop: false,
    easing: 'back.out',
    baseScalePerKind: baseScale,
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'symbol-win-juice',
    name: 'Win juice (dip → pop → glow/flash/ring/wobble → settle)',
    description:
      'Per-cell win highlight: anticipation dip to 0.88, pop overshoot to the per-kind factor (back.out) + warm flash + radial glow + expanding shockwave ring + rotation wobble + spotlight backdrop, settle to 1.08. Premiums pop harder.',
    version: '1.0.0',
    implemented: true,
    state: 'win',
    trigger: 'cell:winning',
    scope: 'cell',
    anchor: 'cell:winning',
    duration: 0.6,
    loop: false,
    easing: 'back.out',
    baseScalePerKind: baseScale,
    popFactorPerKind: popFactor,
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'symbol-win-reset',
    name: 'Win reset (ways — symbol stays, pops back to normal)',
    description:
      'WAYS behaviour: the winning symbol is NOT removed; after winHold it eases scale back to base, glow/backdrop/flash → 0 over ~170ms, rotation reset. Keeps win clear ≤1.5s per connection.',
    version: '1.0.0',
    implemented: true,
    state: 'reset',
    trigger: 'win-clear',
    scope: 'cell',
    anchor: 'cell:winning',
    duration: 0.17,
    loop: false,
    easing: 'power2.out',
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways'],
  },
];
