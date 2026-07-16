// frameParams.ts — the six adjustable-params for the flat band frame, in the
// same shape as your whitelist entries. Spread into ADJUSTABLE_PARAMS.
// Uses the 'color' type (same one <input type="color"> renderer case as the
// reel-background / cell-backdrop handoffs — add it once, reuse everywhere).

export const FRAME_PARAMS = [
  {
    id: 'frameColor',
    label: 'Frame — colour',
    layer: 'canvas-layers',
    type: 'color',
    default: '#424242',
    description: 'Colour of the frame band around the reel window — universal neutral grey by default; pick any RGB colour. Stays in sync with the frame hue/saturation/brightness sliders. Phrases: "make the frame dark / gold / blue".',
    keywords: ['frame', 'bezel', 'border', 'cabinet', 'colour', 'color', 'rgb'],
  },
  {
    id: 'frameHue',
    label: 'Frame — hue',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 360, step: 1,
    default: 0,
    description: 'Colour (hue) of the frame band.',
    keywords: ['frame', 'bezel', 'hue', 'colour', 'color'],
  },
  {
    id: 'frameSaturation',
    label: 'Frame — saturation',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 0,
    description: 'How colourful the frame band is (0 = grey, 100 = vivid).',
    keywords: ['frame', 'bezel', 'saturation', 'grey', 'vivid'],
  },
  {
    id: 'frameLightness',
    label: 'Frame — brightness',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 26,
    description: 'Brightness of the frame band (0 = near-black, 100 = white).',
    keywords: ['frame', 'bezel', 'brightness', 'dark', 'light'],
  },
  {
    id: 'frameOpacity',
    label: 'Frame — opacity',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 100,
    description: 'How opaque the frame band is (0 = invisible, 100 = solid).',
    keywords: ['frame', 'bezel', 'opacity', 'transparency', 'alpha'],
  },
  {
    id: 'frameWidth',
    label: 'Frame — thickness',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 36, step: 1,
    default: 22,
    description: 'How far the frame band extends outward from the reel grid, in px (0 = no frame). Phrases: "thicker frame", "thinner frame".',
    keywords: ['frame', 'bezel', 'thickness', 'width', 'thick', 'thin'],
  },
] as const;
