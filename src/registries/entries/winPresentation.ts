// Layer 5/6 — win presentation (EXACT interface).
import type { WinPresentationEntry } from '../types';

export const winPresentation: WinPresentationEntry[] = [
  {
    id: 'sequential-ways-reveal',
    name: 'Sequential WAYS reveal',
    description:
      'Ways wins revealed ONE connection at a time (never all at once), order = symbol value ASCENDING so it builds toward the biggest win. Per connection: rising connect sound (pitch steps up), counter ticks up by that connection, then all cells of that group light up together, hold, reset. A cancellable CHAIN of ≤1.5s presentations.',
    version: '1.0.0',
    implemented: true,
    trigger: 'any win',
    duration: 0.91,
    mode: 'sequential',
    components: ['connection-cell-pop', 'win-connect-sound', 'win-counter-tick'],
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways'],
  },
  {
    id: 'all-at-once-reveal',
    name: 'All-at-once reveal',
    description:
      'Every winning connection lights up together in a single synchronized pop (no per-connection chain). Snappier; total counter set at once.',
    version: '1.0.0',
    implemented: true,
    trigger: 'any win',
    duration: 0.91,
    mode: 'all-at-once',
    components: ['connection-cell-pop', 'win-counter-tick'],
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'any-win-glow',
    name: 'Any-win cell glow (single connection)',
    description:
      'The atomic single-connection presentation used by the sequential chain (and usable standalone). Anticipation dip → pop → glow flare + shockwave ring + flash + wobble + backdrop → settle → hold → ease back to idle. Pop scales by symbol kind.',
    version: '1.0.0',
    implemented: true,
    trigger: 'any win',
    duration: 0.91,
    components: ['connection-cell-pop'],
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
];
