import { RegistryEntry, createRegistry } from './types.js';

export interface CanvasLayerEntry extends RegistryEntry {
  zIndex: number;
  container: string;
  blendMode: string;
}

const entries: readonly CanvasLayerEntry[] = [
  {
    id: 'background',
    name: 'Background Layer',
    description: 'Full-canvas background image or gradient behind the reel frame.',
    version: '1.0.0',
    implemented: true,
    zIndex: 0,
    container: 'backgroundContainer',
    blendMode: 'normal',
  },
  {
    id: 'reel-frame',
    name: 'Reel Frame',
    description: 'Decorative frame around the reel grid. Themed per game.',
    version: '1.0.0',
    implemented: true,
    zIndex: 10,
    container: 'frameContainer',
    blendMode: 'normal',
  },
  {
    id: 'reels',
    name: 'Reel Symbols',
    description: 'The main reel symbol grid — AnimatedSymbol instances rendered here.',
    version: '1.0.0',
    implemented: true,
    zIndex: 20,
    container: 'reelContainer',
    blendMode: 'normal',
  },
  {
    id: 'win-overlay',
    name: 'Win Overlay',
    description: 'Particle effects and glow overlays during win presentations.',
    version: '1.0.0',
    implemented: true,
    zIndex: 30,
    container: 'overlayContainer',
    blendMode: 'add',
  },
  {
    id: 'win-banner',
    name: 'Win Banner',
    description: 'Large text banner showing win amount ("BIG WIN!", "MEGA WIN!").',
    version: '1.0.0',
    implemented: true,
    zIndex: 40,
    container: 'bannerContainer',
    blendMode: 'normal',
  },
] as const;

export const canvasLayerRegistry = createRegistry(entries, { compatibleGrids: ['5x3', '5x5'] });
