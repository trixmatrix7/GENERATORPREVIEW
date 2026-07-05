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

export type AdjustableParamType = 'enum' | 'number' | 'boolean';

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
    default: 'on',
    description: 'Toggle the ambient floating dust motes drifting over the reels. Phrases: "turn off the ambient dust", "turn on the floating motes".',
    keywords: ['ambient', 'dust', 'motes', 'atmosphere'],
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
];

export function getAdjustableParam(id: string): AdjustableParam | undefined {
  return ADJUSTABLE_PARAMS.find(p => p.id === id);
}
