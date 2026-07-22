// Near-miss tease preset registry + active-preset switch (panel-driven).
import { Graphics } from 'pixi.js';
import type { TeasePreset, TeaseContext } from './teaseTypes';
import { TEASE_PACK } from './tease/teasePack';
import { universalAnticipation } from './tease/universalAnticipation';

/** The generator's original look: one static soft gold halo per landed
 *  scatter, nothing on the pending reels (deceleration only). */
const devDefault: TeasePreset = {
  id: 'dev-default',
  name: 'Dev Default',
  description: 'Static gold halo on landed scatters — the untouched baseline.',
  onScatterLanded(ctx: TeaseContext, reel: number, row: number): void {
    const r = ctx.cellRect(reel, row);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.max(r.w, r.h) * 0.72;
    const g = new Graphics();
    for (let i = 5; i >= 1; i--) {
      g.circle(cx, cy, rad * (i / 5)).fill({ color: 0xFFE08A, alpha: 0.5 * 0.18 * (6 - i) / 5 });
    }
    ctx.layer.addChild(g);
  },
  onPendingReel(): void { /* baseline: no pending-reel visual */ },
};

export const TEASE_PRESETS: readonly TeasePreset[] = [universalAnticipation, devDefault, ...TEASE_PACK];

// Universal Anticipation is the DEFAULT: stage dim + marquee running-light
// frame — the drop-in near-miss tease for every game the generator stamps.
let active: TeasePreset = TEASE_PRESETS[0];
export function setActiveTeasePreset(id: string): TeasePreset {
  active = TEASE_PRESETS.find(p => p.id === id) ?? TEASE_PRESETS[0];
  return active;
}
/** Per-game tease tuning. Vice Heat turns the landed-cell FX off (Noski
 *  2026-07-22: "auf dem 1:1 Feld der Effekt raus, die Reels-Energie bleibt")
 *  — the pending-reel gold gate + rising embers stay untouched. */
export const teaseTuning = { scatterLandedFx: true };

export function getActiveTeasePreset(): TeasePreset {
  return active;
}
