// Layer 9 — transitions (FS intro/outro).
import type { TransitionAnimationEntry } from '../types';

export const transitionAnimations: TransitionAnimationEntry[] = [
  {
    id: 'fs-intro',
    name: 'Free Spins intro',
    description: 'Award banner ("N Free Spins") slides in with a flash + multiplier badge after the grid spins out.',
    version: '1.0.0',
    implemented: true,
    trigger: 'scatterCount >= 3',
    duration: 1.6,
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'fs-outro',
    name: 'Free Spins outro',
    description: 'Total-feature-win banner before returning to base game.',
    version: '1.0.0',
    implemented: true,
    trigger: 'free spins end',
    duration: 1.4,
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
];
