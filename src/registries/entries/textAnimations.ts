// Layer 10 — banner / counter text.
import type { TextAnimationEntry } from '../types';

export const textAnimations: TextAnimationEntry[] = [
  {
    id: 'win-counter-tick',
    name: 'Win counter tick-up',
    description: 'The win amount counts up by each connection contribution during the sequential reveal.',
    version: '1.0.0',
    implemented: true,
    trigger: 'per win connection',
    duration: 0.4,
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'fs-multiplier-badge',
    name: 'FS multiplier badge',
    description: 'HUD badge showing the active free-spins multiplier (×18 flat for Fantasy).',
    version: '1.0.0',
    implemented: true,
    trigger: 'free spins active',
    duration: 0.3,
    params: { anchor: 'hud' },
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'flash-banner',
    name: 'Flash banner',
    description: 'Short centred banner used for Near-Miss / event call-outs.',
    version: '1.0.0',
    implemented: true,
    trigger: 'event',
    duration: 0.9,
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
];
