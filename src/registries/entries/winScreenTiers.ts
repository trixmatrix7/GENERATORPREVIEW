// Layer 7 — tiered win-screen celebrations.
import type { WinScreenTierEntry } from '../types';

export const winScreenTiers: WinScreenTierEntry[] = [
  {
    id: 'win-screen-big',
    name: 'Big Win',
    description: 'Banner + counter roll-up + coin burst for wins 10×–50× bet. Cancellable.',
    version: '1.0.0',
    implemented: true,
    tier: 'big',
    thresholdX: 10,
    duration: 2.4,
    params: { coins: 40, shake: 0.6 },
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'win-screen-mega',
    name: 'Mega Win',
    description: 'Escalating fanfare, heavier coin shower + screen shake for wins 50×+ bet. Mega/cancellable carve-out.',
    version: '1.0.0',
    implemented: true,
    tier: 'mega',
    thresholdX: 50,
    duration: 3.6,
    params: { coins: 120, shake: 1.0 },
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
];
