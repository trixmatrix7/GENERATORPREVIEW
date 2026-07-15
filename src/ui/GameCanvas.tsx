// GameCanvas — mounts the PixiJS Application onto a canvas element.
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  /** Bottom control bar rendered INSIDE the bounded game box, under the
   *  canvas (chaingames control-bar preset — a DOM layer, not canvas). */
  controls?: ReactNode;
  /** Boot loading overlay rendered INSIDE the game box (the generator shows
   *  it in the game iframe — never over the studio UI). */
  bootScreen?: ReactNode;
  /** Build management bar ABOVE the game box (save/new/export). */
  topBar?: ReactNode;
  /** Build slot dock BELOW the game box, centred. */
  bottomDock?: ReactNode;
}

export function GameCanvas({ lastOutcome, phase, onPixiReady, config, controls, bootScreen, topBar, bottomDock }: Props) {
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
      // NOTE: no bottomHudFraction reserve — the grid keeps its full-box
      // centring/size and the control bar simply layers over the canvas
      // bottom (its gradient top is transparent, so nothing is hidden).
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

  // Bounded game box — 1:1 the generator's preview shell:
  //   GeneratorStudio.tsx  → centre column `mx-auto max-w-[960px] p-6`
  //   PixiPreviewPanel.tsx → `rounded-xl overflow-hidden border border-white/[0.06]`
  //                          + canvas holder aspectRatio 5/5.15 (5-row grid,
  //                          else 5/3.4), maxHeight 60vh, bg #0D1117.
  // PixiApp.onResize() scales-to-fit, so the height-capped box letterboxes
  // the sides — never clips the grid.
  const rows = config?.gridConfig.visibleRows ?? 3;

  return (
    <div className="flex-1 relative overflow-hidden bg-[var(--color-bg)] flex items-center justify-center">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center font-[var(--font-body)] text-[14px] text-[var(--color-red)]">
          {error}
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[960px] p-6">
          {topBar}
          <div
            className="slot-preview-root relative rounded-xl overflow-hidden border border-white/[0.06]"
            style={{ background: '#0D1117' }}
          >
            <div
              className="relative mx-auto w-full"
              style={{
                aspectRatio: rows === 5 ? '5 / 5.15' : '5 / 3.4',
                maxHeight: '60vh',
                background: '#0D1117',
              }}
            >
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ background: '#0D1117' }}
              />
              {/* Control bar overlays the canvas bottom — its gradient fades
                  from #111 up INTO the slot (like the original game HUD),
                  no hard edge above the bar. */}
              {controls && (
                // pointer-events-none: the strip itself must never eat canvas
                // taps (intro "press to continue" sits under it) — the inner
                // wrapper re-enables events for the bar when it's visible.
                <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
                  {controls}
                </div>
              )}
              {bootScreen}
            </div>
          </div>
          {bottomDock}
        </div>
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
