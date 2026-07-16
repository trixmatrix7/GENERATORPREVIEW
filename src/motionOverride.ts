// MOTION IS THE PRODUCT. Visitors with the OS "reduce motion" flag set
// (Windows animation setting, iOS Reduce Motion / Low Power, Android
// "remove animations") were getting the ENTIRE presentation skipped:
// instant reel results, no free-spins flow, no win sequences — the demo
// looked broken. Every motion gate in the stack (PixiApp, Reel.ts,
// AnimatedSymbol, WaysImmersive) reads matchMedia('prefers-reduced-motion')
// — Reel.ts must stay byte-identical to the dev repo, so instead of
// touching the gates we shim the media query itself to always answer "no".
//
// MUST be the FIRST import in main.tsx (module-load-time reads included).

const orig = typeof window !== 'undefined' ? window.matchMedia.bind(window) : null;
if (orig) {
  window.matchMedia = ((query: string) => {
    if (typeof query === 'string' && query.includes('prefers-reduced-motion')) {
      const noop = () => undefined;
      return {
        matches: false,
        media: query,
        onchange: null,
        addEventListener: noop,
        removeEventListener: noop,
        addListener: noop,
        removeListener: noop,
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    }
    return orig(query);
  }) as typeof window.matchMedia;
}

export {};
