import { RegistryEntry, ConstraintSet, createRegistry } from './types.js';

export interface BonusMechanicEntry extends RegistryEntry {
  triggerCondition: string;
  params: Record<string, ConstraintSet>;
  contractImpact: 'none' | 'parameter-change' | 'new-function';
}

const entries: readonly BonusMechanicEntry[] = [
  {
    id: 'free-spins-multiplier',
    name: 'Free Spins with Multiplier',
    description: 'Scatter trigger awards N free spins where all wins are multiplied by M×. Re-triggers possible. Capped at C total spins.',
    version: '1.0.0',
    implemented: true,
    triggerCondition: 'scatterCount >= 3',
    params: {
      freeSpinsCount: { min: 5, max: 30 },
      freeSpinMultiplier: { min: 2, max: 10 },
      freeSpinsCap: { min: 20, max: 100 },
    },
    contractImpact: 'parameter-change',
  },
  {
    id: 'bonus-buy',
    name: 'Bonus Buy',
    description: 'Player pays a premium (e.g. 100× bet) to immediately trigger the free-spins round. Studio preview wired; the on-chain buy function is the remaining contract-gen work.',
    version: '0.2.0',
    implemented: true,
    triggerCondition: 'player action (gameData flag)',
    params: {
      buyCostMultiplier: { min: 50, max: 500 },
    },
    contractImpact: 'new-function',
  },
  {
    id: 'hold-and-win',
    name: 'Hold and Win',
    description: 'Triggered symbols lock in place, 3 re-spins to collect more. Grand/Major/Minor/Mini jackpot tiers. Studio preview simulates the round; validated math + on-chain function are the remaining work.',
    version: '0.2.0',
    implemented: true,
    triggerCondition: '6+ money symbols',
    params: {
      respinCount: { min: 3, max: 5 },
    },
    contractImpact: 'new-function',
  },
] as const;

export const bonusMechanicRegistry = createRegistry(entries, { compatibleGrids: ['5x3', '5x5'] });
