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
  {
    id: 'ways-light-comet',
    name: 'Ways-Light Comet',
    description:
      'A thin white light streak shoots THROUGH each winning ways-connection like a comet — the line grows toward the next symbol at the front while it dissolves at the back, so nothing stays behind. Between two reels every symbol connection (bipartite = ways) gets its own thin beam. Fires per combination during the sequential win reveal. Purely visual/additive — no logic/RTP change. Live-tunable via waysLight/waysLightColor/waysLightSpeed/waysLightWidth. Implemented in src/game/effects/WaysLightComet.ts, fired from ReelSet.revealCombo().',
    version: '1.0.0',
    implemented: true,
    trigger: 'any win (per connection)',
    duration: 1.0,
    components: [],
  },
] as const;

export const winPresentationRegistry = createRegistry(entries, { compatibleGrids: ['5x3', '5x5'] });
