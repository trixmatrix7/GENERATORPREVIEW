// chainwtf-game-preset v2 — the STANDARDIZED export format agreed with the
// partner dev (chainwtf-game-preset.schema.json). Design rule from the
// schema: anything that affects the payout lives ONCE in the math manifest
// (inline here); mechanics only POINT at it via mathBinding; assets carry
// full sheet geometry + the sizing package so the partner runtime can
// reproduce layout + playback 1:1.
//
// This module is deliberately IMPORT-FREE (pure data + functions) so a Node
// harness can run it against the real math JSONs and validate the output
// against the schema. The browser wrapper in buildPresets.ts gathers the
// live inputs (active game, profile manifest, asset overrides, sound picks)
// and drift-asserts the constants below against the real runtime values.

export type GameKey = 'vice' | 'crackfarm' | 'fruitstacks';

export interface AssetOverrides {
  bg?: string | null;
  fsBg?: string | null;
  frame?: unknown;
  expandingWild?: string | null;
}

export interface ResolvedAudioEvent {
  file: string;
  volume: number;
  loop?: boolean;
  exclusive?: boolean;
  role?: string;
  enabled?: boolean;
  /** Clean-Sounds trim window (Audio Studio): apply at play time via
   *  seek(offsetMs) + gain(gainDb) + fade-out ending at durMs. */
  trim?: { offsetMs: number; durMs: number; fadeOutMs: number; gainDb: number };
}

export interface PresetInputs {
  name: string;
  game: GameKey;
  gridId: '5x3' | '5x5' | '6x5';
  profileId: string;
  /** Raw math manifest JSON for profileId (the CURRENT certified one). */
  manifest: Record<string, unknown> | null;
  overrides: AssetOverrides;
  /** eventId → resolved {file, volume,…} incl. library picks + user volume overrides. */
  audioEvents: Record<string, ResolvedAudioEvent>;
  /** applyVisualParam id → value: the shipped studio-parameter state (frame
   *  width/opacity, cell backdrop, colours, symbol size, …). The dev reproduces
   *  each 1:1 — this IS the locked look of the build. */
  visualParams: Record<string, string>;
  bare: boolean;
  exportedAt: string;
  generatorVersion: string;
  /** Full live presentation/tuning inventory (src/data/*PresentationTuning.json)
   *  — the 1:1 block the partner replays: symbol muls, tease, marquee,
   *  landing, layout rules, audio design volumes + mixing rules. */
  presentationTuning?: Record<string, unknown>;
}

// ── Layout constants (drift-asserted against the runtime in buildPresets) ──
// Source of truth: src/game/PixiApp.ts:51-54 + src/config/gridConfig.ts.
const CELL = { w: 120, h: 110, gapV: 6, gapH: 8 };
const LAYOUT = { framePad: 28, headerH: 52, footerH: 20, sceneMargin: 40 };
const GRIDS: Record<string, { reels: number; rows: number; stripLength: number }> = {
  '5x3': { reels: 5, rows: 3, stripLength: 40 },
  '5x5': { reels: 5, rows: 5, stripLength: 40 },
  '6x5': { reels: 6, rows: 5, stripLength: 60 },
};

function gridBlock(id: string): Record<string, unknown> {
  const g = GRIDS[id];
  return {
    id,
    reels: g.reels,
    rows: g.rows,
    cell: { w: CELL.w, h: CELL.h, gapV: CELL.gapV, gapH: CELL.gapH },
    framePad: LAYOUT.framePad,
    headerH: LAYOUT.headerH,
  };
}

function gridPx(id: string): Record<string, number> {
  const g = GRIDS[id];
  const gridW = g.reels * CELL.w + (g.reels - 1) * CELL.gapH;
  const gridH = g.rows * (CELL.h + CELL.gapV);
  const rw = gridW + 2 * LAYOUT.framePad;
  const rh = gridH + 2 * LAYOUT.framePad;
  return { gridW, gridH, machineW: rw, machineH: rh, totalH: LAYOUT.headerH + rh + LAYOUT.footerH };
}

const GAME_META: Record<GameKey, { id: string; theme: string; label: string; defaultProfile: string }> = {
  vice: { id: 'vice-heat', theme: 'vice', label: 'Vice Heat', defaultProfile: 'vice-heat-custom' },
  crackfarm: { id: 'crack-farm', theme: 'crackfarm', label: 'Crack Farm', defaultProfile: 'crack-farm-lines' },
  fruitstacks: { id: 'fruit-stacks', theme: 'fruitstacks', label: 'Fruit Stacks', defaultProfile: 'fruit-stacks-tumble' },
};

// ── Math normalization ──────────────────────────────────────────────────────
// Guarantees the OPERATIVE field rtpBps exists (the partner read the stale
// targetRtpPct once — never again) and folds the Fruit-Stacks buy stages
// into custom{} so every payout-relevant number lives in the manifest.
function normalizeManifest(game: GameKey, m: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...m };
  const custom: Record<string, unknown> = { ...(m.custom as Record<string, unknown> ?? {}) };
  if (out.rtpBps == null) {
    const sim = Number(custom.simRtpPct);
    out.rtpBps = Number.isFinite(sim) && sim > 0
      ? Math.round(sim * 100)
      : (out as { rtpTargetBps?: number }).rtpTargetBps ?? 9600;
  }
  if (game === 'fruitstacks') {
    // Certified bet-enhancer stages (session 2026-07-22): fixed prices,
    // start pools shown in the pool field at round open, gift-enhanced FS
    // strips; stage 1 additionally trims the ×500 multiplier tail.
    custom.buyStages = [
      { stage: 1, label: 'FREE SPINS', costMult: 100, startPool: 0, extraGiftsPerStrip: 0.67, trimMultTailAbove: 500, certifiedRtpPct: 95.7 },
      { stage: 2, label: 'START ×50', costMult: 300, startPool: 50, extraGiftsPerStrip: 1.17, certifiedRtpPct: 94.3 },
      { stage: 3, label: 'START ×100', costMult: 500, startPool: 100, extraGiftsPerStrip: 1.5, certifiedRtpPct: 94.2 },
    ];
    if (out.retriggerSpins == null && custom.retriggerSpins != null) out.retriggerSpins = custom.retriggerSpins;
  }
  out.custom = custom;
  return out;
}

// ── Mechanics (affectsMath entries point into the manifest, never re-declare) ──
const MECHANICS: Record<GameKey, Record<string, unknown>[]> = {
  vice: [
    { id: 'tiered-free-spins', kind: 'fs-structure', enabled: true, affectsMath: true,
      mathBinding: ['freeSpinsCount', 'freeSpinsCap', 'retriggerSpins', 'custom.stickyRoundSpins', 'custom.stickyRoundCap'],
      params: { trigger3sc: '7 expanding-wild spins', trigger4sc: '10 sticky-tower spins' }, compatibleGrids: ['5x5'] },
    { id: 'expanding-wild', kind: 'grid-effect', enabled: true, affectsMath: true,
      mathBinding: ['custom.expandingWildsInFreeSpins', 'custom.simulExpandMultipliers'],
      params: { towerArt: 'theme/vice/wild_column.webp', racesOutOfLandingCell: true, locksReel: true }, compatibleGrids: ['5x5'] },
    { id: 'sticky-expanding-towers', kind: 'grid-effect', enabled: true, affectsMath: true,
      mathBinding: ['custom.stickyExpandingFrom4Scatters', 'custom.stickyTowerCap'], compatibleGrids: ['5x5'] },
    { id: 'hot-spins', kind: 'base-feature', enabled: true, affectsMath: true,
      mathBinding: ['custom.hotSpinChance1In', 'custom.hotSpinExpandsWilds'] },
    { id: 'ways-light', kind: 'win-presentation', enabled: true, affectsMath: false,
      params: { sequential: 'line-by-line', cometHead: 'small', colorPreset: 'white' } },
    { id: 'win-marquees', kind: 'win-presentation', enabled: true, affectsMath: false,
      params: { tiers: ['win', 'big', 'mega', 'epic', 'max'], coinRain: true, tallyTicks: true, marqueeDucksAmbient: true } },
    { id: 'universal-anticipation', kind: 'presentation', enabled: true, affectsMath: false,
      params: { preset: 'universal-anticipation', cameraPovDolly: { base: 1.06, perStep: 0.05 } } },
    { id: 'frame-win-flash', kind: 'presentation', enabled: true, affectsMath: false,
      params: { trigger: '3rd-scatter-land', oneShot: true } },
    { id: 'scatter-trigger-beat', kind: 'win-presentation', enabled: true, affectsMath: false,
      params: { scatterWinSheetOnTrigger: true, growScale: 1.28, note: 'no fly-to-center collect; win anim + zoom only' } },
    { id: 'sound-volume-parameters', kind: 'presentation', enabled: true, affectsMath: false,
      params: {
        note: 'GENERATOR FEATURE (Noski): expose a per-event VOLUME parameter for EVERY audio event in the real generator UI. audio.events[<id>].volume in this preset is the operative loudness of the shipped build (design default merged with the volume sliders) — reproduce it 1:1 and make each one adjustable. The sound LIBRARY picker is studio-only and NOT part of this feature.',
        source: 'audio.events (complete: every registry event with file + volume + loop/exclusive flags)',
      } },
    { id: 'buy-stages', kind: 'base-feature', enabled: true, affectsMath: true,
      mathBinding: ['custom.viceBuyStages'],
      params: { presentation: 'forced stops carry the bought scatter count — 2 land, tease arms, rest drop like a natural trigger; board evaluated in full (display == payout)' } },
    { id: 'ante-bet', kind: 'base-feature', enabled: true, affectsMath: true,
      mathBinding: ['custom.anteBet'],
      params: { label: '3x FREE SPINS CHANCE', note: 'toggle: every spin costs bet x anteBet.costMult and runs on anteBet.reelStrips (certified ~3x natural trigger chance)' } },
  ],
  crackfarm: [
    { id: 'paylines', kind: 'win-presentation', enabled: true, affectsMath: true,
      mathBinding: ['custom.paylines'],
      params: { presentation: 'single-pass edge-to-edge beam (no loop)' }, compatibleGrids: ['5x3'] },
    { id: 'tiered-free-spins', kind: 'fs-structure', enabled: true, affectsMath: true,
      mathBinding: ['freeSpinsCount', 'freeSpinsCap', 'retriggerSpins', 'custom.plantStartMultipliers'],
      params: { spinsAllTiers: 7, startMultiByTrigger: '3sc ×1 / 4sc ×8 / 5sc ×32' }, compatibleGrids: ['5x3'] },
    { id: 'roaming-wild-plant', kind: 'grid-effect', enabled: true, affectsMath: true,
      mathBinding: ['custom.roamingWildFrom3Scatters', 'custom.plantMultiMode', 'custom.plantMultiCap', 'custom.plantMultiIncrement'],
      params: { relocation: 'upright level left-right dance across reels (no lean/overshoot)' } },
    { id: 'sticky-plant', kind: 'grid-effect', enabled: true, affectsMath: true,
      mathBinding: ['custom.stickyPlantFrom4Scatters', 'custom.plantCountWeights'] },
    { id: 'base-plant-feature', kind: 'base-feature', enabled: true, affectsMath: true,
      mathBinding: ['custom.baseFeatureOdds', 'custom.baseFeatureMultipliers'],
      params: { presentation: 'screen dims, green pads pulse under reels, 1-5 plants lock' } },
    { id: 'landing-sheets', kind: 'symbol-animation', enabled: true, affectsMath: false,
      params: { oneShotOnReelStop: true, fps: 16, note: 'hands back to static art after one pass' } },
    { id: 'win-marquees', kind: 'win-presentation', enabled: true, affectsMath: false,
      params: { tiers: ['win', 'big', 'mega', 'epic', 'max'], coinRain: true, marqueeDucksAmbient: true } },
    { id: 'universal-anticipation', kind: 'presentation', enabled: true, affectsMath: false },
    { id: 'sound-volume-parameters', kind: 'presentation', enabled: true, affectsMath: false,
      params: {
        note: 'GENERATOR FEATURE (Noski): expose a per-event VOLUME parameter for EVERY audio event in the real generator UI. audio.events[<id>].volume in this preset is the operative loudness of the shipped build (design default merged with the volume sliders) — reproduce it 1:1 and make each one adjustable. The sound LIBRARY picker is studio-only and NOT part of this feature.',
        source: 'audio.events (complete: every registry event with file + volume + loop/exclusive flags)',
      } },
  ],
  fruitstacks: [
    { id: 'scatter-pays', kind: 'grid-effect', enabled: true, affectsMath: true,
      mathBinding: ['custom.scatterPays', 'payTable'],
      params: { note: '8+/10-11/12+ of a kind anywhere pay; no lines/ways' }, compatibleGrids: ['6x5'] },
    { id: 'tumble-cascade', kind: 'grid-effect', enabled: true, affectsMath: true,
      mathBinding: ['custom.tumble'],
      params: { drop: 'full-board drop-in (reels never spin)', refillSquash: 0.94, firstDropSquash: 0.8 } },
    { id: 'gift-multiplier-crates', kind: 'grid-effect', enabled: true, affectsMath: true,
      mathBinding: ['custom.multiWeights', 'custom.multiPoolCap'],
      params: { tiers: { silver: '≤5×', red: '≤30×', gold: '>30×' }, badgeAnchored: 'crates ride tumble gravity' } },
    { id: 'fs-multiplier-pool', kind: 'fs-structure', enabled: true, affectsMath: true,
      mathBinding: ['freeSpinsCount', 'freeSpinsCap', 'retriggerSpins', 'custom.multiPoolCap'],
      params: { flow: 'gift values fly RIGHT into pool field; plate collects round win; at round end pool flies onto win' } },
    { id: 'buy-stages', kind: 'base-feature', enabled: true, affectsMath: true,
      mathBinding: ['custom.buyStages'],
      params: { pricesXBet: [100, 300, 500], startPools: [0, 50, 100] } },
    { id: 'scatter-breathing', kind: 'symbol-animation', enabled: true, affectsMath: false,
      params: { choreo: 'synced sine, scale 1.055/1.09/1.13 at 3/4/5 scatters' } },
    { id: 'fs-intro-badge', kind: 'boot', enabled: true, affectsMath: false,
      params: { style: 'dark field 0.82, 15-badge, breathing CLICK TO START, 12s auto' } },
    { id: 'win-marquees', kind: 'win-presentation', enabled: true, affectsMath: false,
      params: { tiers: ['win', 'big', 'mega', 'epic', 'max'], coinRain: 'own green-keyed rain behind marquee', marqueeDucksAmbient: true } },
    { id: 'sound-volume-parameters', kind: 'presentation', enabled: true, affectsMath: false,
      params: {
        note: 'GENERATOR FEATURE (Noski): expose a per-event VOLUME parameter for EVERY audio event in the real generator UI. audio.events[<id>].volume in this preset is the operative loudness of the shipped build (design default merged with the volume sliders) — reproduce it 1:1 and make each one adjustable. The sound LIBRARY picker is studio-only and NOT part of this feature.',
        source: 'audio.events (complete: every registry event with file + volume + loop/exclusive flags)',
      } },
  ],
};

// ── Assets per game ─────────────────────────────────────────────────────────
function sheet(fileOrSheets: string | string[], cols: number, rows: number, count: number, fps: number,
  extra?: Record<string, unknown>): Record<string, unknown> {
  const base = Array.isArray(fileOrSheets) ? { sheets: fileOrSheets } : { file: fileOrSheets };
  return { ...base, cols, rows, count, fps, ...extra };
}

function viceAssets(o: AssetOverrides): Record<string, unknown> {
  const B = 'theme/vice/';
  const sym = (k: string) => ({ static: `${B}symbol_${k}_landing.png` });
  return {
    root: 'assets/',
    theme: B,
    images: {
      logo: `${B}logo.webp`,
      background: (o.bg as string) ?? `${B}bg_motel.webp`,
      fsBackground: (o.fsBg as string) ?? `${B}fsbg_beachclub.webp`,
      expandingWildTower: (o.expandingWild as string) ?? `${B}wild_column.webp`,
      frame: (o.frame as object) ?? { file: `${B}frame_neon.webp`, window: { x: 197, y: 314, w: 832, h: 832 } },
    },
    symbols: {
      wild: sym('wild'),
      scatter: {
        static: `${B}symbol_scatter_landing.png`,
        idle: sheet(`${B}scatteridle.webp`, 10, 9, 90, 10, { loop: true, frame: { w: 256, h: 256 }, placement: 'replaces static art on resting cells, random start frame' }),
        win: sheet(`${B}scatterwin.webp`, 8, 9, 67, 15, { loop: true, frame: { w: 256, h: 256 }, placement: 'FS-trigger beat, grows 1.28 over resting look' }),
      },
      high_a: { ...sym('high_a'), win: sheet(`${B}prem_a_win.webp`, 7, 7, 48, 12, { loop: true, frame: { w: 256, h: 256 } }) },
      high_b: { ...sym('high_b'), win: sheet(`${B}prem_b_win.webp`, 7, 7, 48, 12, { loop: true, frame: { w: 256, h: 256 } }) },
      mid_c: { ...sym('mid_c'), win: sheet(`${B}car_win.webp`, 7, 7, 48, 12, { loop: true, frame: { w: 256, h: 256 } }) },
      mid_d: { ...sym('mid_d'), win: sheet(`${B}koffer_win.webp`, 7, 7, 48, 12, { loop: true, frame: { w: 256, h: 256 } }) },
      low_e: sym('low_e'), low_f: sym('low_f'), low_g: sym('low_g'),
    },
    spritesheets: {
      backgroundLoop: sheet([`${B}bg_motel_anim_1.webp`, `${B}bg_motel_anim_2.webp`, `${B}bg_motel_anim_3.webp`], 4, 4, 45, 6, { loop: true, placement: 'cover' }),
      fsBackgroundLoop: sheet([`${B}fsbg_beachclub_anim_1.webp`, `${B}fsbg_beachclub_anim_2.webp`, `${B}fsbg_beachclub_anim_3.webp`], 4, 4, 48, 6, { loop: true, placement: 'cover' }),
      frameWinFlash: sheet(`${B}frame_win_flash_1.webp`, 8, 6, 48, 12, { loop: false, region: { x: 1025, y: 225, w: 475, h: 1062.5 }, placement: 'overlays the frame texture at region; one-shot on 3rd scatter land' }),
      coinRain: sheet(['theme/win-tiers/coinrain3_0.webp', 'theme/win-tiers/coinrain3_1.webp', 'theme/win-tiers/coinrain3_2.webp'], 10, 10, 300, 45, { loop: true, placement: 'cover' }),
    },
    winTiers: { dir: 'theme/win-tiers/', layers: ['big', 'mega', 'epic', 'max', 'win', 'plate'] },
    introLayers: { manifest: 'data/introLayers.json', dir: `${B}intro/` },
  };
}

function crackfarmAssets(o: AssetOverrides): Record<string, unknown> {
  const C = 'theme/crackfarm/';
  const landing = (k: string) => sheet(`${C}symbol_${k}_landanim.png`, 6, 4, 24, 16, { loop: false, placement: 'cell one-shot on reel stop, hands back to static' });
  const win = (k: string, fps = 10) => sheet(`${C}symbol_${k}_win.png`, 6, 4, 24, fps, { loop: true });
  const sym = (k: string) => ({ static: `${C}symbol_${k}_landing.png`, win: win(k) });
  const sheets: Record<string, unknown> = {
    fsBackgroundLoop: sheet([`${C}bg_fs_anim_1.webp`, `${C}bg_fs_anim_2.webp`, `${C}bg_fs_anim_3.webp`], 4, 4, 48, 8, { loop: true, placement: 'cover' }),
    coinRain: sheet(['theme/win-tiers/coinrain3_0.webp', 'theme/win-tiers/coinrain3_1.webp', 'theme/win-tiers/coinrain3_2.webp'], 10, 10, 300, 45, { loop: true, placement: 'cover' }),
  };
  // landing sheets live here because symbolAsset (schema v2) only knows
  // static/idle/win — see extras.schemaNotes.
  for (const k of ['high_a', 'high_b', 'mid_c', 'mid_d', 'low_e', 'low_f', 'low_g']) sheets[`landing_${k}`] = landing(k);
  return {
    root: 'assets/',
    theme: C,
    images: {
      logo: `${C}logo.webp`,
      background: (o.bg as string) ?? `${C}bg_base.webp`,
      fsBackground: (o.fsBg as string) ?? `${C}bg_fs.webp`,
      expandingWildTower: (o.expandingWild as string) ?? `${C}wild_column.png`,
      frame: (o.frame as object) ?? { file: `${C}frame.webp` },
      fsPlaque: `${C}plaque_frame.png`,
      pigIdle: `${C}pig_idle.png`,
      pigMascot: `${C}pig_mascot.png`,
      pigMaxwin: `${C}pig_maxwin.png`,
    },
    symbols: {
      wild: { static: `${C}symbol_wild_landing.png` },
      scatter: { static: `${C}symbol_scatter_landing.png`, win: win('scatter', 12) },
      high_a: sym('high_a'), high_b: sym('high_b'), mid_c: sym('mid_c'), mid_d: sym('mid_d'),
      low_e: sym('low_e'), low_f: sym('low_f'), low_g: sym('low_g'),
    },
    spritesheets: sheets,
    winTiers: { dir: `${C}win-tiers/`, layers: ['big', 'mega', 'epic', 'max', 'win', 'plate'] },
    introLayers: { dir: `${C}intro/` },
  };
}

function fruitstacksAssets(o: AssetOverrides): Record<string, unknown> {
  const F = 'theme/fruitstacks/';
  const sym = (k: string) => ({ static: `${F}symbol_${k}.png` });
  return {
    root: 'assets/',
    theme: F,
    images: {
      logo: `${F}logo.png`,
      background: (o.bg as string) ?? `${F}bg_base.webp`,
      frame: (o.frame as object) ?? { file: `${F}frame.png` },
      platePill: `${F}plate_pill.png`,
      poolGift: `${F}pool_gift.png`,
      fsBadge15: `${F}fs_badge_15.png`,
      fsBadge5: `${F}fs_badge_5.png`,
      bonusActive: `${F}bonus_active.png`,
      buycard1: `${F}buycard_1.png`,
      buycard2: `${F}buycard_2.png`,
      buycard3: `${F}buycard_3.png`,
      giftTier1: `${F}gift_tier1.png`,
      giftTier2: `${F}gift_tier2.png`,
      giftTier3: `${F}gift_tier3.png`,
    },
    symbols: {
      wild: { static: `${F}wild_w.png` },
      scatter: sym('scatter'),
      high_a: sym('high_a'), high_b: sym('high_b'), mid_c: sym('mid_c'), mid_d: sym('mid_d'),
      low_e: sym('low_e'), low_f: sym('low_f'), low_g: sym('low_g'), low_h: sym('low_h'), low_i: sym('low_i'),
      gift: sym('multi'),
    },
    spritesheets: {
      coinRain: sheet([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `${F}coinrain_fs_${i}.webp`), 5, 4, 200, 45, { loop: true, placement: 'cover, behind the marquee layer' }),
    },
    winTiers: { dir: `${F}win-tiers/`, layers: ['big', 'mega', 'epic', 'max', 'win', 'plate', 'total'] },
    introLayers: { dir: `${F}intro/` },
  };
}

const ASSET_BUILDERS: Record<GameKey, (o: AssetOverrides) => Record<string, unknown>> = {
  vice: viceAssets, crackfarm: crackfarmAssets, fruitstacks: fruitstacksAssets,
};

// ── Flow (stage pipeline as data) ───────────────────────────────────────────
const FLOWS: Record<GameKey, Record<string, unknown>> = {
  vice: {
    iris: { style: 'looney-iris' },
    stages: [
      { id: 'boot', controlBar: false, params: { overlay: 'game-area only, bar = real load fraction' } },
      { id: 'game-intro', transitionOut: 'iris-from-black', controlBar: false },
      { id: 'base', controlBar: true },
      { id: 'tease', controlBar: true, params: { preset: 'universal-anticipation', cameraPovDolly: { base: 1.06, perStep: 0.05 } } },
      { id: 'fs-intro', transitionIn: 'iris', controlBar: false, params: { holdSec: 7, cards: ['fs3', 'fs4'] } },
      { id: 'fs-round', controlBar: true },
      { id: 'win-marquees', controlBar: true, params: { tallyTicks: true, ducksAmbient: true } },
      { id: 'total-win-outro', controlBar: false, params: { holdSecMax: 15 } },
    ],
  },
  crackfarm: {
    iris: { style: 'looney-iris' },
    stages: [
      { id: 'boot', controlBar: false },
      { id: 'game-intro', transitionOut: 'iris-from-black', controlBar: false },
      { id: 'base', controlBar: true },
      { id: 'base-plant-feature', controlBar: false, params: { dim: true, pads: 'green glowing, pulse+jump, lock' } },
      { id: 'tease', controlBar: true },
      { id: 'fs-intro', transitionIn: 'iris', controlBar: false, params: { cards: ['fs3', 'fs4', 'fs5'] } },
      { id: 'fs-round', controlBar: true, params: { plantRelocation: 'upright dance between spins' } },
      { id: 'win-marquees', controlBar: true },
      { id: 'total-win-outro', controlBar: false },
    ],
  },
  fruitstacks: {
    iris: { style: 'none (dark-field badge intro instead)' },
    stages: [
      { id: 'boot', controlBar: false },
      { id: 'game-intro', controlBar: false },
      { id: 'base', controlBar: true, params: { spin: 'full-board drop-in, no reel spin' } },
      { id: 'tumble', controlBar: true, params: { chargeSec: 0.22, burst: 'explode + 7 juice droplets', breathBetweenStepsSec: 0.35 } },
      { id: 'fs-intro', controlBar: false, params: { style: 'dark field 0.82 + 15-badge + CLICK TO START, 12s auto' } },
      { id: 'fs-round', controlBar: true, params: { giftFlight: 'values fly right into pool', plateCollects: 'round win' } },
      { id: 'fs-retrigger-beat', controlBar: false, params: { badge: '+5 FREE SPINS slam' } },
      { id: 'fs-total', controlBar: false, params: { poolFliesOntoWin: true } },
      { id: 'win-marquees', controlBar: true },
    ],
  },
};

// ── Sizing + performance package (extras) ───────────────────────────────────
function sizingPackage(game: GameKey, gridId: string): Record<string, unknown> {
  return {
    machineBox: {
      ...LAYOUT,
      formulas: {
        gridW: 'reels*cell.w + (reels-1)*cell.gapH',
        gridH: 'rows*(cell.h + cell.gapV)',
        machineW: 'gridW + 2*framePad',
        machineH: 'gridH + 2*framePad',
        totalH: 'headerH + machineH + footerH',
      },
      px: Object.fromEntries(Object.keys(GRIDS).map(id => [id, gridPx(id)])),
      activeGridPx: gridPx(gridId),
      reelSetOrigin: 'container at (framePad, framePad) inside the machine box, machine box at y=headerH',
    },
    renderer: {
      // The anti-"laggy/shaky/pixelig" block: these three settings are the
      // difference between crisp and mushy on DPR-1 monitors.
      resolution: 2,
      resolutionRule: 'FIXED floor 2 (supersampling) — max(2, min(devicePixelRatio, 2)); autoDensity true; antialias true',
      filterResolution: "'inherit' — filters MUST inherit the floor-2 resolution or they render pixelated",
      spritesheetPlayback: 'one texture per sheet file, frames cut as sub-rectangles (no per-frame images); advance frames on a ticker at the sheet fps — never re-upload textures per frame',
    },
    scaleToFit: {
      formula: 'scale = min(availW/(totalW+frameOverhangL+frameOverhangR), availH/totalH, 1.3) * gameFactor; avail = screen - 2*sceneMargin',
      gameFactor: { vice: 0.85, crackfarm: 0.85, fruitstacks: 0.97, compactUnderWidth520: 0.98 },
      fruitstacksExtra: 'scatterpays additionally shifts the scene down by height*0.045',
    },
    iframeShell: {
      centerColumnMaxWidthPx: 960,
      aspectRatio: gridId === '5x5' ? '5 / 5.15' : '16 / 9',
      aspectRule: "5x5 grid → '5 / 5.15', all other grids → '16 / 9'",
      maxHeight: '60vh',
      mobilePortraitPreview: { w: 390, h: 760 },
    },
    introDesignSpace: { w: 1920, h: 1080, bgFit: 'cover = max(sw/1920, sh/1080)', cardFit: 'contain*0.98 = min(sw/1920, sh/1080)*0.98' },
    symbolDraw: {
      formula: 'targetSize = round(min(cell.w, cell.h) * 0.88 * objectScale * perSymbolMul)',
      objectScale: 1.3,
      perSymbolMuls: {
        vice: { default: 0.8, scatter: 0.96 },
        crackfarm: { default: 1, scatter: 0.96 },
        fruitstacks: { default: 0.9, scatter: 0.99 },
      }[game],
      note: "objectScale 1.3 = the 'large' symbol-size preset (default); art is square-stretched to targetSize in both axes",
    },
  };
}

// ── Builder ─────────────────────────────────────────────────────────────────
export function buildPresetV2(i: PresetInputs): Record<string, unknown> {
  const meta = GAME_META[i.game];
  const manifest = i.manifest ? normalizeManifest(i.game, i.manifest) : null;
  const schemaNotes: string[] = [];
  if (i.game === 'fruitstacks') {
    schemaNotes.push(
      "grid.id '6x5' + math.gridId '6x5' need the schema enums extended (v2 only lists 5x5/5x3)",
      "payModel 'scatterpays': payTable keys are count tiers (8+/10-11/12+), not 3/4/5-of-a-kind — needs a scatterpays branch in mathManifest",
      "suggest adding 'landing' to symbolAsset (one-shot on reel stop) — currently exported under spritesheets.landing_*",
    );
  } else {
    schemaNotes.push("suggest adding 'landing' to symbolAsset (one-shot on reel stop) — Crack Farm exports them under spritesheets.landing_*");
  }
  return {
    schema: 'chainwtf-game-preset',
    version: 2,
    generator: { name: 'GENERATOR PREVIEW (Noski studio)', version: i.generatorVersion },
    exportedAt: i.exportedAt,
    game: { id: meta.id, theme: meta.theme, label: i.name || meta.label },
    grid: gridBlock(i.gridId),
    math: manifest
      ? { mode: 'inline', manifest }
      : { mode: 'inline', manifest: { gridId: i.gridId, reelStrips: [], payTable: {}, scatterPay: [0, 0, 0], freeSpinsCount: 0, freeSpinsCap: 0, maxWinMultiplier: 0 } },
    mechanics: i.bare ? [] : MECHANICS[i.game],
    assets: i.bare ? { root: 'assets/' } : ASSET_BUILDERS[i.game](i.overrides),
    audio: {
      format: 'ogg',
      dir: 'audio/',
      mixing: { marqueeDucksAmbient: true, exclusiveGroups: [['ambient-music', 'win-marquee']] },
      events: i.audioEvents,
    },
    // The shipped studio-parameter state (frame/cell-backdrop/colours/size).
    // Every id maps to an adjustable generator parameter; reproduce 1:1 so the
    // build looks EXACTLY like the preview (Noski: locked look).
    visualParams: i.visualParams,
    flow: FLOWS[i.game],
    extras: {
      profileId: i.profileId,
      sizing: sizingPackage(i.game, i.gridId),
      ...(i.presentationTuning ? { presentationTuning: i.presentationTuning } : {}),
      schemaNotes,
      rtpNote: 'rtpBps is the operative certified RTP; targetRtpPct is display metadata only',
    },
  };
}

// Drift-guard data for the browser wrapper (buildPresets.ts asserts these
// against the live runtime constants in dev builds).
export const V2_LAYOUT_ASSUMPTIONS = { CELL, LAYOUT, GRIDS } as const;
