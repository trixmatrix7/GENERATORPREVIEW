// Theme configuration for the slot preview.
// Each theme defines icons, colors, labels, and a background gradient.

import type { LucideIcon } from 'lucide-react';
import {
  // Fantasy
  Sparkles, Crown, Sword, Shield, Flame, Gem, Scroll, Skull, WandSparkles,
  // Cyberpunk
  Zap, Bot, Cpu, Wifi, ScanLine, Binary, Orbit, Bug, CircuitBoard,
  // Classic Fruit
  Star, Bell, Cherry, Citrus, Apple, Diamond, Heart, Clover, IceCreamCone,
  // Pirate
  Anchor, Compass, Ship, Swords, Map, Flag, Waves,
  // Space
  Rocket, Moon, Sun, Satellite, Globe, Atom,
  // Ancient Egypt
  Eye, Feather, Cat, Triangle, Amphora, Pyramid,
} from 'lucide-react';

export interface SymbolTheme {
  icon: LucideIcon;
  label: string;
  color: string;
}

export interface SlotThemeConfig {
  id: string;
  symbols: Record<number, SymbolTheme>;
  bgGradient: string;
  gridBg: string;
  accent: string;
  winGlow: string;
}

const THEMES: Record<string, SlotThemeConfig> = {
  Fantasy: {
    id: 'fantasy',
    // Curated rarity ramp: gold wild · violet scatter · vivid ruby/amber highs ·
    // amethyst mids · muted teal/steel/slate lows (recede).
    symbols: {
      0: { icon: Sparkles,     label: 'Wild',      color: '#FFC93C' },
      1: { icon: WandSparkles, label: 'Scatter',   color: '#B98BFF' },
      2: { icon: Crown,        label: 'King',      color: '#E8455F' },
      3: { icon: Sword,        label: 'Blade',     color: '#F2913D' },
      4: { icon: Shield,       label: 'Shield',    color: '#9B6BE6' },
      5: { icon: Flame,        label: 'Flame',     color: '#7A5BD6' },
      6: { icon: Gem,          label: 'Gem',       color: '#4FA38C' },
      7: { icon: Scroll,       label: 'Scroll',    color: '#5577A6' },
      8: { icon: Skull,        label: 'Skull',     color: '#5A6275' },
    },
    bgGradient: 'linear-gradient(135deg, #1a0a2e 0%, #16213e 50%, #0f3460 100%)',
    gridBg: 'rgba(15, 10, 35, 0.6)',
    accent: '#C084FC',
    winGlow: '#FFD700',
  },

  Cyberpunk: {
    id: 'cyberpunk',
    symbols: {
      0: { icon: Zap,          label: 'Wild',      color: '#00E5FF' },
      1: { icon: CircuitBoard, label: 'Scatter',   color: '#FF3DD2' },
      2: { icon: Bot,          label: 'Android',   color: '#FF4D6D' },
      3: { icon: Cpu,          label: 'Chip',      color: '#FF8A3D' },
      4: { icon: Wifi,         label: 'Signal',    color: '#B14DFF' },
      5: { icon: ScanLine,     label: 'Scan',      color: '#6E6BFF' },
      6: { icon: Binary,       label: 'Binary',    color: '#3DB6C7' },
      7: { icon: Orbit,        label: 'Orbit',     color: '#4A78C7' },
      8: { icon: Bug,          label: 'Bug',       color: '#5A6280' },
    },
    bgGradient: 'linear-gradient(135deg, #0a0a0a 0%, #1a0025 50%, #000a1a 100%)',
    gridBg: 'rgba(10, 0, 20, 0.6)',
    accent: '#00FFFF',
    winGlow: '#FF00FF',
  },

  'Classic Fruit': {
    id: 'classic-fruit',
    symbols: {
      0: { icon: Star,         label: 'Wild',      color: '#FFD23F' },
      1: { icon: Bell,         label: 'Scatter',   color: '#FF7A3D' },
      2: { icon: Cherry,       label: 'Cherry',    color: '#E8435A' },
      3: { icon: Citrus,       label: 'Orange',    color: '#F59331' },
      4: { icon: Apple,        label: 'Apple',     color: '#C25BD1' },
      5: { icon: IceCreamCone, label: 'Treat',     color: '#EC6A9E' },
      6: { icon: Diamond,      label: 'Diamond',   color: '#46B98E' },
      7: { icon: Heart,        label: 'Heart',     color: '#5C84C2' },
      8: { icon: Clover,       label: 'Clover',    color: '#5E6A78' },
    },
    bgGradient: 'linear-gradient(135deg, #1a0a00 0%, #2d1000 50%, #1a0500 100%)',
    gridBg: 'rgba(20, 5, 0, 0.6)',
    accent: '#FACC15',
    winGlow: '#EF4444',
  },

  Pirate: {
    id: 'pirate',
    symbols: {
      0: { icon: Anchor,   label: 'Wild',      color: '#FFC93C' },
      1: { icon: Compass,  label: 'Scatter',   color: '#5BE8F0' },
      2: { icon: Skull,    label: 'Skull',      color: '#E8455A' },
      3: { icon: Gem,      label: 'Treasure',   color: '#F2A93D' },
      4: { icon: Ship,     label: 'Ship',       color: '#8E6BD6' },
      5: { icon: Swords,   label: 'Swords',     color: '#5C8BC7' },
      6: { icon: Map,      label: 'Map',        color: '#4FA37E' },
      7: { icon: Flag,     label: 'Flag',       color: '#4A78B0' },
      8: { icon: Waves,    label: 'Waves',      color: '#586878' },
    },
    bgGradient: 'linear-gradient(135deg, #0a1628 0%, #1a2744 50%, #0d2137 100%)',
    gridBg: 'rgba(10, 15, 30, 0.6)',
    accent: '#FFD700',
    winGlow: '#5BE8F0',
  },

  Space: {
    id: 'space',
    symbols: {
      0: { icon: Sparkles,  label: 'Wild',       color: '#E8ECFF' },
      1: { icon: Orbit,     label: 'Scatter',    color: '#A78BFA' },
      2: { icon: Rocket,    label: 'Rocket',     color: '#FF5D6C' },
      3: { icon: Star,      label: 'Star',       color: '#FBBF3D' },
      4: { icon: Moon,      label: 'Moon',       color: '#B4A7F5' },
      5: { icon: Sun,       label: 'Sun',        color: '#F59331' },
      6: { icon: Satellite, label: 'Satellite',  color: '#4FA39A' },
      7: { icon: Globe,     label: 'Earth',      color: '#5277C2' },
      8: { icon: Atom,      label: 'Atom',       color: '#5A6280' },
    },
    bgGradient: 'linear-gradient(135deg, #020617 0%, #0c0a1d 50%, #030712 100%)',
    gridBg: 'rgba(2, 6, 23, 0.6)',
    accent: '#A78BFA',
    winGlow: '#F0F0FF',
  },

  'Ancient Egypt': {
    id: 'ancient-egypt',
    symbols: {
      0: { icon: Eye,       label: 'Wild',      color: '#FFC93C' },
      1: { icon: Amphora,   label: 'Scatter',   color: '#22C9D6' },
      2: { icon: Crown,     label: 'Pharaoh',   color: '#E0455A' },
      3: { icon: Pyramid,   label: 'Pyramid',   color: '#F2A93D' },
      4: { icon: Feather,   label: 'Feather',   color: '#8E6BD6' },
      5: { icon: Scroll,    label: 'Scroll',    color: '#6E73D6' },
      6: { icon: Gem,       label: 'Scarab',    color: '#4FA38C' },
      7: { icon: Cat,       label: 'Bastet',    color: '#5577B0' },
      8: { icon: Triangle,  label: 'Ankh',      color: '#6B6258' },
    },
    bgGradient: 'linear-gradient(135deg, #1a1000 0%, #2d1a00 50%, #1a0e00 100%)',
    gridBg: 'rgba(20, 12, 0, 0.6)',
    accent: '#FFD700',
    winGlow: '#22D3EE',
  },
};

const DEFAULT_THEME: SlotThemeConfig = THEMES['Fantasy'];

export function getThemeConfig(themeName: string): SlotThemeConfig {
  if (THEMES[themeName]) return THEMES[themeName];

  // Fuzzy match: case-insensitive, partial
  const lower = themeName.toLowerCase();
  for (const [key, config] of Object.entries(THEMES)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
      return config;
    }
  }

  return DEFAULT_THEME;
}

export function getSymbolTheme(
  themeConfig: SlotThemeConfig,
  symbolId: number,
): SymbolTheme {
  return themeConfig.symbols[symbolId] ?? {
    icon: Diamond,
    label: `Sym ${symbolId}`,
    color: '#6B7280',
  };
}
