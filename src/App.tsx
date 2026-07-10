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
import { getThemeByName } from '@/config/themes';
import { viceSymbolMap, VICE_INTRO_URL } from '@/config/viceAssets';
import { loadAssets } from '@/studio/assetPersistence';
import type { PixiApp } from '@/game/PixiApp';

export function App() {
  const [hostApi, setHostApi] = useState<HostApiV1 | null>(null);
  const [snapshot, setSnapshot] = useState<HostSnapshotV1 | null>(null);
  const [pixiAppRef, setPixiAppRef] = useState<PixiApp | null>(null);
  const [turbo, setTurbo] = useState(false);

  // The loaded game = the stamped Fantasy spec (config/reels+paytable+gameConfig
  // are the ZIP's generated files, so DEFAULT_GAME_CONFIG IS the Fantasy math)
  // with the generator's Fantasy theme applied — same as a deployed build.
  // Active grid (5×5 default = the Fantasy spec; 5×3 = the generator's classic
  // 3-row grid). Switching remounts GameCanvas/PixiApp with the same math —
  // the evaluator + all visuals derive from gridConfig.
  const [gridId] = useState<GridId>(loadGridId);
  const handleGridChange = useCallback((g: GridId) => {
    // Persist + clean reload (same pattern as preset apply): a live remount
    // while multi-MB sheets are still loading can leave a white canvas.
    localStorage.setItem('studio-grid', g);
    window.location.reload();
  }, []);

  const gameConfig = useMemo<GameConfig>(
    () => ({
      ...DEFAULT_GAME_CONFIG,
      gridConfig: gridId === '5x3' ? GRID_5x3 : GRID_5x5,
      theme: getThemeByName('Fantasy'),
    }),
    [gridId],
  );

  useEffect(() => {
    const mock = new MockHost(snap => setSnapshot(snap));
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
    const saved = loadAssets();
    const symbols = saved.symbols && Object.keys(saved.symbols).length
      ? new Map(Object.entries(saved.symbols).map(([k, v]) => [Number(k), v]))
      : viceSymbolMap();
    void pixiAppRef.setUserAssetTextures(symbols);
    // Custom upload wins; otherwise the animated Vice spritesheet background
    // (Ocean-Drive night loop): ONE sheet × (8×8) = 60 frames @ 12fps, 800×824
    // box-aspect crop + ticker cross-fade = fluid at a lean 4.7MB.
    const B = `${import.meta.env.BASE_URL}theme/vice/`;
    if (saved.bg) void pixiAppRef.setBackgroundImage(saved.bg);
    else void pixiAppRef.setBackgroundSpritesheet(`${B}bg_sheet2.webp`, 8, 8, 60, 12);
    // VICE HEAT logo above the grid (replaces the text title).
    void pixiAppRef.setTitleImage(`${B}logo.webp`);
    // Expanding-wild column art (money tower; custom upload wins).
    // Expected art: 512×2560 px (5×5 grid) / 512×1484 px (5×3) — one reel's
    // aspect; setExpandingWildImage height-fits whichever grid is active.
    void pixiAppRef.setExpandingWildImage(saved.expandingWild ?? `${B}wild_column.webp`);
    if (saved.frame) void pixiAppRef.setFrameImage(saved.frame);
    if (saved.fsBg) void pixiAppRef.setFreeSpinsBackgroundImage(saved.fsBg);
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
      onWinStep: () => soundManager.play('coin-chime'),
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
        }
      />

      <StudioDrawer pixiApp={pixiAppRef} />
      <PresetDock grid={gridId} onGrid={handleGridChange} />
    </div>
  );
}
