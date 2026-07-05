// Symbol-art sizing — a preview PRESET that scales how big the symbol OBJECT
// (icon / glyph / uploaded art) is drawn INSIDE its cell. The cell tile itself
// is unchanged; only the art on top grows or shrinks. Purely visual — never
// touches reel math or the board.
//
// `normal` (1.0) is the dev's current look. `large`/`xl` make every symbol read
// bigger in the cell (the default here is `large`, since the stock art sits a
// bit small). Applied live via PixiApp.applyVisualParam('symbolSize', key),
// which sets objectScale then re-draws every tile. Exportable to the dev as a
// preset if the bigger look is preferred.

export const symbolSizing = {
  /** Multiplier applied to icon/glyph target size when a tile is (re)drawn. */
  objectScale: 1.3,
};

export const SYMBOL_SIZE_PRESETS: Record<string, number> = {
  normal: 1.0,
  large: 1.3,
  xl: 1.6,
};
