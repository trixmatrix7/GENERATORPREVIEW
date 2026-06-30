// ui/StageCanvas.tsx — mounts the Pixi renderer, owns the SoundManager, and
// pushes config changes from the persisted store into the renderer.

import { useEffect, useRef } from 'react';
import { PixiApp, type RenderConfig } from '../game/PixiApp';
import { SoundManager } from '../audio/SoundManager';
import { controller } from '../game/controller';
import { useStudio } from '../store/useStudio';
import { useRuntime } from '../store/useRuntime';
import { useDerivedConfig } from '../store/derive';

export function StageCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PixiApp | null>(null);
  const soundRef = useRef<SoundManager>(new SoundManager());
  const initedRef = useRef(false);

  const grid = useStudio((s) => s.grid);
  const themeId = useStudio((s) => s.themeId);
  const working = useStudio((s) => s.working);
  const muted = useStudio((s) => s.muted);
  const volume = useStudio((s) => s.volume);
  const { registries, theme, symbolMeta, params } = useDerivedConfig();

  // init once
  useEffect(() => {
    if (initedRef.current || !hostRef.current) return;
    initedRef.current = true;
    const app = new PixiApp();
    appRef.current = app;
    controller.setApp(app);
    const cfg: RenderConfig = {
      grid: useStudio.getState().grid,
      theme,
      symbolMeta,
      preset: useStudio.getState().working,
      params,
      registries,
      sound: soundRef.current,
      onWinUpdate: (x) => useRuntime.getState().setWin(x),
      onPhase: (p) => useRuntime.getState().setPhase(p),
    };
    void app.init(hostRef.current, cfg);
    return () => {
      controller.setApp(null);
      app.destroy();
      appRef.current = null;
      initedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push config updates
  useEffect(() => {
    appRef.current?.setConfig({ grid, theme, symbolMeta, preset: working, params, registries });
  }, [grid, theme, symbolMeta, working, params, registries]);

  // audio
  useEffect(() => {
    soundRef.current.setMuted(muted);
    soundRef.current.setVolume(volume);
  }, [muted, volume]);

  const unlock = () => soundRef.current.unlock();

  return <div className="stage-canvas" ref={hostRef} onPointerDown={unlock} />;
}
