// Per-theme palette registry for the Pixi engine.
// Mirrors the wizard's HTML-side themeConfig.ts so the same theme name
// produces matching colours in both the wizard preview AND the live game.
//
// Engine consumers (PixiApp, AnimatedSymbol) read these via GameConfig.theme.
// CSS-string colours from themeConfig.ts are converted to hex numbers here
// (Pixi's Graphics + TextStyle take 0xRRGGBB integers).

import { SymbolId, type SymbolIdType } from './symbols';
import { DEFAULT_GAME_THEME } from '@/engine/GameConfig';
import type { GameTheme, ThemeIcon } from '@/engine/GameConfig';
// Phosphor icons (fill weight) read as proper game art — solid, weighty,
// modern. Lucide's thin outlines look "wireframe" at the size we need
// (~64-70px tile glyphs); fill variants of Phosphor are what real slot UIs
// trend toward when they don't have custom illustration.
import {
  // Fantasy
  Sparkle, MagicWand, Crown, Sword, Shield, Flame, Diamond as DiamondGem, Scroll, Skull,
  // Cyberpunk
  Lightning, Cpu, WifiHigh, Scan, Binary, Bug, CirclesThree, Robot, Planet,
  // Classic Fruit
  Star, Bell, Cherries, Orange, Carrot, IceCream, Diamond as Diamond2, Heart, Clover,
  // Pirate
  Anchor, Compass, Boat, MapTrifold, Flag, Waves,
  // Space
  Rocket, Moon, Sun, GlobeHemisphereWest, Atom,
  // Ancient Egypt
  Eye, Feather, Cat, Triangle, Egg,
} from '@phosphor-icons/react';

const T = (id: SymbolIdType, color: number, label: string, icon?: ThemeIcon) =>
  ({ id, color, label, icon });

// Symbol glyphs are curated to match real slot-game iconography per theme:
// the WILD is a high-value/showpiece glyph, the SCATTER is the round's signal,
// and the eight pay symbols progress hi → mid → low in dramatic weight.
// Pixi's text renderer falls through to the OS emoji font (Apple Color Emoji
// on Mac, Segoe UI Emoji on Windows/Linux) — these glyphs are chosen to look
// strong at large size in those fonts. When Higgsfield-generated atlases land
// in Phase 1a, AnimatedSymbol switches to atlas mode automatically and the
// glyphs become the fallback only.

// Lucide icons mirror the wizard's HTML themeConfig 1:1 — same visual
// vocabulary the user picked themes against. Pixi side rasterises these to
// textures at init (lucideIcon.ts → loadLucideTexture), and AnimatedSymbol
// renders them as Sprite over the coloured placeholder tile. The text glyph
// is kept as an emoji fallback for environments where SVG rasterisation
// isn't available (e.g. older browsers, atlas-only paths).

const FANTASY: GameTheme = build('FANTASY  SLOTS', 0xC084FC, 0xFFD700, 0xFFD700, [
  T(SymbolId.WILD,    0xFFD700, '⭐', Sparkle),
  T(SymbolId.SCATTER, 0xC084FC, '🔮', MagicWand),
  T(SymbolId.HIGH_A,  0xEF4444, '👑', Crown),
  T(SymbolId.HIGH_B,  0xF97316, '🗡️', Sword),
  T(SymbolId.MID_C,   0xA78BFA, '🛡️', Shield),
  T(SymbolId.MID_D,   0x7C3AED, '🔥', Flame),
  T(SymbolId.LOW_E,   0x34D399, '💎', DiamondGem),
  T(SymbolId.LOW_F,   0x60A5FA, '📜', Scroll),
  T(SymbolId.LOW_G,   0x6B7280, '💀', Skull),
]);

const CYBERPUNK: GameTheme = build('CYBER  SLOTS', 0x00FFFF, 0xFF00FF, 0x00FFFF, [
  T(SymbolId.WILD,    0x00FFFF, '⚡', Lightning),
  T(SymbolId.SCATTER, 0xFF00FF, '💠', CirclesThree),
  T(SymbolId.HIGH_A,  0xFF3366, '🤖', Robot),
  T(SymbolId.HIGH_B,  0xFF6B00, '💾', Cpu),
  T(SymbolId.MID_C,   0xA855F7, '📡', WifiHigh),
  T(SymbolId.MID_D,   0x6366F1, '📊', Scan),
  T(SymbolId.LOW_E,   0x22D3EE, '🔢', Binary),
  T(SymbolId.LOW_F,   0x3B82F6, '🛰️', Planet),
  T(SymbolId.LOW_G,   0x4B5563, '🪲', Bug),
]);

const CLASSIC_FRUIT: GameTheme = build('FRUIT  SLOTS', 0xFACC15, 0xEF4444, 0xFACC15, [
  T(SymbolId.WILD,    0xFACC15, '⭐', Star),
  T(SymbolId.SCATTER, 0xFB923C, '🔔', Bell),
  T(SymbolId.HIGH_A,  0xEF4444, '🍒', Cherries),
  T(SymbolId.HIGH_B,  0xF97316, '🍊', Orange),
  T(SymbolId.MID_C,   0xA855F7, '🥕', Carrot),
  T(SymbolId.MID_D,   0xEC4899, '🍦', IceCream),
  T(SymbolId.LOW_E,   0x10B981, '💎', Diamond2),
  T(SymbolId.LOW_F,   0xF43F5E, '❤️', Heart),
  T(SymbolId.LOW_G,   0x6B7280, '🍀', Clover),
]);

const PIRATE: GameTheme = build('PIRATE  SLOTS', 0xFFD700, 0x5BE8F0, 0xFFD700, [
  T(SymbolId.WILD,    0xFFD700, '⚓', Anchor),
  T(SymbolId.SCATTER, 0x5BE8F0, '🧭', Compass),
  T(SymbolId.HIGH_A,  0xEF4444, '💀', Skull),
  T(SymbolId.HIGH_B,  0xF59E0B, '💎', DiamondGem),
  T(SymbolId.MID_C,   0x8B5CF6, '🚢', Boat),
  T(SymbolId.MID_D,   0x6366F1, '⚔️', Sword),
  T(SymbolId.LOW_E,   0x22C55E, '🗺️', MapTrifold),
  T(SymbolId.LOW_F,   0x3B82F6, '🏴', Flag),
  T(SymbolId.LOW_G,   0x64748B, '🌊', Waves),
]);

const SPACE: GameTheme = build('SPACE  SLOTS', 0xA78BFA, 0xF0F0FF, 0xA78BFA, [
  T(SymbolId.WILD,    0xF0F0FF, '✨', Sparkle),
  T(SymbolId.SCATTER, 0xA78BFA, '🪐', Planet),
  T(SymbolId.HIGH_A,  0xEF4444, '🚀', Rocket),
  T(SymbolId.HIGH_B,  0xFBBF24, '⭐', Star),
  T(SymbolId.MID_C,   0xC4B5FD, '🌙', Moon),
  T(SymbolId.MID_D,   0xF59E0B, '☀️', Sun),
  T(SymbolId.LOW_E,   0x34D399, '🛰️', CirclesThree),
  T(SymbolId.LOW_F,   0x60A5FA, '🌍', GlobeHemisphereWest),
  T(SymbolId.LOW_G,   0x64748B, '⚛️', Atom),
]);

const ANCIENT_EGYPT: GameTheme = build('EGYPT  SLOTS', 0xFFD700, 0x22D3EE, 0xFFD700, [
  T(SymbolId.WILD,    0xFFD700, '👁️', Eye),
  T(SymbolId.SCATTER, 0x22D3EE, '🏺', Egg),
  T(SymbolId.HIGH_A,  0xEF4444, '👑', Crown),
  T(SymbolId.HIGH_B,  0xF59E0B, '🔺', Triangle),
  T(SymbolId.MID_C,   0xA78BFA, '🪶', Feather),
  T(SymbolId.MID_D,   0x818CF8, '📜', Scroll),
  T(SymbolId.LOW_E,   0x34D399, '💎', DiamondGem),
  T(SymbolId.LOW_F,   0x60A5FA, '🐈', Cat),
  T(SymbolId.LOW_G,   0x78716C, '🔱', Skull),
]);

export const THEMES: Record<string, GameTheme> = {
  Fantasy: FANTASY,
  Cyberpunk: CYBERPUNK,
  'Classic Fruit': CLASSIC_FRUIT,
  Pirate: PIRATE,
  Space: SPACE,
  'Ancient Egypt': ANCIENT_EGYPT,
};

/** Resolve theme by name. Falls back to DEFAULT_GAME_THEME (chain.wtf brand)
 *  when the name is unknown — keeps production game path safe. */
export function getThemeByName(name: string | undefined | null): GameTheme {
  if (!name) return DEFAULT_GAME_THEME;
  if (THEMES[name]) return THEMES[name];
  // Case-insensitive fallback
  const lower = name.toLowerCase();
  for (const [key, theme] of Object.entries(THEMES)) {
    if (key.toLowerCase() === lower) return theme;
  }
  return DEFAULT_GAME_THEME;
}

// ── Internal builders ─────────────────────────────────────────────────────

interface SymbolEntry { id: SymbolIdType; color: number; label: string; icon?: ThemeIcon }

function paletteFrom(entries: SymbolEntry[]) {
  const colors = {} as Record<SymbolIdType, number>;
  const labels = {} as Record<SymbolIdType, string>;
  const icons: Partial<Record<SymbolIdType, ThemeIcon>> = {};
  for (const e of entries) {
    colors[e.id] = e.color;
    labels[e.id] = e.label;
    if (e.icon) icons[e.id] = e.icon;
  }
  return { colors, labels, icons };
}

function build(title: string, accent: number, accent2: number, winBanner: number, entries: SymbolEntry[]): GameTheme {
  const { colors, labels, icons } = paletteFrom(entries);
  return {
    title,
    accent,
    accent2,
    winBanner,
    symbolColors: colors,
    symbolLabels: labels,
    iconComponents: Object.keys(icons).length > 0 ? icons : undefined,
  };
}
