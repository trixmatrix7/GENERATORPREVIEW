// game/ticker.ts — keep GSAP progressing when the tab is backgrounded.
// requestAnimationFrame is paused/throttled in hidden tabs, which would stall an
// in-flight spin (the awaited tween never resolves). When hidden we drive
// gsap.ticker from a setInterval so the lifecycle still completes; on return we
// hand back to rAF.

import { gsap } from 'gsap';

let fallback: number | undefined;

export function installVisibilityTicker(): void {
  if (typeof document === 'undefined') return;
  const onChange = () => {
    if (document.hidden) {
      if (fallback === undefined) {
        gsap.ticker.lagSmoothing(0);
        fallback = window.setInterval(() => gsap.ticker.tick(), 1000 / 60);
      }
    } else if (fallback !== undefined) {
      clearInterval(fallback);
      fallback = undefined;
      gsap.ticker.lagSmoothing(500, 33);
    }
  };
  document.addEventListener('visibilitychange', onChange);
  onChange();
}
