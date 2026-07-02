import { RegistryEntry, createRegistry } from './types.js';

export interface UIConfigEntry extends RegistryEntry {
  layout: 'sidebar' | 'bottom-bar';
  components: string[];
  responsive: boolean;
}

const entries: readonly UIConfigEntry[] = [
  {
    id: 'sidebar-standard',
    name: 'Sidebar Layout',
    description: 'Control panel in a right sidebar alongside the PixiJS canvas. Spin button, bet controls, balance, and win display in the sidebar.',
    version: '1.0.0',
    implemented: true,
    layout: 'sidebar',
    components: [
      'balance-display',
      'bet-controls',
      'spin-button',
      'win-display',
      'free-spin-counter',
      'paytable-modal',
      'settings-menu',
    ],
    responsive: true,
  },
  {
    id: 'bottom-bar',
    name: 'Bottom Bar Layout',
    description: 'Controls in a horizontal bar below the canvas. Requires full layout rewrite — deferred to V2.',
    version: '0.1.0',
    implemented: false,
    layout: 'bottom-bar',
    components: [
      'balance-display',
      'bet-controls',
      'spin-button',
      'win-display',
      'bonus-buy-button',
      'auto-spin',
      'settings-hamburger',
    ],
    responsive: true,
  },
] as const;

export const uiConfigRegistry = createRegistry(entries, { compatibleGrids: ['5x3', '5x5'] });
