// Symbol definitions — IDs must match the Solidity contract exactly.
// Art assets are placeholders until the creative team delivers finals.

export const SYMBOL_COUNT = 10;

export const SymbolId = {
  WILD:    0,
  SCATTER: 1,
  HIGH_A:  2, // highest paying regular
  HIGH_B:  3,
  MID_C:   4,
  MID_D:   5,
  LOW_E:   6,
  LOW_F:   7,
  LOW_G:   8, // lowest paying regular
  COIN:    9, // money symbol — inert in the base game, triggers Hold & Win at 6+
} as const;

export type SymbolIdType = (typeof SymbolId)[keyof typeof SymbolId];

export interface SymbolDef {
  id: SymbolIdType;
  key: string;
  label: string;
  /** Placeholder hex color until art assets are provided */
  placeholderColor: number;
  isWild: boolean;
  isScatter: boolean;
  /** Money/coin symbol — counts toward the Hold & Win trigger (6+ on board),
   *  inert for line wins otherwise. */
  isMoney?: boolean;
}

export const SYMBOLS: Record<SymbolIdType, SymbolDef> = {
  [SymbolId.WILD]: {
    id: SymbolId.WILD,
    key: 'wild',
    label: 'W',
    placeholderColor: 0xF8D84C,
    isWild: true,
    isScatter: false,
  },
  [SymbolId.SCATTER]: {
    id: SymbolId.SCATTER,
    key: 'scatter',
    label: 'S',
    placeholderColor: 0x5BE8F0,
    isWild: false,
    isScatter: true,
  },
  [SymbolId.HIGH_A]: {
    id: SymbolId.HIGH_A,
    key: 'high_a',
    label: 'A',
    placeholderColor: 0xE8443A,
    isWild: false,
    isScatter: false,
  },
  [SymbolId.HIGH_B]: {
    id: SymbolId.HIGH_B,
    key: 'high_b',
    label: 'B',
    placeholderColor: 0xF08C38,
    isWild: false,
    isScatter: false,
  },
  [SymbolId.MID_C]: {
    id: SymbolId.MID_C,
    key: 'mid_c',
    label: 'C',
    placeholderColor: 0x8B7CF6,
    isWild: false,
    isScatter: false,
  },
  [SymbolId.MID_D]: {
    id: SymbolId.MID_D,
    key: 'mid_d',
    label: 'D',
    placeholderColor: 0x6252CC,
    isWild: false,
    isScatter: false,
  },
  [SymbolId.LOW_E]: {
    id: SymbolId.LOW_E,
    key: 'low_e',
    label: 'E',
    placeholderColor: 0x34D399,
    isWild: false,
    isScatter: false,
  },
  [SymbolId.LOW_F]: {
    id: SymbolId.LOW_F,
    key: 'low_f',
    label: 'F',
    placeholderColor: 0x4A9EF5,
    isWild: false,
    isScatter: false,
  },
  [SymbolId.LOW_G]: {
    id: SymbolId.LOW_G,
    key: 'low_g',
    label: 'G',
    placeholderColor: 0x4A5568,
    isWild: false,
    isScatter: false,
  },
  [SymbolId.COIN]: {
    id: SymbolId.COIN,
    key: 'coin',
    label: '$',
    placeholderColor: 0xFFC93C,
    isWild: false,
    isScatter: false,
    isMoney: true,
  },
};

// ── Fruit Stacks: 9th pay symbol (id 10) ────────────────────────────────────
// Registered OUTSIDE the SymbolIdType union: the FROZEN symbolAnimations.ts
// exhaustively enumerates that union, so extending it would break the frozen
// file's Record type. AnimatedSymbol reads SYMBOLS[10] at runtime (guarded
// entry below); SYMBOL_ANIMATIONS[10] is optional-chained → fallback path.
export const FRUIT_LOW_I = 10 as SymbolIdType;
(SYMBOLS as unknown as Record<number, SymbolDef>)[10] = {
  id: FRUIT_LOW_I,
  key: 'low_i',
  label: 'I',
  placeholderColor: 0x53C46B,
  isWild: false,
  isScatter: false,
};

export const SYMBOL_LIST = Object.values(SYMBOLS);
