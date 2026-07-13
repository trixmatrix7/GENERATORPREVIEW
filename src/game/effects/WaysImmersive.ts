// WAYS-IMMERSIVE win presentation — the OBJECTS carry the win, no overlays.
//
// No lines, no comets, no rings, no sweeps, no sparkles: the board eases down
// to a deep dim and the winning symbols themselves MOVE — each one leaps out
// of its cell (staggered left→right), wiggles mid-air and lands with a bounce,
// on top of its own win-state animation (scale pulse / character sheet). Big
// matches add a decaying board punch; expanded wild towers do a physical
// column thump instead (their cells are hidden — the tower is the wild).
//
// Purely visual and outcome-neutral: geometry from the shared anchors
// (grid-agnostic), motion targets are the symbols' own object layers
// (theme-agnostic), every tween rides ReelSet's clearWinLines() lifecycle
// with position/rotation restored on completion AND interrupt.
// Registry entry: winPresentation `ways-immersive`.

import { Container } from 'pixi.js';
import { gsap } from 'gsap';

export const waysImmersiveConfig = {
  enabled: true,
  /** Non-winning cells dim to this alpha during a combo reveal (deeper than
   *  the classic 0.25 — the dark board makes the winners' motion read big). */
  dimAlpha: 0.16,
  /** Per-reel stagger of the left→right leap wave, seconds. */
  stagger: 0.07,
};

/** Matches the app-wide reduced-motion gate (PixiApp keeps its own copy —
 *  module-private there). */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One winning symbol's leap: jump up out of the cell, a quick mid-air wiggle,
 * bounce back onto the landing. Animates the symbol's OBJECT LAYER (which the
 * win-state pulse/sheet also lives on), so character motion and leap compose.
 * `intense` = tally/finale step (full jump); the resting loop breathes softer.
 *
 * The base y/rotation are captured at call time (the object is already lifted
 * into board coords) and restored on completion AND on interrupt — ReelSet
 * kills these tweens via clearWinLines BEFORE un-lifting, so the restore
 * always writes the correct lifted-space values.
 */
export function danceWinningObject(
  obj: Container,
  delay: number,
  intense: boolean,
  sink: gsap.core.Animation[],
): void {
  const baseY = obj.y;
  const baseRot = obj.rotation;
  const restore = () => { obj.y = baseY; obj.rotation = baseRot; };
  const jump = intense ? 18 : 10;
  const tilt = intense ? 0.08 : 0.04;
  const slam = intense ? 5 : 2.5;

  // Leap up fast, hang with a wiggle, then SLAM down through the floor and
  // snap back — an impact landing, not a soft bounce-out.
  const tl = gsap.timeline({ delay, onComplete: restore, onInterrupt: restore });
  tl.to(obj, { y: baseY - jump, duration: 0.15, ease: 'power3.out' }, 0)
    .to(obj, { rotation: baseRot - tilt, duration: 0.08, ease: 'sine.inOut' }, 0.04)
    .to(obj, { rotation: baseRot + tilt, duration: 0.12, ease: 'sine.inOut' }, 0.12)
    .to(obj, { rotation: baseRot, duration: 0.12, ease: 'sine.out' }, 0.24)
    .to(obj, { y: baseY + slam, duration: 0.11, ease: 'power3.in' }, 0.22)
    .to(obj, { y: baseY, duration: 0.3, ease: 'back.out(3.5)' }, 0.33);
  sink.push(tl);
}
