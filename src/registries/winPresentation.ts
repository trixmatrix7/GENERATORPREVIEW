import { RegistryEntry, createRegistry } from './types.js';

export interface WinPresentationEntry extends RegistryEntry {
  trigger: string;
  duration: number;
  components: string[];
}

const entries: readonly WinPresentationEntry[] = [
  {
    id: 'dim-highlight-pulse',
    name: 'Dim + Highlight Pulse',
    description: 'Non-winning symbols dim to 40% opacity. Winning symbols pulse gently in scale and brightness.',
    version: '1.0.0',
    implemented: true,
    trigger: 'any win',
    duration: 1.5,
    components: ['symbol-dim', 'symbol-win-pulse'],
  },
  {
    id: 'banner-pop',
    name: 'Win Banner Pop',
    description: 'Animated banner displaying win amount with scale-up entrance and fade-out exit.',
    version: '1.0.0',
    implemented: true,
    trigger: 'win > 2× bet',
    duration: 2.0,
    components: ['win-banner-text', 'win-banner-bg'],
  },
  {
    id: 'scatter-celebration',
    name: 'Scatter Celebration',
    description: 'Special celebration animation when 3+ scatters trigger free spins.',
    version: '1.0.0',
    implemented: true,
    trigger: 'scatterCount >= 3',
    duration: 3.0,
    components: ['scatter-highlight', 'free-spin-banner'],
  },
] as const;

export const winPresentationRegistry = createRegistry(entries, { compatibleGrids: ['5x3', '5x5'] });
