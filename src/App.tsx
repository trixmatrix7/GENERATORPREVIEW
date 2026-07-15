// App — the preview studio: the dev generator's harness (MockHost + Sidebar +
// GameCanvas + WinTierTestPanel) running the Fantasy spec 1:1, plus the studio
// drawer for overlay features (background swap, adjustable params, code
// paste/export). Mirrors src/dev/HarnessApp.tsx from the generator repo.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MockHost } from '@/dev/mockHost';
import type { HostApiV1, HostSnapshotV1 } from '@/bridge/types';
import { useGameState } from '@/hooks/useGameState';
import { useSoundLayer } from '@/audio/useSoundLayer';
import { Sidebar } from '@/ui/Sidebar';
import { GameCanvas } from '@/ui/GameCanvas';
import { ControlBar } from '@/ui/ControlBar';
import { StudioDrawer } from '@/studio/StudioDrawer';
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/engine/GameConfig';
import { GRID_5x3, GRID_5x5 } from '@/config/gridConfig';
import { PresetDock, loadGridId, type GridId } from '@/dev/PresetDock';
import { mathProfileById, loadMathProfileId, saveMathProfileId } from '@/config/mathProfiles';
import { getThemeByName } from '@/config/themes';
import { viceSymbolMap, VICE_INTRO_URL } from '@/config/viceAssets';
import introLayers from '@/data/introLayers.json';
import { loadAssets } from '@/studio/assetPersistence';
import type { PixiApp } from '@/game/PixiApp';

export function App() {
  const [hostApi, setHostApi] = useState<HostApiV1 | null>(null);
  const [snapshot, setSnapshot] = useState<HostSnapshotV1 | null>(null);
  const [pixiAppRef, setPixiAppRef] = useState<PixiApp | null>(null);
  const [turbo, setTurbo] = useState(false);
  // While the game intro screen is up, the control bar stays hidden and
  // fades in smoothly once the player taps through.
  const [introOpen, setIntroOpen] = useState(false);

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
      gridConfig: gridId === '5x3' ? GRID_5x3 : GRID_5x5,
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
    // Dev-only debug handle (console/tooling): drive presentation APIs directly.
    if (import.meta.env.DEV && pixiAppRef) {
      (window as unknown as { __pixi?: PixiApp }).__pixi = pixiAppRef;
    }
  }, [pixiAppRef]);

  // Baked asset pack: on mount, apply the user's persisted swaps if any, else
  // the baked "Vice" symbol art (public/theme/vice/) — so assets survive every
  // deploy/reload and stay until the user swaps them in the Assets tab.
  useEffect(() => {
    if (!pixiAppRef) return;
    const saved = loadAssets();
    const symbols = saved.symbols && Object.keys(saved.symbols).length
      ? new Map(Object.entries(saved.symbols).map(([k, v]) => [Number(k), v]))
      : viceSymbolMap();
    void pixiAppRef.setUserAssetTextures(symbols);
    // Custom upload wins; otherwise the Vice MOTEL-BEACH base background —
    // static art paints instantly, then the LIVING loop takes over (45-frame
    // seamless spritesheet, cross-faded @6fps: ocean rolls, palms sway).
    const B = `${import.meta.env.BASE_URL}theme/vice/`;
    if (saved.bg) void pixiAppRef.setBackgroundImage(saved.bg);
    else {
      void pixiAppRef.setBackgroundImage(`${B}bg_motel.webp`);
      void pixiAppRef.setBackgroundSpritesheet(
        [`${B}bg_motel_anim_1.webp`, `${B}bg_motel_anim_2.webp`, `${B}bg_motel_anim_3.webp`],
        4, 4, 45, 6,
      );
    }
    // VICE HEAT logo above the grid (replaces the text title).
    void pixiAppRef.setTitleImage(`${B}logo.webp`);
    // Symbol WIN animations: looped spritesheets on connection (7×7 = 48
    // frames @ 12fps each), color-matched to the static art. HIGH_A(2) =
    // shades guy, HIGH_B(3) = cigar boss, MID_C(4) = pink car, MID_D(5) =
    // money case (Koffer) bursting open. WILD has no sheet yet.
    void pixiAppRef.setSymbolWinSheet(2, `${B}prem_a_win.webp`, 7, 7, 48, 12);
    void pixiAppRef.setSymbolWinSheet(3, `${B}prem_b_win.webp`, 7, 7, 48, 12);
    void pixiAppRef.setSymbolWinSheet(4, `${B}car_win.webp`, 7, 7, 48, 12);
    void pixiAppRef.setSymbolWinSheet(5, `${B}koffer_win.webp`, 7, 7, 48, 12);
    // Scatter(1) BONUS animation — plays on the landed scatters at the FS
    // trigger (the iris cuts in just before it ends). 8×10 = 74 frames @ 15fps.
    void pixiAppRef.setSymbolWinSheet(1, `${B}scatterwin.webp`, 8, 10, 74, 15);
    // Expanding-wild column art (money tower; custom upload wins).
    // Expected art: 512×2560 px (5×5 grid) / 512×1484 px (5×3) — one reel's
    // aspect; setExpandingWildImage height-fits whichever grid is active.
    void pixiAppRef.setExpandingWildImage(saved.expandingWild ?? `${B}wild_column.webp`);
    // Custom neon frame (palm + marquee arrow). The window rect is the TRUE
    // transparent hole measured from the 1500² art's alpha — mapped onto the
    // frame bounds so the palm/arrow hang over the background, not the reels.
    // Custom uploads auto-detect their own window from alpha now.
    if (saved.frame) void pixiAppRef.setFrameImage(saved.frame);
    else void pixiAppRef.setFrameImage(`${B}frame_neon.webp`, { x: 197, y: 314, w: 832, h: 832 });
    // Frame WIN flash: the palm marquee's bulb chase + arrow strobe (chroma-
    // matted one-shot sheet) fires when the 3rd scatter lands. Region = where
    // those frames sit inside the 1500² frame texture.
    void pixiAppRef.setFrameWinFlash(
      `${B}frame_win_flash_1.webp`, 8, 6, 48, 12, { x: 1025, y: 225, w: 475, h: 1062.5 },
    );
    // FS-only background: custom static upload wins; otherwise the LIVING
    // Vice BEACH-CLUB scene (disco ball rays, torch flames, dancing crowd —
    // 45-frame seamless spritesheet loop, cross-faded @6fps).
    if (saved.fsBg) void pixiAppRef.setFreeSpinsBackgroundImage(saved.fsBg);
    else void pixiAppRef.setFreeSpinsBackgroundSpritesheet(
      [`${B}fsbg_beachclub_anim_1.webp`, `${B}fsbg_beachclub_anim_2.webp`, `${B}fsbg_beachclub_anim_3.webp`],
      4, 4, 45, 6,
    );
    // Vice dancer: ONLY the blonde, right of the grid, dancing through the
    // FS round (8×12 = 96 frames, 224×398, seamless loop — the source video
    // wraps without a trailing hold) at 18fps = 1.5× speed.
    void pixiAppRef.setFreeSpinsDancers([`${B}dancer_pink.webp`], 8, 12, 96, 18);
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
    void pixiAppRef.setLayeredIntro('game', mapSet(introLayers.game)).then(() => {
      if (pixiAppRef.showGameIntro(() => setIntroOpen(false))) setIntroOpen(true);
    });
  }, [pixiAppRef]);

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
    handleSkip,
    handleAutoSpin,
    handleStopAuto,
    pixiApp,
  } = useGameState(hostApi, snapshot, pixiAppRef);

  // Sound layer (same wiring as the generator's App.tsx).
  const soundManager = useSoundLayer(state);

  useEffect(() => {
    if (!pixiApp) return;
    pixiApp.setAudioHooks({
      onReelStopped: () => soundManager.play('reel-stop'),
      onScatterLanded: () => soundManager.play('scatter-land'),
      onNearMissTease: () => soundManager.play('near-miss-tease'),
      // Rising tally: each connection's chime pitches a step higher — the
      // classic count-up ladder instead of a flat repeated tick.
      onWinStep: (index) => soundManager.play('coin-chime', { rate: 1 + Math.min(index, 8) * 0.09 }),
    });
  }, [pixiApp, soundManager]);

  useEffect(() => {
    if (pixiApp) pixiApp.turbo = turbo;
  }, [pixiApp, turbo]);

  const handleTurboToggle = useCallback(() => setTurbo(prev => !prev), []);

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
        onSpin={handleSpin}
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
        controls={
          <div style={{ opacity: introOpen ? 0 : 1, pointerEvents: introOpen ? 'none' : 'auto', transition: 'opacity 0.6s ease' }}>
            <ControlBar
              gameState={state}
              snapshot={snapshot}
              onBetChange={handleBetChange}
              onSpin={handleSpin}
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

      <StudioDrawer pixiApp={pixiAppRef} />
      <PresetDock grid={gameConfig.gridConfig.visibleRows === 3 ? '5x3' : '5x5'} onGrid={handleGridChange} />
    </div>
  );
}
