// WaysLightComet — a thin white light streak that shoots THROUGH one ways-win
// connection like a comet: the line grows toward the next symbol at the front
// while it dissolves at the back, so nothing stays behind — the light flows
// left→right through the board and is gone by the end. Between two reels every
// symbol connection (bipartite = ways) gets its own thin beam.
//
// Purely visual/additive — never touches game logic or RTP. Port of the
// contributor's LF/vanilla `wayslight.js` into the generator runtime (Pixi v8 +
// GSAP, driven by the app ticker). Fired per winning combination from
// ReelSet.revealCombo(). Registry entry: winPresentation `ways-light-comet`.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { gsap } from 'gsap';

export interface WaysLightConfig {
  /** Feature on/off (adjustable param `waysLight`). */
  enabled: boolean;
  /** Beam colour (adjustable param `waysLightColor`). */
  color: number;
  /** Core line thickness in px (adjustable param `waysLightWidth`). */
  width: number;
  /** ms per reel-step — smaller = faster comet (adjustable param `waysLightSpeed`). */
  stepMs: number;
  /** Cell size, set by ReelSet so the comet head scales with the grid. */
  cellSize: number;
}

/** Live, mutable config — updated by PixiApp.applyVisualParam, read on each play. */
export const waysLightConfig: WaysLightConfig = {
  enabled: true,
  color: 0xffffff,
  width: 2.4,
  stepMs: 130,
  cellSize: 120,
};

/** Colour presets for the `waysLightColor` adjustable param. */
export const WAYS_LIGHT_PRESETS: Record<string, { color: number; label: string }> = {
  white: { color: 0xffffff, label: 'White' },
  ice: { color: 0x9fe8ff, label: 'Ice blue' },
  gold: { color: 0xffe08a, label: 'Gold' },
  purple: { color: 0xc9a3ff, label: 'Purple' },
  green: { color: 0x9dffc2, label: 'Green' },
  pink: { color: 0xff9fd6, label: 'Pink' },
};
export const WAYS_LIGHT_SPEED_MS: Record<string, number> = { slow: 210, normal: 130, fast: 80 };
export const WAYS_LIGHT_WIDTH_PX: Record<string, number> = { thin: 1.6, medium: 2.4, bold: 3.6 };

type Pt = { x: number; y: number };

// In-flight comet layers with a cancel fn — so a new spin / highlight-clear can
// kill any streak mid-animation without leaving orphaned GSAP tweens.
const active = new Set<() => void>();

/** Kill every in-flight comet immediately (called from ReelSet.clearHighlights). */
export function clearAllWaysLight(): void {
  for (const cancel of [...active]) cancel();
  active.clear();
}

let _glowTex: Texture | null = null;
function glowTexture(): Texture {
  if (_glowTex) return _glowTex;
  const S = 128;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = S;
  const ctx = cvs.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  _glowTex = Texture.from(cvs);
  return _glowTex;
}

/** One edge a→b as a comet segment (grow front, wipe back). */
function makeEdge(
  beamLayer: Container,
  headLayer: Container,
  a: Pt,
  b: Pt,
  color: number,
  coreW: number,
  durSec: number,
  cellSize: number,
  tweens: gsap.core.Tween[],
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cont = new Container();
  cont.position.set(a.x, a.y);
  cont.rotation = Math.atan2(dy, dx);
  const inner = new Container();
  inner.scale.set(0, 1);
  cont.addChild(inner);

  const glow = new Graphics();
  glow.roundRect(0, -coreW * 2, len, coreW * 4, coreW * 2).fill({ color, alpha: 0.22 });
  glow.blendMode = 'add';
  const core = new Graphics();
  core.roundRect(0, -coreW / 2, len, coreW, coreW / 2).fill({ color, alpha: 0.98 });
  inner.addChild(glow, core);
  beamLayer.addChild(cont);

  let dead = false;
  return {
    grow(): Promise<void> {
      const head = new Sprite(glowTexture());
      head.anchor.set(0.5);
      head.tint = color;
      head.blendMode = 'add';
      // Small, tight comet tip — a bright glint, not a big blob. Capped so it
      // never blows up on large cells (client: the head was "riesig").
      head.width = head.height = Math.min(cellSize * 0.26, 26);
      head.position.set(a.x, a.y);
      headLayer.addChild(head);
      const t1 = gsap.to(inner.scale, { x: 1, duration: durSec, ease: 'none' });
      const t2 = gsap.to(head.position, { x: b.x, y: b.y, duration: durSec, ease: 'none' });
      tweens.push(t1, t2);
      return Promise.all([t1.then(() => {}), t2.then(() => {})]).then(() => {
        const t3 = gsap.to(head, {
          alpha: 0,
          duration: 0.09,
          ease: 'power2.out',
          onComplete: () => head.destroy(),
        });
        tweens.push(t3);
      });
    },
    wipe(): Promise<void> {
      const t1 = gsap.to(inner, { x: len, duration: durSec, ease: 'none' });
      const t2 = gsap.to(inner.scale, { x: 0, duration: durSec, ease: 'none' });
      tweens.push(t1, t2);
      return Promise.all([t1.then(() => {}), t2.then(() => {})]).then(() => {
        if (dead) return;
        dead = true;
        cont.destroy({ children: true });
      });
    },
  };
}

/**
 * Fire the comet through ONE connection. `reels` = the winning cell centres
 * (ReelSet-local coords) grouped left→right by reel. Self-cleaning.
 */
export function playWaysLight(parent: Container, reels: Pt[][], cfg: WaysLightConfig = waysLightConfig): Promise<void> {
  if (!cfg.enabled || reels.length < 2) return Promise.resolve();

  const layer = new Container();
  const beamLayer = new Container();
  const headLayer = new Container(); // heads always above the lines
  layer.addChild(beamLayer, headLayer);
  parent.addChild(layer);

  const durSec = Math.max(0.02, cfg.stepMs / 1000);
  const tweens: gsap.core.Tween[] = [];
  let finished = false;
  const cancel = () => {
    if (finished) return;
    finished = true;
    for (const t of tweens) t.kill();
    if (layer.parent) layer.parent.removeChild(layer);
    layer.destroy({ children: true });
    active.delete(cancel);
  };
  active.add(cancel);

  return (async () => {
    try {
      const wipes: Array<Promise<unknown>> = [];
      let prev: ReturnType<typeof makeEdge>[] | null = null;
      for (let k = 0; k < reels.length - 1; k++) {
        if (finished) return;
        const left = reels[k];
        const right = reels[k + 1];
        const edges: ReturnType<typeof makeEdge>[] = [];
        for (const a of left) for (const b of right) edges.push(makeEdge(beamLayer, headLayer, a, b, cfg.color, cfg.width, durSec, cfg.cellSize, tweens));
        const growing = Promise.all(edges.map(e => e.grow()));
        if (prev) wipes.push(Promise.all(prev.map(e => e.wipe())));
        await growing;
        prev = edges;
      }
      if (prev) wipes.push(Promise.all(prev.map(e => e.wipe())));
      await Promise.all(wipes);
    } finally {
      cancel();
    }
  })();
}
