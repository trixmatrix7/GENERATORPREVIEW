// canvasTheme.ts — color tokens for the Pixi canvas (Layer 1/2/3/12).
// GridEffectEntry has no color fields in the dev spec, so effects pull their
// palette from here (the "secondary recurring gap: no home for color" note in
// the export README — resolved via a theme ref).

export interface CanvasTheme {
  id: string;
  name: string;
  background: number; // stage background
  backgroundVignette: number;
  reelBackdrop: number; // dark frosted reel area
  reelBackdropAlpha: number;
  frame: number; // reel-frame chrome
  frameInner: number;
  cellGrid: number; // grid divider lines
  cellGridAlpha: number;

  // effect palette
  goldFrame: number;
  warmFlash: number;
  spotlightBackdrop: number;
  glow: number;

  // symbol placeholder text + tile
  symbolTile: number;
  symbolTileBorder: number;
  text: number;
  textDim: number;
}

export const DARK_THEME: CanvasTheme = {
  id: 'fantasy-dark',
  name: 'Fantasy — Dark',
  background: 0x0e0c16,
  backgroundVignette: 0x05040a,
  reelBackdrop: 0x110e1c,
  reelBackdropAlpha: 0.72,
  frame: 0x2a2440,
  frameInner: 0x4b3f7a,
  cellGrid: 0x2e2748,
  cellGridAlpha: 0.5,

  goldFrame: 0xffd633,
  warmFlash: 0xfff0cf,
  spotlightBackdrop: 0x06050a,
  glow: 0xffe168,

  symbolTile: 0x1b1730,
  symbolTileBorder: 0x3a3160,
  text: 0xffffff,
  textDim: 0xb9b2d6,
};

export const NEON_THEME: CanvasTheme = {
  ...DARK_THEME,
  id: 'fantasy-neon',
  name: 'Fantasy — Neon',
  background: 0x0a0f1a,
  reelBackdrop: 0x0b1322,
  frame: 0x123a4a,
  frameInner: 0x1fd0ff,
  cellGrid: 0x14506a,
  glow: 0x49e6ff,
  goldFrame: 0x49e6ff,
  symbolTile: 0x0e1c2c,
  symbolTileBorder: 0x1a4a66,
};

export const THEMES: Record<string, CanvasTheme> = {
  [DARK_THEME.id]: DARK_THEME,
  [NEON_THEME.id]: NEON_THEME,
};

export const DEFAULT_THEME_ID = DARK_THEME.id;
