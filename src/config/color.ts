// Small colour helpers shared by the reel-bg tint (PixiApp) and its studio
// controls (a colour picker + H/S/L sliders that stay in sync). Kept dependency-
// free so the generator can drop it in alongside the reelBg* params.

/** HSL (h 0–360, s/l 0–100) → 0xRRGGBB. */
export function hslToNum(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
}

/** 0xRRGGBB → { h 0–360, s/l 0–100 } (rounded to whole slider steps). */
export function numToHsl(n: number): { h: number; s: number; l: number } {
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** "#rrggbb" → 0xRRGGBB (0 on malformed input). */
export function hexToNum(hex: string): number {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return Number.isNaN(n) ? 0 : n;
}

/** 0xRRGGBB → "#rrggbb". */
export function numToHex(n: number): string {
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

/** HSL → "#rrggbb" (for a colour <input> value). */
export function hslToHex(h: number, s: number, l: number): string {
  return numToHex(hslToNum(h, s, l));
}
