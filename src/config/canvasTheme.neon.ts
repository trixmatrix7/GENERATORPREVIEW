// Demo reskin — a "neon arcade" variant of the canvas theme.
// Swap this in by editing src/config/canvasTheme.ts so CANVAS_THEME points
// at NEON_CANVAS_THEME instead of the default. No other code changes required.

import type { CanvasTheme } from './canvasTheme';

export const NEON_CANVAS_THEME: CanvasTheme = {
  title: 'NEON  REELS',
  accent: 0xE11D74,      // hot pink glow
  accent2: 0x00E5FF,     // cyan inner glow
  winBanner: 0xFACC15,   // amber
  tileOuterBorder: 0x0A021A,
  modes: {
    dark: {
      rendererBg: 0x12051E,
      frameFill: 0x1B0A2E,
      borderOuter: 0x3B1566,
      borderInner: 0x5A2490,
      sheenColor: 0xE11D74,
      sheenAlpha: 0.05,
      separatorColor: 0x3B1566,
      dotColor: 0xE11D74,
      ambientAlpha1: 0.10,
      ambientAlpha2: 0.08,
      titleColor: 0xFFF2FA,
    },
    light: {
      rendererBg: 0xFDF4FF,
      frameFill: 0xFFFFFF,
      borderOuter: 0xF0ABCC,
      borderInner: 0xE879B1,
      sheenColor: 0xE11D74,
      sheenAlpha: 0.08,
      separatorColor: 0xF0ABCC,
      dotColor: 0xE11D74,
      ambientAlpha1: 0.12,
      ambientAlpha2: 0.10,
      titleColor: 0x3B1566,
    },
  },
};
