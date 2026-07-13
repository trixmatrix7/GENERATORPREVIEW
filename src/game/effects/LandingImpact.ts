// LANDING IMPACT — harder, punchier reel landings (Noski: "härteres Landing,
// stärker, impulsiver, spannender"). Pure motion, no overlays:
//
// 1. Per-symbol touchdown multipliers: deeper squash, taller rebound stretch,
//    stronger rotation kick, snappier compress phase. Applied by
//    AnimatedSymbol on top of presetTimings(), so every state preset gets the
//    same +impact treatment and the dev's baseline numbers stay untouched.
// 2. Board THUD: each reel stop jolts the whole board down a few px with a
//    fast return — the final reel slams hardest with an elastic settle.
//    (Implemented in ReelSet; the jolt restores its exact base position on
//    completion AND interrupt, so the board never drifts.)
//
// Outcome-neutral, grid- and theme-agnostic. Multipliers are clamped so even
// extreme state presets can't squash below readable bounds.

export const landingImpactConfig = {
  enabled: true,
  /** Squash depth multiplier — landBounce 0.90 → ~0.83, landing 0.78 → ~0.63. */
  squashMul: 1.7,
  /** Rebound stretch multiplier — landBounce 1.06 → ~1.10, landing 1.18 → ~1.29. */
  stretchMul: 1.6,
  /** Rotation-kick multiplier on the rich landing state (wild/scatter). */
  rotationMul: 1.8,
  /** Compress-phase duration multiplier (<1 = the hit reads harder). */
  snapMul: 0.75,
  /** Board jolt on every reel stop. */
  thud: true,
  thudAmp: 2.2,
  thudLastAmp: 4,
};

/** Deepen a squash factor (e.g. 0.90 → 0.83), clamped to stay readable. */
export function impactSquash(base: number): number {
  const c = landingImpactConfig;
  if (!c.enabled) return base;
  return Math.max(0.6, 1 - (1 - base) * c.squashMul);
}

/** Raise a stretch/overshoot factor (e.g. 1.06 → 1.10), clamped. */
export function impactStretch(base: number): number {
  const c = landingImpactConfig;
  if (!c.enabled) return base;
  return Math.min(1.45, 1 + (base - 1) * c.stretchMul);
}
