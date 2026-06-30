// Layer 12 — theme + symbol set. Symbols render as colored placeholders with a
// label (zero art needed); `tex` is the asset filename for a later art swap.
import type { ThemeEntry } from '../types';
import { SymbolId } from '../../config/symbols';

const fantasySymbols = [
  { id: SymbolId.WILD, label: 'WILD', placeholderColor: 0xffd633, tex: 'symbol_wild.png' },
  { id: SymbolId.SCATTER, label: 'SC', placeholderColor: 0xb06cff, tex: 'symbol_scatter.png' },
  { id: SymbolId.HIGH_A, label: 'DRG', placeholderColor: 0xff5a5a, tex: 'symbol_high_a.png' },
  { id: SymbolId.HIGH_B, label: 'MAG', placeholderColor: 0xff9f43, tex: 'symbol_high_b.png' },
  { id: SymbolId.MID_C, label: 'SWD', placeholderColor: 0x4fc3ff, tex: 'symbol_mid_c.png' },
  { id: SymbolId.MID_D, label: 'SHD', placeholderColor: 0x46d17a, tex: 'symbol_mid_d.png' },
  { id: SymbolId.LOW_E, label: 'A', placeholderColor: 0xc7c0e8, tex: 'symbol_low_e.png' },
  { id: SymbolId.LOW_F, label: 'K', placeholderColor: 0xafa8d6, tex: 'symbol_low_f.png' },
  { id: SymbolId.LOW_G, label: 'Q', placeholderColor: 0x9a93c4, tex: 'symbol_low_g.png' },
  { id: SymbolId.COIN, label: '$', placeholderColor: 0xffd24a, tex: 'symbol_coin.png' },
];

export const themes: ThemeEntry[] = [
  {
    id: 'theme-fantasy-dark',
    name: 'Fantasy — Dark',
    description: 'Default dark fantasy palette + 10-symbol placeholder set.',
    version: '1.0.0',
    implemented: true,
    themeId: 'fantasy-dark',
    symbols: fantasySymbols,
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
  {
    id: 'theme-fantasy-neon',
    name: 'Fantasy — Neon',
    description: 'Neon-cyan variant of the fantasy palette (same symbol set).',
    version: '1.0.0',
    implemented: true,
    themeId: 'fantasy-neon',
    symbols: fantasySymbols,
    compatibleGrids: ['5x5', '5x3'],
    compatibleModels: ['ways', 'payline'],
  },
];
