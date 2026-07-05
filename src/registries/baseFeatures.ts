import { RegistryEntry, FileBinding, createRegistry } from './types.js';

export interface BaseFeatureEntry extends RegistryEntry {
  category: 'symbol' | 'mechanic';
  /** False for purely cosmetic features that must not influence reel-strip math. */
  affectsMath: boolean;
  bindings: FileBinding[];
  conflicts: string[];
}

const entries: readonly BaseFeatureEntry[] = [
  {
    id: 'wild-standard',
    name: 'Standard Wild',
    description: 'Wild symbol substitutes for any non-Scatter symbol in ways evaluation.',
    version: '1.0.0',
    implemented: true,
    affectsMath: true,
    category: 'symbol',
    bindings: [
      { file: 'src/config/symbols.ts', field: 'SymbolId.WILD' },
      { file: 'src/engine/WinEvaluator.ts', field: 'isWild check' },
    ],
    conflicts: [],
  },
  {
    id: 'scatter-trigger',
    name: 'Scatter Trigger',
    description: '3+ Scatter symbols anywhere on the board trigger free spins. Scatter pays are independent of position.',
    version: '1.0.0',
    implemented: true,
    affectsMath: true,
    category: 'symbol',
    bindings: [
      { file: 'src/config/symbols.ts', field: 'SymbolId.SCATTER' },
      { file: 'src/config/paytable.ts', field: 'SCATTER_PAY' },
      { file: 'src/engine/WinEvaluator.ts', field: 'scatterCount' },
    ],
    conflicts: [],
  },
  {
    id: 'near-miss-tease',
    name: 'Near-Miss Tease',
    description: 'Visual tease animation when 2 scatters land and a 3rd is close. Purely cosmetic — no RTP impact.',
    version: '1.0.0',
    implemented: true,
    affectsMath: false,
    category: 'mechanic',
    bindings: [
      { file: 'src/game/ReelSet.ts', field: 'triggerNearMiss()' },
    ],
    conflicts: [],
  },
  {
    id: 'sticky-wild',
    name: 'Sticky Wild',
    description: 'Wilds remain in place for subsequent spins (typically during free spins).',
    version: '0.1.0',
    implemented: false,
    affectsMath: true,
    category: 'symbol',
    bindings: [],
    conflicts: ['wild-standard'],
  },
  {
    id: 'sticky-wild-shine',
    name: 'Sticky Wild (Shine, AAA)',
    description:
      'AAA sticky-wild treatment: NO lock icon — a premium animated glow border + orbiting sheen node + diagonal shine sweep + subtle breath on every wild cell, so wilds read as special/locked-in. Visual-only preview treatment (the persist-across-free-spins mechanic is engine/contract work, so affectsMath stays false here). Implemented in src/game/effects/StickyWildShine.ts, applied from ReelSet.applyStickyWilds(). Live-tunable via stickyWild/stickyWildColor/stickyWildSpeed.',
    version: '1.0.0',
    implemented: true,
    affectsMath: false,
    category: 'symbol',
    bindings: [{ file: 'src/game/effects/StickyWildShine.ts', field: 'applyStickyWild' }],
    conflicts: [],
  },
] as const;

export const baseFeatureRegistry = createRegistry(entries, { compatibleGrids: ['5x3', '5x5'] });
