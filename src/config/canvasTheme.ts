// Canvas theme — single source of truth for all colors/text used by the PixiJS scene.
// Reskins should copy this file, change the values, and swap imports in PixiApp/ReelSet/Reel.
// Grid dimensions live in reels.ts; paytable in paytable.ts; symbol art in symbols.ts.

export interface CanvasThemeMode {
  /** Renderer clear color (full canvas background). */
  rendererBg: number;
  /** Reel machine frame fill. */
  frameFill: number;
  /** Outer frame border. */
  borderOuter: number;
  /** Inner frame border (sits inside outer). */
  borderInner: number;
  /** Highlight sheen color on top of frame. */
  sheenColor: number;
  sheenAlpha: number;
  /** Column separator + row indicator dot color. */
  separatorColor: number;
  dotColor: number;
  /** Ambient glow alphas behind machine. */
  ambientAlpha1: number;
  ambientAlpha2: number;
  /** Game title text color. */
  titleColor: number;
}

export interface CanvasTheme {
  /** Title text shown above the reels. */
  title: string;
  /** Primary brand accent (ambient glow, title drop shadow). */
  accent: number;
  /** Secondary accent (inner ambient glow). */
  accent2: number;
  /** Win banner background color. */
  winBanner: number;
  /** Tile outer border drawn on every symbol. */
  tileOuterBorder: number;
  /** Dark / light mode palettes. */
  modes: {
    dark: CanvasThemeMode;
    light: CanvasThemeMode;
  };
}

/** Default theme — chain.wtf branded blue. */
export const CANVAS_THEME: CanvasTheme = {
  title: 'CHAIN  SLOTS',
  accent: 0x0231C5,
  accent2: 0x0843E8,
  winBanner: 0x34D399,
  tileOuterBorder: 0x07090E,
  modes: {
    dark: {
      rendererBg: 0x0D1117,
      frameFill: 0x111822,
      borderOuter: 0x1E2630,
      borderInner: 0x2A3440,
      sheenColor: 0xffffff,
      sheenAlpha: 0.025,
      separatorColor: 0x1E2630,
      dotColor: 0x2A3440,
      ambientAlpha1: 0.04,
      ambientAlpha2: 0.03,
      titleColor: 0xffffff,
    },
    light: {
      rendererBg: 0xF0F2F5,
      frameFill: 0xFFFFFF,
      borderOuter: 0xD8DCE3,
      borderInner: 0xC4CBD6,
      sheenColor: 0x000000,
      sheenAlpha: 0.04,
      separatorColor: 0xD8DCE3,
      dotColor: 0xB0BAC8,
      ambientAlpha1: 0.07,
      ambientAlpha2: 0.05,
      titleColor: 0x0D1117,
    },
  },
};
