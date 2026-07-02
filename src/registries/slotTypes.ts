import { RegistryEntry, ConstraintSet, createRegistry } from './types.js';

export interface SlotTypeEntry extends RegistryEntry {
  gridRows: number;
  gridCols: number;
  waysCalc: 'ways' | 'paylines' | 'cluster';
  totalWays: number;
  constraints: ConstraintSet;
}

const entries: readonly SlotTypeEntry[] = [
  {
    id: 'ways-243',
    name: '243 Ways (5×3)',
    description: 'Standard 5-reel 3-row all-ways slot. Matches count on each reel from left; total ways = product of per-reel match counts.',
    version: '1.0.0',
    implemented: true,
    compatibleGrids: ['5x3'],
    gridRows: 3,
    gridCols: 5,
    waysCalc: 'ways',
    totalWays: 243,
    constraints: { min: 3, max: 5, dependencies: [] },
  },
  {
    id: 'ways-3125',
    name: '3125 Ways (5×5)',
    description: '5-reel 5-row all-ways slot with 3125 total ways. V2 high-volatility grid.',
    version: '1.0.0',
    implemented: true,
    compatibleGrids: ['5x5'],
    gridRows: 5,
    gridCols: 5,
    waysCalc: 'ways',
    totalWays: 3125,
    constraints: { min: 3, max: 5 },
  },
  {
    id: 'cluster-pay',
    name: 'Cluster Pay',
    description: 'Wins form by adjacent symbol clusters rather than reels.',
    version: '0.1.0',
    implemented: false,
    // Cluster pays is V3 — no V2 grid shape applies.
    compatibleGrids: [],
    gridRows: 7,
    gridCols: 7,
    waysCalc: 'cluster',
    totalWays: 0,
    constraints: { min: 5 },
  },
] as const;

export const slotTypeRegistry = createRegistry(entries);
