// reelBackgroundParams.ts — the five adjustable-params for the reel-window tint,
// in the same shape as your existing whitelist entries. Spread these into your
// ADJUSTABLE_PARAMS array.
//
// IMPORTANT: this adds a NEW param type — 'color' — to your union:
//     type AdjustableParamType = 'enum' | 'number' | 'boolean' | 'color';
// The value of a 'color' param is a "#rrggbb" string. See README for the one
// <input type="color"> case your param renderer needs.

export const REEL_BACKGROUND_PARAMS = [
  {
    id: 'reelBgColor',
    label: 'Reel bg — colour',
    layer: 'canvas-layers',
    type: 'color',              // NEW type — hex string value
    default: '#0a0a0a',
    description: 'Colour of the tint over the reel window — pick any RGB colour. Stays in sync with the reel-bg hue/saturation/brightness sliders; pair with reel-bg opacity for transparency. Phrases: "make the reel background blue / purple / dark".',
    keywords: ['reel', 'background', 'backdrop', 'colour', 'color', 'tint', 'rgb', 'picker'],
  },
  {
    id: 'reelBgHue',
    label: 'Reel bg — hue',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 360, step: 1,
    default: 220,
    description: 'Colour (hue) of the tint over the reel window. Combine with reel-bg saturation / brightness / opacity. Phrases: "make the reel background blue / purple / green".',
    keywords: ['reel', 'background', 'backdrop', 'colour', 'color', 'hue', 'tint'],
  },
  {
    id: 'reelBgSaturation',
    label: 'Reel bg — saturation',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 0,
    description: 'How colourful the reel-window tint is (0 = grey, 100 = vivid).',
    keywords: ['reel', 'background', 'saturation', 'colour', 'color', 'vivid', 'grey', 'gray'],
  },
  {
    id: 'reelBgLightness',
    label: 'Reel bg — brightness',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 4,
    description: 'Brightness of the reel-window tint (0 = near-black, 100 = white).',
    keywords: ['reel', 'background', 'brightness', 'lightness', 'dark', 'light'],
  },
  {
    id: 'reelBgOpacity',
    label: 'Reel bg — opacity',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 62,
    description: 'How opaque the reel-window tint is (0 = the scene shows through, 100 = solid colour). This is the transparency of the reel background.',
    keywords: ['reel', 'background', 'opacity', 'transparency', 'transparent', 'alpha'],
  },
] as const;
