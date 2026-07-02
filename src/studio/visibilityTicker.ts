// visibilityTicker — PREVIEW-ONLY helper (not part of the dev runtime).
// Hidden tabs throttle requestAnimationFrame, which pauses GSAP and stalls an
// in-flight spin's awaited tweens. When the tab is hidden we drive gsap.ticker
// from setInterval so automated/background testing still completes; on return
// we hand back to rAF. The dev's game files are untouched.

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
