// Adjustable-params schema — the machine-readable "chat-config whitelist".
//
// This is the contract the natural-language chat-config enforces: ONLY params
// declared here can be changed by a user prompt, and only within the declared
// options/ranges. It mirrors the "Adjustable parameters (chat-config
// whitelist)" section of each per-layer spec in docs/layer-specs/.
//
// The (future) NL parser maps a prompt → { paramId, value } using each param's
// `description`; PixiApp.applyVisualParam(paramId, value) applies it live.
// NOTE: on-chain math params (base/bonus split, free-spins, max-payout, RTP)
// are intentionally NOT here — those are generation-time/on-chain, never a live
// or chat-adjustable knob (see Refs/architecture_v2/math-and-config-constraints).

/** Win-line colour presets — the line has two shades (core + underlay/dots). */
export const WIN_LINE_PRESETS: Record<string, { line: number; frame: number; label: string }> = {
  gold:   { line: 0xFFC53D, frame: 0xFFF1B0, label: 'Gold' },
  blue:   { line: 0x3DA5FF, frame: 0xBFE3FF, label: 'Blue' },
  green:  { line: 0x3DDC84, frame: 0xC9F7DC, label: 'Green' },
  purple: { line: 0xB14DFF, frame: 0xE6C9FF, label: 'Purple' },
  red:    { line: 0xFF5D5D, frame: 0xFFC9C9, label: 'Red' },
  white:  { line: 0xCFD6E6, frame: 0xFFFFFF, label: 'White' },
};

/** Win-coin colour presets — the celebration coins burst in these shades
 *  (3 tints each: base, deep, highlight). Applied live via spawnCoinsFrom. */
export const WIN_COIN_PRESETS: Record<string, { colors: number[]; label: string }> = {
  gold:   { colors: [0xFFD23F, 0xFFC107, 0xFFE082], label: 'Gold' },
  silver: { colors: [0xE6EAF0, 0xC0C8D4, 0xFFFFFF], label: 'Silver' },
  rose:   { colors: [0xFF8FB1, 0xFF5D8F, 0xFFD2E0], label: 'Rose' },
  blue:   { colors: [0x5BB8FF, 0x2E8BE6, 0xC9E8FF], label: 'Blue' },
};

/** Single-colour accent presets — shared by the title + win-banner colour
 *  params (each maps to one hue). */
export const ACCENT_PRESETS: Record<string, { color: number; label: string }> = {
  gold:   { color: 0xFFD23F, label: 'Gold' },
  blue:   { color: 0x3DA5FF, label: 'Blue' },
  green:  { color: 0x3DDC84, label: 'Green' },
  purple: { color: 0xB14DFF, label: 'Purple' },
  red:    { color: 0xFF5D5D, label: 'Red' },
  silver: { color: 0xE6EAF0, label: 'Silver' },
  white:  { color: 0xFFFFFF, label: 'White' },
};

export type AdjustableParamType = 'enum' | 'number' | 'boolean' | 'color';

export interface AdjustableParam {
  /** Stable id — the key PixiApp.applyVisualParam switches on. */
  id: string;
  /** Human label (UI). */
  label: string;
  /** Which per-layer spec this belongs to (docs/layer-specs/<layer>.md). */
  layer: string;
  type: AdjustableParamType;
  /** enum: allowed option ids. */
  options?: string[];
  /** number: inclusive range + step. */
  min?: number;
  max?: number;
  step?: number;
  default: string | number | boolean;
  /** Plain-language description — used by the NL parser to map a prompt to
   *  this param (e.g. "make the win line blue" → winLineColor='blue'). */
  description: string;
  /** Words in a prompt that indicate this param. The deterministic parser
   *  requires at least one before it will match an option. */
  keywords?: string[];
}

/** The whitelist. Extend as more layers expose live setters. */
export const ADJUSTABLE_PARAMS: readonly AdjustableParam[] = [
  {
    id: 'winLineColor',
    label: 'Win-line colour',
    layer: 'win-presentation',
    type: 'enum',
    options: Object.keys(WIN_LINE_PRESETS),
    default: 'gold',
    description: 'Hue of the winning pay-line, node dots, and the 5-of-a-kind light sweep. Phrases: "make the win line blue / gold / purple / green / red / white".',
    keywords: ['line', 'win line', 'winline', 'payline', 'pay line'],
  },
  {
    id: 'winCoinColor',
    label: 'Win-coin colour',
    layer: 'win-screens',
    type: 'enum',
    options: Object.keys(WIN_COIN_PRESETS),
    default: 'gold',
    description: 'Colour of the celebration coins that burst from winning symbols. Phrases: "make the coins silver / gold / rose / blue".',
    keywords: ['coin', 'coins'],
  },
  {
    id: 'ambientMotes',
    label: 'Ambient motes',
    layer: 'canvas-layers',
    type: 'enum',
    options: ['on', 'off'],
    default: 'off',
    description: 'Toggle the ambient floating dust motes drifting over the reels. Phrases: "turn off the ambient dust", "turn on the floating motes".',
    keywords: ['ambient', 'dust', 'motes', 'atmosphere'],
  },
  {
    id: 'reelBgColor',
    label: 'Reel bg — colour',
    layer: 'canvas-layers',
    type: 'color',
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
  {
    id: 'cellBgColor',
    label: 'Cell backdrop — colour',
    layer: 'canvas-layers',
    type: 'color',
    default: '#101018',
    description: 'Fill colour of the per-cell backdrop pocket behind each symbol — pick any RGB colour. Stays in sync with the cell-backdrop hue/saturation/brightness sliders. Phrases: "make the cell pockets dark / blue / purple".',
    keywords: ['cell', 'backdrop', 'pocket', 'tile', 'colour', 'color', 'rgb'],
  },
  {
    id: 'cellBgHue',
    label: 'Cell backdrop — hue',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 360, step: 1,
    default: 240,
    description: 'Colour (hue) of the per-cell backdrop pockets.',
    keywords: ['cell', 'backdrop', 'pocket', 'hue', 'colour', 'color'],
  },
  {
    id: 'cellBgSaturation',
    label: 'Cell backdrop — saturation',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 20,
    description: 'How colourful the per-cell backdrop pockets are (0 = grey, 100 = vivid).',
    keywords: ['cell', 'backdrop', 'saturation', 'grey', 'vivid'],
  },
  {
    id: 'cellBgLightness',
    label: 'Cell backdrop — brightness',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 8,
    description: 'Brightness of the per-cell backdrop pockets (0 = near-black, 100 = white).',
    keywords: ['cell', 'backdrop', 'brightness', 'dark', 'light'],
  },
  {
    id: 'cellBgOpacity',
    label: 'Cell backdrop — opacity',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 45,
    description: 'How opaque the per-cell backdrop pockets are (0 = invisible, 100 = solid).',
    keywords: ['cell', 'backdrop', 'opacity', 'transparency', 'alpha'],
  },
  {
    id: 'cellBgRadius',
    label: 'Cell backdrop — corner radius',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 40, step: 1,
    default: 14,
    description: 'Corner rounding of the per-cell backdrop pockets in px (0 = square).',
    keywords: ['cell', 'backdrop', 'corner', 'radius', 'round', 'square'],
  },
  {
    id: 'cellBgInset',
    label: 'Cell backdrop — inset/gap',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 30, step: 1,
    default: 3,
    description: 'How far each pocket is inset from its cell edge in px = the gap between pockets.',
    keywords: ['cell', 'backdrop', 'inset', 'gap', 'padding', 'spacing'],
  },
  {
    id: 'cellBgBorderColor',
    label: 'Cell backdrop — border colour',
    layer: 'canvas-layers',
    type: 'color',
    default: '#ffffff',
    description: 'Outline colour of the per-cell backdrop pockets (only visible when border width > 0).',
    keywords: ['cell', 'backdrop', 'border', 'outline', 'stroke', 'colour', 'color'],
  },
  {
    id: 'cellBgBorderWidth',
    label: 'Cell backdrop — border width',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 8, step: 1,
    default: 0,
    description: 'Outline thickness of the per-cell backdrop pockets in px (0 = no border).',
    keywords: ['cell', 'backdrop', 'border', 'outline', 'stroke', 'width', 'thickness'],
  },
  {
    id: 'frameColor',
    label: 'Frame — colour',
    layer: 'canvas-layers',
    type: 'color',
    default: '#424242',
    description: 'Colour of the frame bezel around the reel window — universal neutral grey by default; pick any RGB colour. Stays in sync with the frame hue/saturation/brightness sliders. Phrases: "make the frame dark / gold / blue".',
    keywords: ['frame', 'bezel', 'border', 'cabinet', 'colour', 'color', 'rgb'],
  },
  {
    id: 'frameHue',
    label: 'Frame — hue',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 360, step: 1,
    default: 0,
    description: 'Colour (hue) of the frame bezel.',
    keywords: ['frame', 'bezel', 'hue', 'colour', 'color'],
  },
  {
    id: 'frameSaturation',
    label: 'Frame — saturation',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 0,
    description: 'How colourful the frame bezel is (0 = grey, 100 = vivid).',
    keywords: ['frame', 'bezel', 'saturation', 'grey', 'vivid'],
  },
  {
    id: 'frameLightness',
    label: 'Frame — brightness',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 26,
    description: 'Brightness of the frame bezel (0 = near-black, 100 = white).',
    keywords: ['frame', 'bezel', 'brightness', 'dark', 'light'],
  },
  {
    id: 'frameOpacity',
    label: 'Frame — opacity',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 100, step: 1,
    default: 100,
    description: 'How opaque the frame bezel is (0 = invisible, 100 = solid).',
    keywords: ['frame', 'bezel', 'opacity', 'transparency', 'alpha'],
  },
  {
    id: 'frameWidth',
    label: 'Frame — thickness',
    layer: 'canvas-layers',
    type: 'number',
    min: 0, max: 36, step: 1,
    default: 22,
    description: 'How far the frame band extends outward from the reel grid, in px (0 = no frame). Phrases: "thicker frame", "thinner frame".',
    keywords: ['frame', 'bezel', 'thickness', 'width', 'thick', 'thin', 'dick', 'dünn'],
  },
  {
    id: 'reelSpeed',
    label: 'Reel speed',
    layer: 'canvas-layers',
    type: 'enum',
    options: ['relaxed', 'normal', 'snappy'],
    default: 'normal',
    description: 'How fast the reels roll while spinning — animation only, does NOT change the odds. Phrases: "spin faster", "snappier reels", "slow / relaxed spin".',
    keywords: ['reel', 'reels', 'spin', 'speed', 'fast', 'slow'],
  },
  {
    id: 'backgroundMood',
    label: 'Background mood',
    layer: 'canvas-layers',
    type: 'enum',
    options: ['subtle', 'balanced', 'vivid'],
    default: 'balanced',
    description: 'Intensity of the ambient glow + spotlight behind the reels. Phrases: "more vivid background", "calmer / subtle background", "brighter glow".',
    keywords: ['background', 'glow', 'backdrop', 'mood'],
  },
  {
    id: 'titleColor',
    label: 'Title colour',
    layer: 'text-animations',
    type: 'enum',
    options: Object.keys(ACCENT_PRESETS),
    default: 'gold',
    description: 'Colour of the game title wordmark above the reels. Phrases: "make the title blue / silver / gold".',
    keywords: ['title', 'logo', 'header', 'name'],
  },
  {
    id: 'winBannerColor',
    label: 'Win-banner colour',
    layer: 'win-screens',
    type: 'enum',
    options: Object.keys(ACCENT_PRESETS),
    default: 'gold',
    description: 'Accent colour of the big-win / mega-win banner plaque + rays. Phrases: "make the big-win banner purple", "gold win banner".',
    keywords: ['banner', 'plaque', 'big win', 'big-win', 'mega'],
  },
  {
    id: 'waysLight',
    label: 'Ways-light comet',
    layer: 'win-presentation',
    type: 'enum',
    options: ['on', 'off'],
    default: 'on',
    description: 'Toggle the thin white light comet that shoots through each winning ways-connection. Phrases: "turn off the win light streak", "enable the ways comet".',
    keywords: ['ways light', 'light streak', 'comet', 'win light', 'beam'],
  },
  {
    id: 'waysLightColor',
    label: 'Ways-light colour',
    layer: 'win-presentation',
    type: 'enum',
    options: ['white', 'ice', 'gold', 'purple', 'green', 'pink'],
    default: 'white',
    description: 'Colour of the ways-light comet beam. Phrases: "make the win light ice blue / gold / purple / green / pink / white".',
    keywords: ['ways light', 'light streak', 'comet', 'beam', 'streak'],
  },
  {
    id: 'waysLightSpeed',
    label: 'Ways-light speed',
    layer: 'win-presentation',
    type: 'enum',
    options: ['slow', 'normal', 'fast'],
    default: 'normal',
    description: 'How fast the ways-light comet shoots through the connection — visual only. Phrases: "faster win light", "slower comet".',
    keywords: ['ways light', 'comet', 'speed', 'fast', 'slow'],
  },
  {
    id: 'waysLightWidth',
    label: 'Ways-light thickness',
    layer: 'win-presentation',
    type: 'enum',
    options: ['thin', 'medium', 'bold'],
    default: 'medium',
    description: 'Thickness of the ways-light comet line. Phrases: "thinner win light", "bolder comet beam".',
    keywords: ['ways light', 'comet', 'thickness', 'width', 'thin', 'bold'],
  },
  {
    id: 'symbolSize',
    label: 'Symbol size',
    layer: 'symbols',
    type: 'enum',
    options: ['normal', 'large', 'xl'],
    default: 'large',
    description: 'How big the symbol art (icon / glyph) is drawn inside each cell — the tile stays the same, only the art scales. normal = the dev default; large/xl fill the cell more. Phrases: "bigger symbols", "make symbols fill the cell", "smaller symbols".',
    keywords: ['symbol', 'symbols', 'size', 'bigger', 'larger', 'small', 'fill'],
  },
  {
    id: 'stickyWild',
    label: 'Sticky wild (shine)',
    layer: 'symbols',
    type: 'enum',
    options: ['on', 'off'],
    default: 'on',
    description: 'Toggle the AAA sticky-wild treatment (glow border + shine sweep, no lock) on wild symbols. Phrases: "turn off sticky wilds", "enable the wild shine".',
    keywords: ['sticky', 'sticky wild', 'wild shine', 'wild border'],
  },
  {
    id: 'stickyWildColor',
    label: 'Sticky-wild colour',
    layer: 'symbols',
    type: 'enum',
    options: ['gold', 'ice', 'emerald', 'violet', 'magenta', 'white'],
    default: 'gold',
    description: 'Border/shine colour of the sticky-wild treatment. Phrases: "make sticky wilds ice / emerald / violet / magenta / gold / white".',
    keywords: ['sticky', 'sticky wild', 'wild colour', 'wild border'],
  },
  {
    id: 'stickyWildSpeed',
    label: 'Sticky-wild motion',
    layer: 'symbols',
    type: 'enum',
    options: ['calm', 'normal', 'lively'],
    default: 'normal',
    description: 'How lively the sticky-wild shine + orbit animate. Phrases: "calmer sticky wilds", "livelier wild shine".',
    keywords: ['sticky', 'sticky wild', 'motion', 'speed', 'calm', 'lively'],
  },
  // ── Plant multiplier BADGE (Crack Farm) — the square field on the plant ──
  {
    id: 'multiBadgeBg', label: 'Multi badge — background', layer: 'symbols', type: 'color',
    default: '#14260d',
    description: 'Background/fill colour of the plant multiplier badge (the square field). Phrases: "make the multi field darker / green / black".',
    keywords: ['multi', 'multiplier', 'badge', 'field', 'background', 'colour', 'color'],
  },
  {
    id: 'multiBadgeBgAlpha', label: 'Multi badge — background opacity', layer: 'symbols', type: 'number',
    min: 0, max: 1, step: 0.05, default: 0.9,
    description: 'How opaque the multiplier badge background is (0 = see-through, 1 = solid).',
    keywords: ['multi', 'badge', 'opacity', 'alpha', 'transparent'],
  },
  {
    id: 'multiBadgeBorder', label: 'Multi badge — frame colour', layer: 'symbols', type: 'color',
    default: '#7ef23e',
    description: 'Frame/border colour of the plant multiplier badge. Phrases: "make the multi frame gold / white / green".',
    keywords: ['multi', 'badge', 'frame', 'border', 'colour', 'color'],
  },
  {
    id: 'multiBadgeBorderWidth', label: 'Multi badge — frame width', layer: 'symbols', type: 'number',
    min: 0, max: 10, step: 0.5, default: 3,
    description: 'Thickness of the multiplier badge frame in pixels (0 = no frame).',
    keywords: ['multi', 'badge', 'frame', 'border', 'width', 'thickness'],
  },
  {
    id: 'multiBadgeNumberColor', label: 'Multi badge — number colour', layer: 'symbols', type: 'color',
    default: '#cfff7a',
    description: 'Colour of the multiplier number (x8, x16 …) on the badge. Phrases: "make the multi number gold / white".',
    keywords: ['multi', 'badge', 'number', 'text', 'colour', 'color'],
  },
  {
    id: 'multiBadgeFont', label: 'Multi badge — font', layer: 'symbols', type: 'enum',
    options: ['Rubik', 'Poppins', 'Impact', 'Arial Black', 'Georgia'], default: 'Rubik',
    description: 'Font of the multiplier number on the badge.',
    keywords: ['multi', 'badge', 'font', 'typeface', 'number'],
  },
  {
    id: 'multiBadgeSize', label: 'Multi badge — size', layer: 'symbols', type: 'number',
    min: 0.3, max: 0.9, step: 0.02, default: 0.6,
    description: 'Size of the square multiplier badge as a fraction of the reel width. Phrases: "bigger / smaller multi field".',
    keywords: ['multi', 'badge', 'size', 'bigger', 'smaller', 'square'],
  },
  {
    id: 'multiBadgeCorner', label: 'Multi badge — corner radius', layer: 'symbols', type: 'number',
    min: 0, max: 40, step: 1, default: 12,
    description: 'Corner rounding of the square multiplier badge (0 = sharp square, high = pill).',
    keywords: ['multi', 'badge', 'corner', 'radius', 'round', 'square'],
  },
  // ── FRUIT STACKS gift ×N label (one config, all five draw sites) ──
  {
    id: 'fruitMultiFont', label: 'Gift-Multi — Schrift', layer: 'symbols', type: 'enum',
    options: ['Baloo 2', 'Luckiest Guy', 'Rubik', 'Poppins', 'Impact', 'Arial Black', 'Georgia'], default: 'Baloo 2',
    description: 'Font of the ×N value on the fruit gift symbols (grid, refill, flights). Baloo 2 = the intro-art balloon look.',
    keywords: ['fruit', 'gift', 'multi', 'font', 'schrift', 'typeface'],
  },
  {
    id: 'fruitMultiColor', label: 'Gift-Multi — Farbe', layer: 'symbols', type: 'color',
    default: '#ffd21e',
    description: 'Colour of the ×N value on the fruit gift symbols.',
    keywords: ['fruit', 'gift', 'multi', 'colour', 'color', 'farbe'],
  },
  {
    id: 'fruitMultiSize', label: 'Gift-Multi — Größe', layer: 'symbols', type: 'number',
    min: 18, max: 60, step: 1, default: 38,
    description: 'Size of the ×N value in pixels on the grid.',
    keywords: ['fruit', 'gift', 'multi', 'size', 'größe', 'bigger', 'smaller'],
  },
  {
    id: 'fruitMultiPos', label: 'Gift-Multi — Position', layer: 'symbols', type: 'enum',
    options: ['unten', 'mitte', 'oben', 'links', 'rechts', 'oben-links', 'oben-rechts', 'unten-links', 'unten-rechts'],
    default: 'unten',
    description: 'Where the ×N sits on the gift symbol (unten = reference: hangs at the bottom edge).',
    keywords: ['fruit', 'gift', 'multi', 'position', 'anchor', 'mittig', 'rechts', 'oben', 'unten'],
  },
  {
    id: 'fruitMultiAngle', label: 'Gift-Multi — Diagonale', layer: 'symbols', type: 'number',
    min: -45, max: 45, step: 1, default: 0,
    description: 'Diagonal tilt of the ×N value in degrees (0 = straight).',
    keywords: ['fruit', 'gift', 'multi', 'angle', 'diagonal', 'diagonale', 'tilt', 'rotation'],
  },
  // ── 1×1 WILD lock backing (Crack Farm) — the panel behind the pot ──
  {
    id: 'oneWildBackdrop', label: '1×1 wild — backdrop colour', layer: 'symbols', type: 'color',
    default: '#0b0d14',
    description: 'Backdrop/fill colour of the panel behind the single (1×1) wild pot when it locks. Phrases: "change the 1:1 wild backdrop / background colour".',
    keywords: ['wild', '1x1', 'one', 'pot', 'backdrop', 'background', 'panel', 'colour', 'color'],
  },
  {
    id: 'oneWildBackdropAlpha', label: '1×1 wild — backdrop opacity', layer: 'symbols', type: 'number',
    min: 0, max: 1, step: 0.05, default: 1,
    description: 'How opaque the 1×1 wild backdrop panel is (0 = see-through, 1 = solid).',
    keywords: ['wild', '1x1', 'backdrop', 'opacity', 'alpha', 'transparent'],
  },
  {
    id: 'oneWildFrame', label: '1×1 wild — frame colour', layer: 'symbols', type: 'color',
    default: '#7ef23e',
    description: 'Frame/border colour of the 1×1 wild lock panel. Only visible when the frame width is above 0. Phrases: "change the 1:1 wild frame colour".',
    keywords: ['wild', '1x1', 'one', 'pot', 'frame', 'border', 'colour', 'color'],
  },
  {
    id: 'oneWildFrameWidth', label: '1×1 wild — frame width', layer: 'symbols', type: 'number',
    min: 0, max: 12, step: 0.5, default: 0,
    description: 'Thickness of the 1×1 wild frame in pixels (0 = no frame). Raise it to add a coloured border around the wild pot.',
    keywords: ['wild', '1x1', 'frame', 'border', 'width', 'thickness'],
  },
  {
    id: 'fsPlaqueFont', label: 'FS-Plaque — Schrift', layer: 'win-screens', type: 'enum',
    options: ['Poppins', 'Rubik', 'Impact', 'Arial Black', 'Georgia'],
    default: 'Poppins',
    description: 'Font of the FREE SPINS + TOTAL WIN plaques beside the grid during free games.',
    keywords: ['free spins', 'plaque', 'font', 'schrift', 'total win'],
  },
  {
    id: 'fsPlaqueBg', label: 'FS-Plaque — Hintergrund', layer: 'win-screens', type: 'enum',
    options: ['black', 'purple', 'navy', 'wine', 'smoke'],
    default: 'black',
    description: 'Background fill of the FREE SPINS / TOTAL WIN plaques.',
    keywords: ['free spins', 'plaque', 'background', 'hintergrund'],
  },
  {
    id: 'fsPlaqueBorder', label: 'FS-Plaque — Rand', layer: 'win-screens', type: 'enum',
    options: ['pink', 'gold', 'cyan', 'green', 'white', 'purple'],
    default: 'pink',
    description: 'Neon border colour of the FS plaques (outer rim + inner glow line).',
    keywords: ['free spins', 'plaque', 'border', 'rand', 'rahmen'],
  },
  {
    id: 'fsPlaqueText', label: 'FS-Plaque — Zahlenfarbe', layer: 'win-screens', type: 'enum',
    options: ['gold', 'white', 'cyan', 'pink', 'green'],
    default: 'gold',
    description: 'Colour of the big numbers (spin count + total win) on the FS plaques.',
    keywords: ['free spins', 'plaque', 'text', 'zahl', 'farbe'],
  },
];

export function getAdjustableParam(id: string): AdjustableParam | undefined {
  return ADJUSTABLE_PARAMS.find(p => p.id === id);
}
