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
import { StudioDrawer } from '@/studio/StudioDrawer';
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/engine/GameConfig';
import { getThemeByName } from '@/config/themes';
import type { PixiApp } from '@/game/PixiApp';

export function App() {
  const [hostApi, setHostApi] = useState<HostApiV1 | null>(null);
  const [snapshot, setSnapshot] = useState<HostSnapshotV1 | null>(null);
  const [pixiAppRef, setPixiAppRef] = useState<PixiApp | null>(null);
  const [turbo, setTurbo] = useState(false);

  // The loaded game = the stamped Fantasy spec (config/reels+paytable+gameConfig
  // are the ZIP's generated files, so DEFAULT_GAME_CONFIG IS the Fantasy math)
  // with the generator's Fantasy theme applied — same as a deployed build.
  const gameConfig = useMemo<GameConfig>(
    () => ({ ...DEFAULT_GAME_CONFIG, theme: getThemeByName('Fantasy') }),
    [],
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
      />

      <StudioDrawer pixiApp={pixiAppRef} />
    </div>
  );
}
