// App — the preview studio: the dev generator's harness (MockHost + Sidebar +
// GameCanvas + WinTierTestPanel) running the Fantasy spec 1:1, plus the studio
// drawer for overlay features (background swap, adjustable params, code
// paste/export). Mirrors src/dev/HarnessApp.tsx from the generator repo.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MockHost } from '@/dev/mockHost';
import type { HostApiV1, HostSnapshotV1 } from '@/bridge/types';
import { useGameState } from '@/hooks/useGameState';
import { useSoundLayer } from '@/audio/useSoundLayer';
import { uiSfx } from '@/audio/uiSfx';
import { ULTRA_CLEAN } from '@/audio/soundPresets';
import viceSoundPreset from '@/data/viceSoundPreset.json';
import { Sidebar } from '@/ui/Sidebar';
import { GameCanvas } from '@/ui/GameCanvas';
import { ControlBar } from '@/ui/ControlBar';
import { BonusBuyOverlay, FruitBuyRail, ViceBuyRail, type ViceBuyStageDef } from '@/ui/BonusBuyOverlay';
import { StudioDrawer } from '@/studio/StudioDrawer';
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/engine/GameConfig';
import { GRID_5x3, GRID_5x5, GRID_6x5 } from '@/config/gridConfig';
import { PresetDock, loadGridId, type GridId } from '@/dev/PresetDock';
import { mathProfileById, loadMathProfileId, saveMathProfileId } from '@/config/mathProfiles';
import { getThemeByName } from '@/config/themes';
import { viceSymbolMap, VICE_INTRO_URL } from '@/config/viceAssets';
import { CRACKFARM, crackFarmSymbolMap, crackFarmGameIntro } from '@/config/crackFarmTheme';
import { FRUITSTACKS, fruitStacksSymbolMap, fruitStacksGameIntro } from '@/config/fruitStacksTheme';
import introLayers from '@/data/introLayers.json';
import { loadAssets } from '@/studio/assetPersistence';
import type { PixiApp } from '@/game/PixiApp';
import { STATIC_LOOK_SYMBOLS, NO_IDLE_SYMBOLS, SYMBOL_SIZE_MULS, SYMBOL_WIN_SHEET_FRAMED } from '@/game/AnimatedSymbol';
import { setActiveStatePreset } from '@/config/statePresets';
import { landingImpactConfig } from '@/game/effects/LandingImpact';
import { waysLightConfig, WAYS_LIGHT_PRESETS } from '@/game/effects/WaysLightComet';
import { waysImmersiveConfig } from '@/game/effects/WaysImmersive';
import { teaseTuning } from '@/game/effects/teaseRegistry';
import { setWinTierGeometry } from '@/game/WinCelebration';
import { BuildTopBar, BuildSlots } from '@/studio/BuildDock';
import { isBareBuild, loadActiveGame, downloadExport } from '@/studio/buildPresets';
import { AudioStudioPage } from '@/ui/audioStudio/AudioStudioPage';
import { getSharedSoundManager } from '@/audio/defaultSoundConfig';
import { reloadCleanParams } from '@/audio/SoundManager';

/** EMBED mode (?embed=1): the slot alone, no studio chrome — used as the
 *  live preview iframe inside the Audio Studio page. Same origin, same
 *  localStorage: sound picks / volumes / clean params sync in live via the
 *  cross-frame 'storage' event (listener below). */
const EMBED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed');

/** Einmalige, idempotente Migration (2026-07-24): die Gift-Multi-Sounds
 *  liefen frueher als Alias auf wild-expand/wild-land. Noskis handgemachte
 *  Einstellungen (Event-Volumes + Bibliothek-Picks) fuer die Aliasse werden
 *  auf die neuen multi-* Events GESPIEGELT — nur wenn dort noch nichts
 *  steht, nie ueberschreibend (Settings-Durability-Regel). */
function migrateMultiSoundSettings(): void {
  try {
    const volRaw = localStorage.getItem('slot:audio-event-volumes');
    if (volRaw) {
      const vols = JSON.parse(volRaw) as Record<string, number>;
      let dirty = false;
      for (const [from, to] of [['wild-expand', 'multi-fly'], ['wild-land', 'multi-collect']] as const) {
        if (vols[from] != null && vols[to] == null) { vols[to] = vols[from]; dirty = true; }
      }
      if (dirty) localStorage.setItem('slot:audio-event-volumes', JSON.stringify(vols));
    }
    const assetsRaw = localStorage.getItem('slot:assets');
    if (assetsRaw) {
      const assets = JSON.parse(assetsRaw) as { sounds?: Record<string, string> };
      if (assets.sounds) {
        let dirty = false;
        for (const [from, to] of [['wild-expand', 'multi-fly'], ['wild-land', 'multi-collect']] as const) {
          if (assets.sounds[from] && !assets.sounds[to]) { assets.sounds[to] = assets.sounds[from]; dirty = true; }
        }
        if (dirty) localStorage.setItem('slot:assets', JSON.stringify(assets));
      }
    }
  } catch { /* Storage kaputt — Defaults greifen */ }
}
if (typeof window !== 'undefined') migrateMultiSoundSettings();

export function App() {
  const [hostApi, setHostApi] = useState<HostApiV1 | null>(null);
  const [snapshot, setSnapshot] = useState<HostSnapshotV1 | null>(null);
  const [pixiAppRef, setPixiAppRef] = useState<PixiApp | null>(null);
  const [turbo, setTurbo] = useState(false);
  /** The per-symbol win voice currently sounding — cut when the next winning
   *  line takes over so only one symbol ever speaks at a time. */
  const lastQuipRef = useRef<string | null>(null);
  // While the game intro screen is up, the control bar stays hidden and
  // fades in smoothly once the player taps through.
  const [introOpen, setIntroOpen] = useState(false);
  const [fsIntroOpen, setFsIntroOpen] = useState(false);
  // Fruit Stacks: a FS round is running — the left pill shows BONUS ACTIVE.
  const [fsRoundOn, setFsRoundOn] = useState(false);
  // Boot loading screen INSIDE the game area (the generator shows it in the
  // game iframe, never over the studio UI): real asset progress, then fade.
  const [bootProgress, setBootProgress] = useState(0.06);
  const [bootFade, setBootFade] = useState(false);
  const [bootGone, setBootGone] = useState(false);
  // Preview device: 'mobile' shows the game in a portrait phone frame.
  const [device, setDevice] = useState<'desktop' | 'mobile'>(
    () => (localStorage.getItem('studio-device') === 'mobile' ? 'mobile' : 'desktop'),
  );
  useEffect(() => { localStorage.setItem('studio-device', device); }, [device]);

  // The loaded game = the stamped Fantasy spec (config/reels+paytable+gameConfig
  // are the ZIP's generated files, so DEFAULT_GAME_CONFIG IS the Fantasy math)
  // with the generator's Fantasy theme applied — same as a deployed build.
  // Active grid (5×5 default = the Fantasy spec; 5×3 = the generator's classic
  // 3-row grid). Switching remounts GameCanvas/PixiApp with the same math —
  // the evaluator + all visuals derive from gridConfig.
  const [gridId] = useState<GridId>(loadGridId);
  const handleGridChange = useCallback((g: GridId) => {
    // A grid-locked math profile would override the toggle — clicking a
    // conflicting grid falls back to the grid-flexible original math so the
    // switch ALWAYS works (no more being stuck in the profile's grid).
    const profile = mathProfileById(loadMathProfileId());
    if (profile.grid && profile.grid !== g) saveMathProfileId('fantasy-extreme');
    localStorage.setItem('studio-grid', g);
    window.location.reload();
  }, []);

  const gameConfig = useMemo<GameConfig>(() => {
    // A selected math profile (dev's CURRENT manifest library) wins outright —
    // it carries its own grid, strips, paytable, FS params. Default stays the
    // original Fantasy math with the manual grid toggle.
    const profile = mathProfileById(loadMathProfileId());
    if (profile.build) return profile.build();
    return {
      ...DEFAULT_GAME_CONFIG,
      gridConfig: gridId === '5x3' ? GRID_5x3 : gridId === '6x5' ? GRID_6x5 : GRID_5x5,
      theme: getThemeByName('Fantasy'),
    };
  }, [gridId]);

  useEffect(() => {
    const mock = new MockHost(snap => setSnapshot(snap), gameConfig);
    setHostApi(mock.getHostApi());
    setSnapshot(mock.getSnapshot());
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    pixiAppRef?.setTheme('dark');
  }, [pixiAppRef]);

  // Baked asset pack: on mount, apply the user's persisted swaps if any, else
  // the baked "Vice" symbol art (public/theme/vice/) — so assets survive every
  // deploy/reload and stay until the user swaps them in the Assets tab.
  useEffect(() => {
    if (!pixiAppRef) return;
    // BARE BUILD ("Create New Build"): the naked scaffold — NO theme assets,
    // NO spritesheets, no intros. The boot overlay clears immediately.
    if (isBareBuild()) {
      setBootProgress(1);
      setTimeout(() => setBootFade(true), 150);
      setTimeout(() => setBootGone(true), 800);
      return;
    }
    const saved = loadAssets();
    // ── BOOT PROGRESS: the loading overlay covers the GAME AREA (not the
    // studio UI) until the CRITICAL theme visuals are loaded, then fades
    // straight into the intro's iris-from-black entrance. Non-critical
    // assets (win sheets, FS art, anim loops) keep loading in parallel
    // behind it. Bar width = real completed-jobs fraction.
    const bootJobs: Promise<unknown>[] = [];
    const bootTracked = { done: 0 };
    const track = <T,>(p: Promise<T>): void => {
      bootJobs.push(p.catch(() => undefined).then(() => {
        const done = ++bootTracked.done;
        setBootProgress(0.06 + 0.94 * (done / bootJobs.length));
      }));
    };
    const activeGame = loadActiveGame();
    if (activeGame === 'crackfarm') {
      // ── CRACK FARM (5×3 barn theme) ──────────────────────────────────────
      // Intensity: symbols SLAM in hard (5×3 → each drop lands with weight).
      // The weight reads as a DEEP downward board-jolt, not symbol squash
      // (Noski: "nicht so stark einklappen, lieber deeper runter slammen"):
      // crack-slam keeps the art near-rigid; the thud amps carry the impact.
      setActiveStatePreset('crack-slam');
      landingImpactConfig.squashMul = 1.1;   // barely deepen the (already soft) squash
      landingImpactConfig.thudAmp = 6;       // per-stop board slam (default 2.2)
      landingImpactConfig.thudLastAmp = 11;  // final reel hits hardest (default 4)
      // PAYLINES presentation: the ways-immersive leap/dance reads as a WAYS
      // slot and (by design) suppresses the win-line comet + decoration.
      // Off for Crack Farm → classic line look: cells pulse IN PLACE, the
      // frames/dots decorate the line cells, and the ways-light comet shoots
      // through each payline, line by line.
      waysImmersiveConfig.enabled = false;
      // Scatter sack: 20% smaller than its default presence boost.
      SYMBOL_SIZE_MULS.set(1, 0.96);
      const cf = CRACKFARM.base;
      const cfSymbols = saved.symbols && Object.keys(saved.symbols).length
        ? new Map(Object.entries(saved.symbols).map(([k, v]) => [Number(k), v]))
        : crackFarmSymbolMap();
      track(pixiAppRef.setUserAssetTextures(cfSymbols));
      track(pixiAppRef.setBackgroundImage(saved.bg ?? CRACKFARM.bgBase));
      // BASE background is STATIC (Noski) — the still barn scene, no loop. The
      // animated bg_base_anim sheets are kept in /theme/crackfarm/ but not wired.
      track(pixiAppRef.setTitleImage(CRACKFARM.logo));
      STATIC_LOOK_SYMBOLS.add(1);
      NO_IDLE_SYMBOLS.add(0);
      // Per-symbol WIN animations (Noski's connection clips, magenta-keyed →
      // 6×4 = 24 frames @ 10fps each). On a connection the symbol's own clip
      // plays IN PLACE of the static art; AnimatedSymbol suppresses the leap/
      // outline for sheet-carrying symbols (§1) so it's "static tile → our
      // sheet on top", no competing effect. HIGH_A(2)=cow, HIGH_B(3)=goat,
      // MID_C(4), MID_D(5), WILD(0).
      void pixiAppRef.setSymbolWinSheet(2, `${cf}symbol_high_a_win.png`, 6, 4, 24, 10);
      void pixiAppRef.setSymbolWinSheet(3, `${cf}symbol_high_b_win.png`, 6, 4, 24, 10);
      void pixiAppRef.setSymbolWinSheet(4, `${cf}symbol_mid_c_win.png`, 6, 4, 24, 10);
      void pixiAppRef.setSymbolWinSheet(5, `${cf}symbol_mid_d_win.png`, 6, 4, 24, 10);
      void pixiAppRef.setSymbolWinSheet(6, `${cf}symbol_low_e_win.png`, 6, 4, 24, 10); // carrot
      void pixiAppRef.setSymbolWinSheet(7, `${cf}symbol_low_f_win.png`, 6, 4, 24, 10); // corn
      void pixiAppRef.setSymbolWinSheet(8, `${cf}symbol_low_g_win.png`, 6, 4, 24, 10); // slime bucket
      void pixiAppRef.setSymbolWinSheet(1, `${cf}symbol_scatter_win.png`, 6, 4, 24, 12); // SCATTER
      // Per-symbol LANDING clips — play ONCE on the drop, then hand back to the
      // static tile (Noski: "landing einmal"). Wild(0) stays a static pot,
      // scatter(1) keeps its own win clip only.
      void pixiAppRef.setSymbolLandSheet(2, `${cf}symbol_high_a_landanim.png`, 6, 4, 24, 16);
      void pixiAppRef.setSymbolLandSheet(3, `${cf}symbol_high_b_landanim.png`, 6, 4, 24, 16);
      void pixiAppRef.setSymbolLandSheet(4, `${cf}symbol_mid_c_landanim.png`, 6, 4, 24, 16);
      void pixiAppRef.setSymbolLandSheet(5, `${cf}symbol_mid_d_landanim.png`, 6, 4, 24, 16);
      void pixiAppRef.setSymbolLandSheet(6, `${cf}symbol_low_e_landanim.png`, 6, 4, 24, 16);
      void pixiAppRef.setSymbolLandSheet(7, `${cf}symbol_low_f_landanim.png`, 6, 4, 24, 16);
      void pixiAppRef.setSymbolLandSheet(8, `${cf}symbol_low_g_landanim.png`, 6, 4, 24, 16);
      // Crack Farm's win clips are full framed tiles → render 1:1 on the static
      // footprint, no soft-mask vignette (fixes the dark zoom-in — Noski).
      // WILD(0) gets NO 1×1 win sheet: the tall-plant connection clip blew the
      // small cell up ("wild eimer viel zu groß"); the pot plays a normal win.
      // The wild connection + growing clips belong on the EXPANDED plant.
      for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) SYMBOL_WIN_SHEET_FRAMED.add(id);
      // FARMER: removed entirely (Noski — "den bauer rechts weg machen, auch
      // base game"). No side character on this theme.
      // The FLYING PIG hovers LEFT of the barn (mockup: ~0.45× frame height,
      // centre at ~36% height, well clear of the frame edge). Static art
      // with a hover bob — swaps to the idle sheet when it arrives (just
      // pass cols/rows/count/fps in the opts).
      // Pig idle animation ALWAYS loops (Noski's mp4 → 6×5 = 30 frames @12fps,
      // magenta-keyed). Win-state pig clips will swap in when Noski ships them.
      void pixiAppRef.setSideMascot(`${cf}pig_idle.png`, {
        cols: 6, rows: 5, count: 30, fps: 9, // 25% slower idle-fly tempo (Noski)
        side: 'left', centerYFrac: 0.4, heightFrac: 0.66, marginX: 70,
      });
      // The tall 1×3 mutant plant fills a reel on expansion — and it GROWS:
      // the wild slides down to the reel floor and the plant rises out of it.
      pixiAppRef.setExpandGrowth('bottom-up');
      // Crack Farm plant look (Noski): NO gold shine frame ("das wild fuckt
      // mich ab"), plant grows in translucent like the roaming traveller on a
      // blank reel behind it.
      pixiAppRef.setExpandStyle({ shine: false, plantAlpha: 1 }); // opaque plant (Noski: no see-through/gray)
      // No frosted reel pane on the barn: the blurred sunset bg showed through
      // the symbols' transparent corners as a milky white film.
      pixiAppRef.setReelFrosted(false);
      // The default 62% near-black window tint muddied the saturated farm art
      // ("nicht so farbig" — Noski). A light 22% keeps depth without the mud;
      // the barn frame's own window interior carries the darkness.
      pixiAppRef.applyVisualParam('reelBgOpacity', 22);
      // Payline beam colour = per-theme (research 16 §1: Wild Storm cyan,
      // Savage Santa gold). Toxic-slime GREEN fits the barn; the inherited
      // white beam read generic.
      waysLightConfig.color = WAYS_LIGHT_PRESETS.green.color;
      void pixiAppRef.setExpandingWildImage(saved.expandingWild ?? CRACKFARM.expandingWild);
      // Frame-by-frame plant GROW clip (sprout → full flytrap) plays on the
      // first wild landing; freezes on wild_column.png (its last frame).
      void pixiAppRef.setExpandGrowSheet(`${cf}wild_grow_sheet.png`, 6, 4, 24, 40);
      // Barn frame — alpha window auto-detected from the transparent centre.
      track(pixiAppRef.setFrameImage(saved.frame ?? CRACKFARM.frame));
      void pixiAppRef.setFreeSpinsBackgroundImage(saved.fsBg ?? CRACKFARM.bgFs);
      // LIVING FS background (Noski's moonlit night-farm mp4 → 3×(4×4) = 48
      // frames @8fps). Loops through the whole round behind the plants.
      if (!saved.fsBg) void pixiAppRef.setFreeSpinsBackgroundSpritesheet(
        [`${cf}bg_fs_anim_1.webp`, `${cf}bg_fs_anim_2.webp`, `${cf}bg_fs_anim_3.webp`],
        4, 4, 48, 8,
      );
      // Win marquee: crack-farm wooden-slime tier badges + price-area plate
      // (universal layered marquee); coin rain kept (theme-neutral gold shower).
      // The GEOMETRY matches the artist's files exactly (alpha-bbox measured
      // fractions of the 1080p canvas) — sizes/positions as authored.
      setWinTierGeometry({
        tierCy: { big: 0.2806, mega: 0.2796, epic: 0.2852, max: 0.2963 },
        winCy: 0.5028,
        plateCy: 0.7472,
        plateH: 0.3593,   // price-area bbox h388/1080
        contentFrac: 0.8116, // y[124.5..1001] across tiers
        contentCy: 0.5211,
        // The barn badges read small at the Vice default (Noski) — pushed up,
        // and the board dims behind the coin layer so the marquee pops off
        // the busy reels (reference convention, research 14 §5).
        sizeMul: 0.74,
        dimAlpha: 0.55,
      });
      void pixiAppRef.setWinTierImages(CRACKFARM.winTiers);
      // Wooden plaque frame behind the FREE SPINS / TOTAL WIN counters.
      void pixiAppRef.setFsPlaqueImage(`${CRACKFARM.base}plaque_frame.png`);
      // Multiplier badge on the plant = a centred SQUARE FIELD, not the vine
      // wreath (Noski: "unser multi sieht kacke aus, mach ein feld mittig
      // quadratisch"). Frame/background/number colour + font are live params
      // (multiBadge* → setMultiBadgeParam). EXPLICITLY set the barn-green look
      // here so it can never render as a bare white box (Noski: "weißer error")
      // — the studio param panel otherwise seeded a white/black default.
      pixiAppRef.applyVisualParam('multiBadgeBg', '#14260d');
      pixiAppRef.applyVisualParam('multiBadgeBorder', '#7ef23e');
      pixiAppRef.applyVisualParam('multiBadgeNumberColor', '#cfff7a');
      pixiAppRef.applyVisualParam('multiBadgeFont', 'Rubik');
      pixiAppRef.applyVisualParam('multiBadgeBorderWidth', 3);
      pixiAppRef.applyVisualParam('multiBadgeSize', 0.6);
      pixiAppRef.applyVisualParam('multiBadgeCorner', 12);
      // 1×1 wild lock backing — Crack Farm defaults (dark backdrop, no frame;
      // the frame/backdrop colours are now studio-adjustable, Noski).
      pixiAppRef.applyVisualParam('oneWildBackdrop', '#0b0d14');
      pixiAppRef.applyVisualParam('oneWildBackdropAlpha', 1);
      pixiAppRef.applyVisualParam('oneWildFrame', '#7ef23e');
      pixiAppRef.applyVisualParam('oneWildFrameWidth', 0);
      // FS-END TOTAL WIN outro: the artist's one-piece night-scene assembly
      // (TOTAL WIN + metal plate + press-to-continue), contain-fit; the
      // count-up amount sits ON the plate (measured centre 958,646).
      void pixiAppRef.setLayeredIntro('outro', [
        { file: `${CRACKFARM.base}outro/outro-screen.png`, role: 'card', cx: 960, cy: 540 },
      ]);
      pixiAppRef.setOutroAmountStyle(958, 646, 88);
      // TIERED FS intro screens (plant-less bg per scatter tier: 3sc/4sc/5sc =
      // 0×/8×/32× start). Three plants OPEN side by side on the field as the
      // intro appears (setFsIntroGrowSheet drives the grow, slower than in-reel).
      void pixiAppRef.setLayeredIntro('fs3', [{ file: `${cf}intro/fs_intro_3.png`, role: 'bg', cx: 960, cy: 540 }]);
      void pixiAppRef.setLayeredIntro('fs4', [{ file: `${cf}intro/fs_intro_4.png`, role: 'bg', cx: 960, cy: 540 }]);
      void pixiAppRef.setLayeredIntro('fs5', [{ file: `${cf}intro/fs_intro_5.png`, role: 'bg', cx: 960, cy: 540 }]);
      void pixiAppRef.setFsIntroGrowSheet(`${cf}wild_grow_sheet.png`, 6, 4, 24);
      const Tc = `${import.meta.env.BASE_URL}theme/win-tiers/`;
      void pixiAppRef.setWinCoinRain(
        [`${Tc}coinrain3_0.webp`, `${Tc}coinrain3_1.webp`, `${Tc}coinrain3_2.webp`], 10, 10, 300, 45,
      );
      // Layered game intro (each element is a full pre-positioned 1920×1080 frame).
      track(pixiAppRef.setLayeredIntro('game', crackFarmGameIntro()));
    } else if (activeGame === 'fruitstacks') {
      // ── FRUIT STACKS (6×5 scatter-pays tumbler, fruit-forest theme) ──────
      // Presentation rules (Noski): landing = SUBTLE knick only (no slam,
      // no cheap FX); wins pop apart and fresh symbols fall in (tumble) —
      // the cascade IS the show, so everything else stays calm.
      landingImpactConfig.enabled = true;
      landingImpactConfig.squashMul = 0.55;  // gentle knick, not a slam
      landingImpactConfig.thudAmp = 0;       // no board jolt
      waysImmersiveConfig.enabled = false;
      const fsSymbols = saved.symbols && Object.keys(saved.symbols).length
        ? new Map(Object.entries(saved.symbols).map(([k, v]) => [Number(k), v]))
        : fruitStacksSymbolMap();
      track(pixiAppRef.setUserAssetTextures(fsSymbols));
      track(pixiAppRef.setBackgroundImage(saved.bg ?? FRUITSTACKS.bgBase));
      track(pixiAppRef.setTitleImage(FRUITSTACKS.logo, 'left')); // BIG left-rail logo (reference construct)
      // Gold rounded frame around the grid (alpha window auto-detected).
      track(pixiAppRef.setFrameImage(saved.frame ?? FRUITSTACKS.frame));
      // Scatter (B-starfruit) + crate (multiplier) keep a clean static look —
      // no fallback pulse/squash warping the illustrated art.
      STATIC_LOOK_SYMBOLS.add(1);
      // FS-Trigger-Win: Noskis Bend (fs_bend_loop.mov) — spielt beim Trigger
      // EINMAL durch (kein Loop) in 30fps (~1.8s), dann FS-Transition.
      // contentScale 1.457: die Biege schwingt weit aus, die NEUTRALE Pose
      // füllt sonst nur ~48% des Frames (las sich geschrumpft).
      // contentScale = 1.457 (Union/Neutral-Pose) × 0.861 (sichtbarer Anteil
      // der Static-Textur, 441/512 px) = 1.254 → die neutrale Biege-Pose
      // liegt EXAKT auf dem sichtbaren FS, kein Padding-Versatz.
      void pixiAppRef.setSymbolWinSheet(1, `${FRUITSTACKS.base}scatter_win_sheet.webp`, 8, 7, 53, 118, { once: true, plays: 2, contentScale: 1.254, contentOffset: { x: 1.5, y: 9.5 } });
      NO_IDLE_SYMBOLS.add(0);
      // Winna-vermessene Groessen-Hierarchie (2026-07-23): normale Symbole
      // fuellen ~0.65-0.80 der Zelle (deutliche Luft), GIFTS premium-gross
      // (~1.12x der Symbole), der SCATTER klar GROESSER als alles (~1.5x der
      // Symbole, ragt ueber die Zelle hinaus wie das Winna-W 1.05x1.26).
      for (const id of [2, 3, 4, 5, 6, 7, 8, 9, 10]) SYMBOL_SIZE_MULS.set(id, 0.9);
      for (const id of [0, 11, 12, 13]) SYMBOL_SIZE_MULS.set(id, 1.0);
      // Scatter klar groesser als alles, aber die quadratischen FS-Lettern
      // wirkten bei 1.35 zu massig (Noski) — 1.18 haelt den Ueber-Zelle-Look.
      SYMBOL_SIZE_MULS.set(1, 1.18);
      // Frosted reel pane OFF: the warm forest scene would bleed through
      // transparent symbol corners as a milky veil (theme rule, skill §3).
      pixiAppRef.setReelFrosted(false);
      // Cluster look: no reel separators — symbols read as the frontmost
      // layer on the open board (Noski).
      pixiAppRef.setSeparatorsVisible(false);
      // Scatter (1.18×) ragt über die Zelle hinaus — Clip weit genug öffnen,
      // damit der Rahmen ihn NIE beschneidet (oben klein: Refill fällt
      // verdeckt über dem Grid rein).
      pixiAppRef.setReelClipMargin({ left: 46, top: 12, right: 46, bottom: 28 });
      // Fruit Stacks' OWN win rain: Noskis symbol-burst alpha-mov (2026-07-23).
      // HD-Bake: 120 native 30fps-Frames in ECHTEM 16:9 (800×450 pro Frame,
      // 5×4 pro Sheet) — die alte 320×320-Quetschung las sich als Pixelbrei.
      // Playback 45fps = 1,5× Tempo (Noski: "muss noch schneller sein").
      void pixiAppRef.setWinCoinRain(
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `${FRUITSTACKS.base}coinrain_fs_${i}.webp`), 5, 4, 200, 45,
      );
      // Win marquee: Noskis NEUES "BONUS (29)"-Pack (2026-07-24) — der
      // Marktstand (fruit box) ist die PLATE, die Tier-Lettern sind aus den
      // Komposits positionsvermessen auf den Canvas gebaked (die "only"-
      // Exporte kamen zentriert), win-Layer ist transparent (Lettern sind
      // komplett). Betrag sitzt auf der GOLD-PLAKETTE unten (cy 0.7431);
      // plateH bewusst größer als die physische Plakette, sonst ist die
      // Zahl auf Screen-Größe unlesbar (~11px).
      setWinTierGeometry({
        tierCy: { big: 0.1819, mega: 0.1606, epic: 0.1796, max: 0.187 },
        winCy: 0.5,
        plateCy: 0.7431,
        // Betrag PASST in die Gold-Plakette; Font = aufrechte Ballon-Schrift
        // (Baloo 2, wie Gift-Multis + Karten) statt kursivem Poppins (Noski:
        // "sieht komisch aus"), und nochmal einen Tick kleiner.
        plateH: 0.17,
        contentFrac: 0.836, // y[15..918] Lettern-Top bis Stand-Boden
        contentCy: 0.4319,
        sizeMul: 0.95,
        dimAlpha: 0.55,
        amountFont: "'Baloo 2', 'Rubik', ui-sans-serif, sans-serif",
        amountItalic: false,
      });
      const Fw = `${FRUITSTACKS.base}win-tiers/`;
      void pixiAppRef.setWinTierImages({
        big: `${Fw}big.webp`, mega: `${Fw}mega.webp`, epic: `${Fw}epic.webp`,
        max: `${Fw}max.webp`, win: `${Fw}win.webp`, plate: `${Fw}plate.webp`,
      });
      // FS-OUTRO: Marktstand + TOTAL-WIN-Lettern als ruhige Karten, der
      // Rundengewinn zählt auf der Gold-Plakette hoch (vermessen 959/802).
      void pixiAppRef.setLayeredIntro('outro', [
        // Basegame-Bokeh als Cover dahinter (Noski: "da ist alles schwarz")
        { file: FRUITSTACKS.bgBase, role: 'coverbg', cx: 960, cy: 540 },
        { file: `${Fw}plate.webp`, role: 'card', cx: 960, cy: 540 },
        { file: `${Fw}total.webp`, role: 'card', cx: 960, cy: 540 },
      ]);
      pixiAppRef.setOutroAmountStyle(959, 802, 64);
      // TOP WIN PLAQUE (reference construct): the price-area plate sits above
      // the grid; cascade wins tick into it and the gift ×N values fly to it.
      void pixiAppRef.setFruitPlaqueArt(`${FRUITSTACKS.base}plate_pill.png`);
      void pixiAppRef.setFruitPoolArt(`${FRUITSTACKS.base}pool_gift.png`);
      // 15er-Badge fürs FS-Intro; Retrigger = Noskis "+5 FREE SPINS"-Banner
      // (2026-07-24), Text ist im Art gebaked.
      void pixiAppRef.setFruitFsBadges(`${FRUITSTACKS.base}fs_badge_15.png`, `${FRUITSTACKS.base}retrigger_plus5.webp`);
      // Noskis gebakte ×N-Art (x2..x500) auf den Geschenken; die häufigen
      // Gewichtswerte werden sofort vorgewärmt, Rest lädt beim Runden-Decode.
      pixiAppRef.setFruitMultiArtBase(`${FRUITSTACKS.base}multis/`);
      pixiAppRef.prefetchFruitMultiArt([2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 50, 100, 250, 500]);
      // FS-Counter (Noskis Plakette): zählt die remaining Spins wie ein Rad
      // runter, Retrigger rollt hoch; oben an der rechten Rail.
      pixiAppRef.setFsCounterArtBase(`${FRUITSTACKS.base}fscounter/`);
      // Layered breathing GAME intro (Noski's "intro screen" pack, 2026-07-23).
      track(pixiAppRef.setLayeredIntro('game', fruitStacksGameIntro()));
      // Audio: NO sounds wired — none recorded for this game yet, and the
      // hard rule is silence over placeholders (skill §4).
    } else {
    const symbols = saved.symbols && Object.keys(saved.symbols).length
      ? new Map(Object.entries(saved.symbols).map(([k, v]) => [Number(k), v]))
      : viceSymbolMap();
    // Vice symbols 20% smaller (Noski 2026-07-22): defaults were mul 1 /
    // scatter 1.2 — whole set scaled down, scatter keeps its relative pop.
    for (const id of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) SYMBOL_SIZE_MULS.set(id, 0.8);
    SYMBOL_SIZE_MULS.set(1, 0.96);
    // NOSKIS VICE-MIX (repo-baked, src/data/viceSoundPreset.json): seeded as
    // the game's sound state whenever the user has no own picks stored —
    // survives every reload/reboot; Save Build/Export carry it as usual.
    {
      const savedSounds = loadAssets().sounds ?? {};
      if (Object.keys(savedSounds).length === 0) {
        const vsp = viceSoundPreset as { picks: Record<string, string>; volumes: Record<string, number> };
        for (const [ev, url] of Object.entries(vsp.picks)) {
          soundManager.replaceSource(ev, [`${import.meta.env.BASE_URL}${url}`], vsp.volumes[ev]);
        }
        for (const [ev, vol] of Object.entries(vsp.volumes)) soundManager.setEventVolume(ev, vol);
        soundManager.play('ambient-music');
      }
    }
    // Vice tease: NO landed-cell FX (burst/brackets/dim on the 1:1 field) —
    // only the pending-reel gold gate + rising embers stay (Noski 2026-07-22).
    teaseTuning.scatterLandedFx = false;
    // Win marquee +30% (Noski: "big win und feld runter 30% größer") — the
    // whole layer stack (tier art, WIN, number plate) scales together.
    setWinTierGeometry({ sizeMul: 0.48 * 1.3 });
    track(pixiAppRef.setUserAssetTextures(symbols));
    // Custom upload wins; otherwise the Vice MOTEL-BEACH base background —
    // static art paints instantly, then the LIVING loop takes over (45-frame
    // seamless spritesheet, cross-faded @6fps: ocean rolls, palms sway).
    const B = `${import.meta.env.BASE_URL}theme/vice/`;
    if (saved.bg) track(pixiAppRef.setBackgroundImage(saved.bg));
    else {
      track(pixiAppRef.setBackgroundImage(`${B}bg_motel.webp`));
      void pixiAppRef.setBackgroundSpritesheet(
        [`${B}bg_motel_anim_1.webp`, `${B}bg_motel_anim_2.webp`, `${B}bg_motel_anim_3.webp`],
        4, 4, 45, 6,
      );
    }
    // VICE HEAT logo above the grid (replaces the text title).
    track(pixiAppRef.setTitleImage(`${B}logo.webp`));
    // Symbol WIN animations: looped spritesheets on connection (7×7 = 48
    // frames @ 12fps each), color-matched to the static art. HIGH_A(2) =
    // shades guy, HIGH_B(3) = cigar boss, MID_C(4) = pink car, MID_D(5) =
    // money case (Koffer) bursting open. WILD has no sheet yet.
    void pixiAppRef.setSymbolWinSheet(2, `${B}prem_a_win.webp`, 7, 7, 48, 12);
    void pixiAppRef.setSymbolWinSheet(3, `${B}prem_b_win.webp`, 7, 7, 48, 12);
    void pixiAppRef.setSymbolWinSheet(4, `${B}car_win.webp`, 7, 7, 48, 12);
    void pixiAppRef.setSymbolWinSheet(5, `${B}koffer_win.webp`, 7, 7, 48, 12);
    // Scatter(1) NEW-badge animations: a looping IDLE sheet replaces the
    // static art on the board (10×9 = 90 frames @10fps, 9s seamless loop),
    // and the WIN sheet plays on the landed scatters at the FS trigger
    // (8×9 = 67 frames @15fps ≈ the 4.2s trigger beat). Clean: these two
    // sheets ARE the scatter's entire presentation.
    void pixiAppRef.setSymbolIdleSheet(1, `${B}scatteridle.webp`, 10, 9, 90, 10);
    void pixiAppRef.setSymbolWinSheet(1, `${B}scatterwin.webp`, 8, 9, 67, 15);
    // The scatter badge keeps a clean STATIC look on the reels: no landing
    // squash, no idle/featured warping (in-place scaling pixelates the art) —
    // the win sheet above is its only animation.
    STATIC_LOOK_SYMBOLS.add(1);
    // The 1:1 WILD keeps its hard landing slam but loses the fallback idle
    // breathing — a lone pulsing cell on a still board reads weird.
    NO_IDLE_SYMBOLS.add(0);
    // Expanding-wild column art (money tower; custom upload wins).
    // Expected art: 512×2560 px (5×5 grid) / 512×1484 px (5×3) — one reel's
    // aspect; setExpandingWildImage height-fits whichever grid is active.
    void pixiAppRef.setExpandingWildImage(saved.expandingWild ?? `${B}wild_column.webp`);
    // Custom neon frame (palm + marquee arrow). The window rect is the TRUE
    // transparent hole measured from the 1500² art's alpha — mapped onto the
    // frame bounds so the palm/arrow hang over the background, not the reels.
    // Custom uploads auto-detect their own window from alpha now.
    if (saved.frame) track(pixiAppRef.setFrameImage(saved.frame));
    else track(pixiAppRef.setFrameImage(`${B}frame_neon.webp`, { x: 197, y: 314, w: 832, h: 832 }));
    // Frame WIN flash: the palm marquee's bulb chase + arrow strobe (chroma-
    // matted one-shot sheet) fires when the 3rd scatter lands. Region = where
    // those frames sit inside the 1500² frame texture.
    void pixiAppRef.setFrameWinFlash(
      `${B}frame_win_flash_1.webp`, 8, 6, 48, 12, { x: 1025, y: 225, w: 475, h: 1062.5 },
    );
    // FS-only background: custom static upload wins; otherwise the LIVING
    // Vice BEACH-CLUB LOUNGE (v3: cabanas + tiki bar + disco ball —
    // 48-frame seamless spritesheet loop, cross-faded @6fps = full 8s take).
    if (saved.fsBg) void pixiAppRef.setFreeSpinsBackgroundImage(saved.fsBg);
    else void pixiAppRef.setFreeSpinsBackgroundSpritesheet(
      [`${B}fsbg_beachclub_anim_1.webp`, `${B}fsbg_beachclub_anim_2.webp`, `${B}fsbg_beachclub_anim_3.webp`],
      4, 4, 48, 6,
    );
    // Layered win-marquee art (BIG/MEGA/EPIC/MAX + WIN + number plate).
    const T = `${import.meta.env.BASE_URL}theme/win-tiers/`;
    void pixiAppRef.setWinTierImages({
      big: `${T}big.png`, mega: `${T}mega.png`, epic: `${T}epic.png`,
      max: `${T}max.png`, win: `${T}win.png`, plate: `${T}plate.png`,
    });
    // Custom coin rain v3 (green-screen keyed #00D300, TIGHT key sim 0.13 so
    // the gold bodies stay FULLY OPAQUE — yellow sits near green in chroma
    // space, a loose key made the coins semi-transparent; box-aspect crop →
    // ~1.42× upscale = sharp): 3 sheets × (10×10) = 300 frames @ 45fps.
    void pixiAppRef.setWinCoinRain(
      [`${T}coinrain3_0.webp`, `${T}coinrain3_1.webp`, `${T}coinrain3_2.webp`], 10, 10, 300, 45,
    );
    if (VICE_INTRO_URL) void pixiAppRef.setFreeSpinsIntroImage(VICE_INTRO_URL);
    // LAYERED intro screens — game start + tiered FS intros, every layer
    // breathing. The game intro shows once its layers are in; its dismiss
    // tap doubles as the audio gesture, so the music starts instantly.
    const mapSet = (arr: Array<{ file: string; role: string; cx: number; cy: number; tw?: number }>) =>
      arr.map(l => ({ file: `${import.meta.env.BASE_URL}${l.file}`, role: l.role, cx: l.cx, cy: l.cy, tw: l.tw }));
    void pixiAppRef.setLayeredIntro('fs3', mapSet(introLayers.fs3));
    void pixiAppRef.setLayeredIntro('fs4', mapSet(introLayers.fs4));
    // TOTAL WIN outro after the free-spins round (iris-bookended, 15s max).
    void pixiAppRef.setLayeredIntro('outro', mapSet(introLayers.outro));
    track(pixiAppRef.setLayeredIntro('game', mapSet(introLayers.game)));
    }
    // Theme is IN: hold 100% for a beat, fade the boot overlay — the intro's
    // iris-from-black entrance begins underneath, so the handoff is seamless.
    void Promise.all(bootJobs).then(() => {
      // Stored PARAMS-drawer overrides apply AFTER the theme wiring so the
      // theme can never clobber them — Save Build / builtin snapshots carry
      // them via slot:assets.visualParams (Noski: "parameter speichern sich
      // nicht bei save build").
      // Das Features-Tab/Effekt-System ist ENTFERNT — sein Store verschwindet
      // mit (loadAssets filtert die alten Effekt-Ids zusaetzlich beim Lesen).
      try { localStorage.removeItem('slot:feature-selection'); } catch { /* egal */ }
      for (const [pid, pval] of Object.entries(loadAssets().visualParams ?? {})) {
        pixiAppRef.applyVisualParam(pid, pval);
      }
      if (pixiAppRef.showGameIntro(() => setIntroOpen(false))) setIntroOpen(true);
      setBootProgress(1);
      setTimeout(() => setBootFade(true), 180);
      setTimeout(() => setBootGone(true), 180 + 650);
    });
  }, [pixiAppRef]);

  // Boot overlay node — rendered INSIDE the game-canvas container (like the
  // generator's iframe). Per-game customization point: title + colors.
  // Boot-Titel + Farben PRO GAME (Noski: "nicht bei jeder Slot VICE HEAT")
  const bootTheme = {
    vice: { title: 'VICE HEAT', grad: 'linear-gradient(180deg, #ff64c8 0%, #ffd23f 100%)', bar: 'linear-gradient(90deg, #ff64c8, #7de3ff)', glow: 'rgba(255,100,200,0.55)' },
    crackfarm: { title: 'CRACK FARM', grad: 'linear-gradient(180deg, #a6ff6e 0%, #ffd23f 100%)', bar: 'linear-gradient(90deg, #7ef23e, #ffd75e)', glow: 'rgba(126,242,62,0.55)' },
    fruitstacks: { title: 'FRUIT STACKS', grad: 'linear-gradient(180deg, #ff9ad0 0%, #ffd23f 100%)', bar: 'linear-gradient(90deg, #b06cf5, #ffd75e)', glow: 'rgba(176,108,245,0.55)' },
  }[loadActiveGame() as 'vice' | 'crackfarm' | 'fruitstacks'] ?? { title: 'LOADING', grad: 'linear-gradient(180deg, #fff 0%, #aaa 100%)', bar: 'linear-gradient(90deg, #888, #ccc)', glow: 'rgba(255,255,255,0.3)' };
  const bootScreen = bootGone ? null : (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 18, background: '#07070c',
      opacity: bootFade ? 0 : 1, transition: 'opacity 0.55s ease',
      pointerEvents: bootFade ? 'none' : 'auto',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    }}>
      <style>{'@keyframes boot-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }'}</style>
      <div style={{
        fontSize: 34, fontWeight: 900, fontStyle: 'italic', letterSpacing: 6,
        background: bootTheme.grad,
        WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        animation: 'boot-breathe 2.2s ease-in-out infinite',
      }}>{bootTheme.title}</div>
      <div style={{ width: 300, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.round(bootProgress * 100)}%`, height: '100%', borderRadius: 999,
          background: bootTheme.bar,
          boxShadow: `0 0 12px ${bootTheme.glow}`, transition: 'width 0.35s ease',
        }} />
      </div>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 5, color: 'rgba(255,255,255,0.35)',
        animation: 'boot-breathe 2.2s ease-in-out infinite',
      }}>LOADING</div>
    </div>
  );

  const handlePixiReady = useCallback((app: PixiApp) => {
    setPixiAppRef(app);
    // dev/studio debugging handle (harmless in prod)
    (window as unknown as { __pixi?: PixiApp }).__pixi = app;
  }, []);

  const {
    state,
    handleBetChange,
    handleSpin,
    handleBuyBonus,
    handleBuyFruit,
    handleBuyVice,
    handleSkip,
    handleAutoSpin,
    handleStopAuto,
    pixiApp,
  } = useGameState(hostApi, snapshot, pixiAppRef);

  // Sound layer (same wiring as the generator's App.tsx).
  const soundManager = useSoundLayer(state);

  // CRACK FARM sound pack: swap the drop/spin/land SFX to the wood-clatter
  // foley (rattly boards) so the theme sounds like the barn. Vice keeps the
  // default pack. Background MUSIC is left alone (Noski supplies that).
  useEffect(() => {
    if (loadActiveGame() !== 'crackfarm') return;
    const C = `${import.meta.env.BASE_URL}audio/crackfarm/`;
    // MIX BALANCE (measured reference, research/slot-feel/14 §6): in the top
    // slots the music + wins carry the mix and the per-event SFX sit well
    // under it — ours were shouting (Noski). Landing knock and symbol voices
    // are deliberately quiet here.
    soundManager.replaceSource('reel-stop', [`${C}reel-stop.ogg`], 0.3);
    // Per-symbol win voices (SymbolId → file). One fires per winning line.
    // CHARACTER symbols get their own voice: 0=plant/wild 2=cow 3=goat
    // 4=dog 5=sheep. Missing: 1 (crystal sack).
    for (const sym of [0, 2, 3, 4, 5]) {
      soundManager.replaceSource(`quip-${sym}`, [`${C}quip-${sym}.ogg`], 0.22);
    }
    // LOW symbols (6 carrot, 7 corn, 8 bucket) share ONE clean connection
    // sound — the studio convention: only premium symbols get a voice, the
    // low pays share a neutral hit so the mix stays uncluttered (Noski).
    for (const sym of [6, 7, 8]) {
      soundManager.replaceSource(`quip-${sym}`, [`${C}quip-low.ogg`], 0.22);
    }
    // ── ONLY NOSKI'S OWN SOUNDS PLAY ──────────────────────────────────────
    // Every synthesized/AI-ish sound of mine reads as wrong to him ("läuft
    // mir kalt über den Rücken") — third time confirmed. So all of them are
    // SILENCED here and stay silent until a real recording replaces them.
    // Silence beats a bad sound. Live right now: his music, reel rattle,
    // plank landing and the symbol voices. Everything below waits for a drop.
    soundManager.replaceSource('spin-start', [`${C}spin-start.ogg`], 0);
    soundManager.replaceSource('wild-land', [`${C}wild-land.ogg`], 0);
    for (const id of ['coin-chime', 'wild-expand', 'near-miss-tease', 'free-spin-trigger', 'tease-riser', 'tease-miss']) {
      soundManager.setEventVolume(id, 0);
    }
    // Crack Farm's own background music (Noski's "Sunny Farm Groove"), at a
    // relaxed resting volume so it sits gently under the SFX. Vice keeps its
    // synthwave track (default ambient-music.ogg).
    soundManager.replaceSource('ambient-music', [`${C}ambient-music.ogg`], 0.3);
    // Reel-spin bed: the wooden barn-wheel rattle (Noski) — re-enabled ONLY for
    // Crack Farm at a soft level so it sits under the drops. Vice keeps it muted.
    // Rattle plays ONCE (loop off) for exactly its 1.8s and ends there — a
    // second earlier than before (Noski). The first-reel fade still cuts it
    // short if the reels land sooner.
    soundManager.replaceSource('reel-spin-loop', [`${C}reel-spin-loop.ogg`], 0.24, false);
  }, [soundManager]);

  // FRUIT STACKS sound pack — the measured ULTRA-CLEAN preset is the
  // default mix (Noski AAA+ pass); every event swappable in the library.
  useEffect(() => {
    if (loadActiveGame() !== 'fruitstacks') return;
    for (const [eventId, def] of Object.entries(ULTRA_CLEAN.events)) {
      soundManager.replaceSource(eventId, [def.url], def.volume);
    }
    soundManager.replaceSource('reel-spin-loop', [`${import.meta.env.BASE_URL}audio/library/spin-start/air-woosh-985287.ogg`], 0, false);
  }, [soundManager]);

  // SOUND-LIBRARY picks (studio "Sound-Bibliothek"): a saved selection WINS
  // over the game pack's default source for that event — applied last, so a
  // build carries exactly the sounds Noski picked (and exports them). Runs
  // after the crackfarm effect above (hook order = declaration order).
  useEffect(() => {
    const picks = loadAssets().sounds ?? {};
    for (const [eventId, url] of Object.entries(picks)) {
      if (typeof url !== 'string' || !url) continue;
      // A muted-by-design event (volume 0 = "no approved sound yet") becomes
      // audible the moment Noski picks a library sound for it — the pick IS
      // the approval.
      const design = soundManager.getEventDefault(eventId);
      soundManager.replaceSource(eventId, [url], design > 0 ? undefined : 0.5);
    }
  }, [soundManager]);

  useEffect(() => {
    if (!pixiApp) return;
    // FS intro/iris covers the screen — hide the control bar like the game intro.
    pixiApp.onFsIntroVisible = setFsIntroOpen;
    pixiApp.onFsRoundActive = setFsRoundOn;
    // Marquee music rides the celebration exactly: starts with the slam-in,
    // fades out WITH the staggered exit (0.9s) or fast on a skip (0.26s) —
    // the track never outlasts the marquee. The ambient music DUCKS to
    // silence underneath (keeps running muted) and fades back in PARALLEL
    // to the marquee's exit — clean handoff, no restart.
    pixiApp.setMarqueeSoundHooks(
      () => {
        soundManager.duck('ambient-music', 300);
        soundManager.play('win-marquee');
      },
      smooth => {
        soundManager.fadeStop('win-marquee', smooth ? 900 : 260);
        soundManager.unduck('ambient-music', smooth ? 700 : 400);
      },
    );
    // TALLY audio (research/slot-feel/05-sound-design): coin ticks on the
    // count-up grid stepping UP the scale with progress, the terminator hit
    // when the number lands (or on skip), and a tier-slam pitched per tier.
    const SCALE = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2]; // major scale steps (in key)
    pixiApp.setTallySoundHooks(
      progress => {
        const step = SCALE[Math.min(SCALE.length - 1, Math.floor(progress * SCALE.length))];
        soundManager.play('win-tally-tick', { rate: step * (0.99 + Math.random() * 0.02) });
      },
      () => soundManager.play('win-tally-end'),
      tier => soundManager.play('tier-up', { rate: Math.pow(2, (2 * tier) / 12) }),
    );
    // AUDIO ROLLBACK (Noski: "audio fatal"): back to the last APPROVED state —
    // flat wood-clatter stops, plain stingers, no pitch ladders, no riser/duck.
    // The rate-ladder + riser SPECS stay in research/slot-feel/05 and get
    // re-enabled only with REAL sound-design drops (synthesis reads wrong).
    pixiApp.setAudioHooks({
      onReelStopped: (idx) => {
        soundManager.play('reel-stop');
        // The rattle fades out the moment the FIRST reel drops in (Noski) —
        // it rides out over the remaining staggered stops instead of running
        // to the end of the spin.
        if (idx === 0) soundManager.fadeStop('reel-spin-loop', 450);
      },
      // Safety net: if reel 0 never reported, kill the rattle once every reel
      // has landed.
      onAllReelsStopped: () => soundManager.fadeStop('reel-spin-loop', 90),
      // Classic scatter DING ladder: each scatter of one landing sequence
      // rings a step higher (time-based reset — works across spin + tumble).
      onScatterLanded: (() => {
        let n = 0; let last = 0;
        return () => {
          const now = performance.now();
          if (now - last > 4000) n = 0;
          last = now;
          soundManager.play('scatter-land', { rate: 1 + Math.min(n, 3) * 0.14 });
          n++;
        };
      })(),
      onWinJingle: tier => soundManager.play(`win-${tier}`),
      onWildLanded: () => soundManager.play('wild-land'),
      onWildExpand: () => soundManager.play('wild-expand'),
      onNearMissTease: () => soundManager.play('near-miss-tease'),
      // TEASE audio arc (Noski): riser bed in + music ducks while the gates
      // arm; the resolve CUTS the riser — hit = the FS-TRIGGER stinger the
      // moment the last reel stops with the scatters landed, miss = dull tap.
      onTeaseStart: () => {
        soundManager.duck('ambient-music', 350);
        soundManager.play('tease-riser');
      },
      onTeaseEnd: hit => {
        soundManager.fadeStop('tease-riser', hit ? 120 : 60);
        soundManager.unduck('ambient-music', 500);
        soundManager.play(hit ? 'free-spin-trigger' : 'tease-miss');
      },
      // Fruit Stacks tumble: the burst-plopp ladders up per cascade step;
      // gift flights whoosh softly and the ×N thuds into the plate.
      onTumblePop: (stepIdx) => soundManager.play('coin-chime', { rate: 1 + Math.min(stepIdx, 6) * 0.08 }),
      // Eigene Multi-Events (Noski): getrennt regelbar in Sound-Parametern +
      // Audio Studio. Frueher Alias auf wild-expand/wild-land.
      onGiftFly: () => soundManager.play('multi-fly'),
      onPlateImpact: () => soundManager.play('multi-collect'),
      onMultiApply: () => soundManager.play('multi-apply'),
      // Rising tally: each connection's chime pitches a step higher — the
      // classic count-up ladder instead of a flat repeated tick.
      // PER-SYMBOL win voice on Crack Farm: the symbol that won speaks (goat
      // bleat, cow moo, corn pop). Falls back to the chime while a voice file
      // is still missing, and Vice keeps the chime ladder.
      onWinStep: (index, _total, symbolId) => {
        if (loadActiveGame() === 'crackfarm') {
          // Crack Farm: ONLY the real per-symbol voices. A symbol without a
          // voice yet stays SILENT — the synthesized chime fallback read as
          // wrong (Noski), and silence is better than a bad sound.
          const id = `quip-${symbolId}`;
          if (symbolId !== undefined && soundManager.hasLoaded(id)) {
            // ONE voice at a time: the previous line's symbol is cut short
            // (quick fade, no click) the moment the next line takes over, so
            // each voice belongs to exactly the line being shown — never a
            // pile-up when lines run at the fast 380ms cadence.
            if (lastQuipRef.current) soundManager.fadeStop(lastQuipRef.current, 60);
            soundManager.play(id);
            lastQuipRef.current = id;
            return;
          }
        }
        soundManager.play('coin-chime', { rate: 1 + Math.min(index, 8) * 0.09 });
      },
    });
  }, [pixiApp, soundManager]);

  useEffect(() => {
    if (pixiApp) pixiApp.turbo = turbo;
  }, [pixiApp, turbo]);

  const handleTurboToggle = useCallback(() => setTurbo(prev => !prev), []);

  // Studio-wide notice toast (all games): fired via CustomEvent 'slot:notice',
  // e.g. NOT ENOUGH FUNDS from the useGameState wager/cost guards.
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const on = (e: Event) => {
      setNotice(String((e as CustomEvent).detail || ''));
      if (t) clearTimeout(t);
      t = setTimeout(() => setNotice(null), 2200);
    };
    window.addEventListener('slot:notice', on);
    return () => { window.removeEventListener('slot:notice', on); if (t) clearTimeout(t); };
  }, []);
  const noticeToast = notice ? (
    <div style={{
      position: 'absolute', top: '13%', left: '50%', transform: 'translateX(-50%)', zIndex: 90,
      padding: '10px 24px', borderRadius: 14, border: '2px solid #f7b733',
      background: 'linear-gradient(180deg, #3a0d12 0%, #22060a 100%)', color: '#ffe9a8',
      fontWeight: 900, fontStyle: 'italic', letterSpacing: 1.2, fontSize: 16,
      fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
      boxShadow: '0 6px 24px rgba(0,0,0,0.6)', pointerEvents: 'none', whiteSpace: 'nowrap',
    }}>{notice}</div>
  ) : null;

  // ── AUDIO-STUDIO-Seite (#audio) — die 2. Page. Navigation macht einen
  // FULL RELOAD (BuildDock-Button + onBack), damit nie Studio-Pixi und
  // iframe-Pixi gleichzeitig leben; bei #audio bootet das Studio gar nicht
  // erst (GameCanvas wird nie gemountet, die Slot läuft NUR im iframe). ──
  const [audioPage, setAudioPage] = useState(() => window.location.hash === '#audio');
  useEffect(() => {
    const on = () => {
      const want = window.location.hash === '#audio';
      if (want !== audioPage) window.location.reload();
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, [audioPage]);
  void setAudioPage; // state nur beim Boot gelesen; Wechsel = reload

  // EMBED-Sync: Änderungen aus dem Audio Studio (Parent-Frame) kommen als
  // storage-Events an — Picks live umbinden, Volumes + Clean-Params neu laden.
  useEffect(() => {
    if (!EMBED) return;
    const sm = getSharedSoundManager();
    const on = (e: StorageEvent) => {
      if (e.key === 'slot:assets') {
        const sounds = (loadAssets().sounds ?? {}) as Record<string, string>;
        for (const [ev, url] of Object.entries(sounds)) sm.replaceSource(ev, [url]);
      } else if (e.key === 'slot:audio-event-volumes') {
        sm.reloadEventOverrides();
      } else if (e.key === 'slot:audio-clean') {
        reloadCleanParams();
      }
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  if (audioPage && !EMBED) {
    return (
      <AudioStudioPage
        onBack={() => { window.location.hash = ''; window.location.reload(); }}
        iframeSrc={`${window.location.pathname}?embed=1`}
        onExport={() => downloadExport('audio-build')}
      />
    );
  }

  if (!hostApi || !snapshot) {
    return (
      <div className="flex items-center justify-center h-full w-full font-[var(--font-body)] text-[14px] text-[var(--color-text-secondary)] gap-2">
        <span>Starting preview…</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar
        gameState={state}
        snapshot={snapshot}
        onBetChange={handleBetChange}
        onSpin={() => { uiSfx.spin(); void handleSpin(); }}
        onSkip={handleSkip}
        onAutoSpin={handleAutoSpin}
        onStopAuto={handleStopAuto}
        onBuyBonus={handleBuyBonus}
        turbo={turbo}
        onTurboToggle={handleTurboToggle}
        soundManager={soundManager}
        pixiApp={pixiAppRef}
      />
      <GameCanvas
        lastOutcome={state.lastOutcome}
        phase={state.phase}
        onPixiReady={handlePixiReady}
        config={gameConfig}
        bootScreen={bootScreen}
        device={device}
        topBar={EMBED ? undefined : <BuildTopBar device={device} onDevice={setDevice} />}
        bottomDock={EMBED ? undefined : <BuildSlots />}
        gameOverlay={<>
          {noticeToast}
          {/* BUY-Rails erst MIT der Slot sichtbar (Noski: der Button stand
              schon über dem Loading + Intro): erst ab bootGone gerendert und
              wie die Controls weich eingeblendet statt hart gemountet. */}
          {bootGone && (
          <div style={{ opacity: introOpen || fsIntroOpen ? 0 : 1, pointerEvents: introOpen || fsIntroOpen ? 'none' : 'auto', transition: 'opacity 0.6s ease' }}>
          {loadActiveGame() === 'crackfarm'
              ? <BonusBuyOverlay betDisplay={state.betDisplay} onBuy={(id, kind) => {
                  // BUY tiers → trigger the bonus session (FS). ACTIVATE tiers are
                  // persistent bet-enhancer modes (toggled in the overlay); the
                  // per-spin mechanics wire up with the certified plant/ante math.
                  if (kind === 'buy') handleBuyBonus();
                }} />
              : loadActiveGame() === 'fruitstacks'
                ? <FruitBuyRail betDisplay={state.betDisplay} bonusActive={fsRoundOn} onBuy={stage => { void handleBuyFruit(stage); }} />
                : (gameConfig as { viceBuyStages?: ViceBuyStageDef[] }).viceBuyStages
                  ? <ViceBuyRail
                      betDisplay={state.betDisplay}
                      stages={(gameConfig as { viceBuyStages?: ViceBuyStageDef[] }).viceBuyStages!}
                      anteCostMult={(gameConfig as { anteBet?: { costMult: number } }).anteBet?.costMult}
                      onBuy={stage => { void handleBuyVice(stage); }}
                    />
                  : null}
          </div>
          )}
        </>}
        controls={
          <div style={{ opacity: introOpen || fsIntroOpen ? 0 : 1, pointerEvents: introOpen || fsIntroOpen ? 'none' : 'auto', transition: 'opacity 0.6s ease' }}>
            <ControlBar
              gameState={state}
              snapshot={snapshot}
              onBetChange={handleBetChange}
              onSpin={() => { uiSfx.spin(); void handleSpin(); }}
              onSkip={handleSkip}
              onAutoSpin={handleAutoSpin}
              onStopAuto={handleStopAuto}
              onBuyBonus={handleBuyBonus}
              turbo={turbo}
              onTurboToggle={handleTurboToggle}
              soundManager={soundManager}
            />
          </div>
        }
      />

      {!EMBED && <StudioDrawer pixiApp={pixiAppRef} />}
      {!EMBED && <PresetDock grid={gameConfig.gridConfig.visibleRows === 3 ? '5x3' : '5x5'} onGrid={handleGridChange} />}
    </div>
  );
}
