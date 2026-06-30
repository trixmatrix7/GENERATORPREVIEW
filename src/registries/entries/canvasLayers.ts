// Layer 1/2/3 — background · reel frame · reel backdrop.
import type { CanvasLayerEntry } from '../types';

export const canvasLayers: CanvasLayerEntry[] = [
  {
    id: 'bg-fantasy-gradient',
    name: 'Background — fantasy gradient + vignette',
    description: 'Procedural radial gradient stage background with a soft vignette. Art-swappable later.',
    version: '1.0.0',
    implemented: true,
    layer: 'background',
    z: 1,
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'reel-frame-procedural',
    name: 'Reel frame / chrome',
    description: 'Procedural rounded frame around the reel area (gold/violet), drawn from theme color tokens.',
    version: '1.0.0',
    implemented: true,
    layer: 'reel-frame',
    z: 2,
    params: { thickness: 8, radius: 18 },
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'reel-backdrop-frosted',
    name: 'Reel backdrop + cell grid',
    description: 'Dark frosted panel behind the reels plus faint cell divider lines.',
    version: '1.0.0',
    implemented: true,
    layer: 'reel-backdrop',
    z: 3,
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
];
