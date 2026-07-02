// GameCanvas — mounts the PixiJS Application onto a canvas element.
import { useEffect, useRef, useState } from 'react';
import { PixiApp } from '@/game/PixiApp';
import type { SpinOutcome } from '@/engine/SlotEngine';
import type { GameConfig } from '@/engine/GameConfig';
import type { GamePhase } from '@/state/types';

interface Props {
  lastOutcome: SpinOutcome | null;
  phase: GamePhase;
  onPixiReady: (app: PixiApp) => void;
  /** Optional per-game config (theme override etc.). Defaults to
   *  DEFAULT_GAME_CONFIG inside PixiApp — same pattern as the wizard's
   *  PixiPreviewPanel. */
  config?: GameConfig;
}

export function GameCanvas({ lastOutcome, phase, onPixiReady, config }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<PixiApp | null>(null);
  const lastOutcomeRef = useRef(lastOutcome);
  lastOutcomeRef.current = lastOutcome;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // PixiApp handles StrictMode's mount → cleanup → mount cycle internally:
    // init() yields a microtask before claiming the canvas, then bails if
    // destroy() ran during the yield. So creating one PixiApp per mount is
    // correct — the first mount's PixiApp aborts cleanly and the second
    // mount's PixiApp claims the canvas successfully.
    const pixiApp = config ? new PixiApp(config, config.gridConfig) : new PixiApp();
    appRef.current = pixiApp;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    pixiApp.init(canvasRef.current).then(() => {
      if (cancelled) return;
      onPixiReady(pixiApp);
      // Sync the renderer buffer to the parent size, then keep it synced.
      // Pixi's built-in `resizeTo` uses a ResizeObserver that only fires on
      // *changes* — so it misses the initial layout when the parent was
      // already at its final size before Pixi attached.
      pixiApp.resize();
      const parent = canvasRef.current?.parentElement;
      if (parent) {
        resizeObserver = new ResizeObserver(() => pixiApp.resize());
        resizeObserver.observe(parent);
      }
      if (lastOutcomeRef.current) pixiApp.snapToOutcome(lastOutcomeRef.current);
    }).catch(err => {
      if (cancelled) return;
      console.error('[PixiApp] Init failed:', err);
      setError('WebGL not supported in this browser.');
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      appRef.current = null;
      pixiApp.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  return (
    <div className="flex-1 relative overflow-hidden bg-[var(--color-bg)]">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center font-[var(--font-body)] text-[14px] text-[var(--color-red)]">
          {error}
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ background: '#0D1117' }}
        />
      )}

      {lastOutcome?.freeSpinsTriggered && (phase === 'settled_win' || phase === 'settled_loss') && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-[linear-gradient(135deg,var(--color-yellow)_0%,#e6e854_100%)] rounded-[var(--radius-pill)] px-8 py-2 pointer-events-none shadow-[var(--shadow-glow-yellow),var(--shadow-md)]">
          <span className="font-[var(--font-display)] text-[16px] font-extrabold italic text-black tracking-[0.08em]">
            FREE SPINS x{lastOutcome.freeSpinsPlayed}
          </span>
        </div>
      )}
    </div>
  );
}
