// Individual reel — manages a column of AnimatedSymbol cells in PixiJS.
// GSAP drives reel-level motion; AnimatedSymbol owns per-symbol animation
// states (idle, landing, win, featured) and their fallbacks.

import { Container, BlurFilter } from 'pixi.js';
import { gsap } from 'gsap';
import { getActiveGrid } from '@/config/gridConfig';
import { SYMBOLS, type SymbolIdType } from '@/config/symbols';
import { AnimatedSymbol } from './AnimatedSymbol';
import { CELL_HEIGHT, SYMBOL_GAP, SYMBOL_HEIGHT, SYMBOL_WIDTH } from './symbolMetrics';
import type { SymbolAtlasMap } from './SymbolAtlasLoader';
import type { GameTheme } from '@/engine/GameConfig';

// Re-export so existing consumers (ReelSet, tests) can keep their
// `from './Reel'` import paths working. The canonical source is
// `./symbolMetrics`, which mirrors `DEFAULT_CELL_METRICS` in gridConfig.
export { CELL_HEIGHT, SYMBOL_GAP, SYMBOL_HEIGHT, SYMBOL_WIDTH };

const BUFFER_SYMBOLS = 4;

/** Vertical motion-blur strength applied while a reel rolls (eased to 0 on
 *  stop). Higher = more streak. The clip mask hides horizontal/edge bleed. */
const SPIN_BLUR = 9;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Reel {
  readonly container: Container;
  private readonly atlases: SymbolAtlasMap;
  private readonly strip: ReadonlyArray<number>;
  private readonly len: number;
  private readonly theme: GameTheme | undefined;
  private readonly visibleRows: number;
  private readonly cells: AnimatedSymbol[] = [];
  private currentStop = 0;
  private spinning = false;
  private spinTween: gsap.core.Tween | null = null;
  private stopTween: gsap.core.Tween | null = null;
  /** Pending gsap.delayedCall that begins deceleration after the per-reel
   *  stagger/tease delay. The reel keeps spinning until this fires. */
  private stopDelayCall: gsap.core.Tween | null = null;
  private pendingStop: { stop: number; resolve: () => void } | null = null;
  private _stripOffset = 0;
  private lastIntPos = -1;
  /** Vertical motion blur, on the reel container while it rolls. */
  private spinBlur: BlurFilter | null = null;
  /** Roll-speed multiplier (chat-config 'reelSpeed'); 1 = default. Animation
   *  only — never affects which stop is landed. */
  private speedMul = 1;

  constructor(
    atlases: SymbolAtlasMap,
    strip: ReadonlyArray<number>,
    theme?: GameTheme,
    visibleRows: number = getActiveGrid().visibleRows,
  ) {
    this.atlases = atlases;
    this.strip = strip;
    this.len = strip.length;
    this.theme = theme;
    this.visibleRows = visibleRows;
    this.container = new Container();

    const totalSymbols = visibleRows + BUFFER_SYMBOLS;
    for (let i = 0; i < totalSymbols; i++) {
      const cell = new AnimatedSymbol(this.atlases, this.theme);
      cell.y = (i - Math.floor(BUFFER_SYMBOLS / 2)) * CELL_HEIGHT;
      this.container.addChild(cell);
      this.cells.push(cell);
    }

    this.updateSymbolContent(0);
    this.repositionSymbols(0);
  }

  /**
   * Update which symbol each cell displays for the given integer strip position.
   * Called only when the integer stop changes — NOT on every animation frame.
   */
  private updateSymbolContent(intPos: number) {
    const len = this.len;
    const totalSymbols = this.cells.length;
    const bufferAbove = Math.floor(BUFFER_SYMBOLS / 2);

    for (let i = 0; i < totalSymbols; i++) {
      const stripIdx = ((intPos - bufferAbove + i) % len + len) % len;
      const symId = this.strip[stripIdx] as SymbolIdType;
      this.cells[i].setSymbol(symId);
    }
  }

  /**
   * Combined update called on every animation frame.
   * Symbol content only refreshes when the integer position changes.
   * Y positions update every frame for smooth scrolling.
   */
  private updateFrame(pos: number) {
    const intPos = Math.floor(pos);
    const fractional = pos - intPos;
    const bufferAbove = Math.floor(BUFFER_SYMBOLS / 2);

    if (intPos !== this.lastIntPos) {
      this.lastIntPos = intPos;
      this.updateSymbolContent(intPos);
    }

    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].y = (i - bufferAbove - fractional) * CELL_HEIGHT;
    }
  }

  private repositionSymbols(pos: number) {
    const fractional = pos - Math.floor(pos);
    const bufferAbove = Math.floor(BUFFER_SYMBOLS / 2);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].y = (i - bufferAbove - fractional) * CELL_HEIGHT;
    }
  }

  startSpin() {
    if (this.spinning) return;
    this.spinning = true;
    this.lastIntPos = -1;
    this._stripOffset = this.currentStop;
    this.clearAllStates();

    if (prefersReducedMotion()) return;

    // Vertical motion blur while the reel rolls. The parent clipContainer mask
    // clips it at the window edge, so the streak reads as symbols entering and
    // leaving — not a smear over the frame. Eased to 0 during deceleration.
    if (!this.spinBlur) this.spinBlur = new BlurFilter({ strength: 0, quality: 2 });
    this.spinBlur.strengthX = 0;
    this.spinBlur.strengthY = SPIN_BLUR;
    this.container.filters = [this.spinBlur];

    const len = this.len;
    const proxy = { pos: this._stripOffset };

    // Constant-speed spin — runs until stopOn() kills it.
    // Speed: ~1.5 full strip rotations per second. THE spin-speed knob — lower
    // = slower reel roll. Real slots roll fairly slowly; raise toward 2.0+ for
    // a faster blur, drop toward 1.2 for an even more deliberate roll.
    // DIRECTION: pos DECREASES, which scrolls the reel DOWNWARD (symbols fall,
    // new symbols enter from the top, exit at the bottom) — the conventional
    // slot direction. (updateFrame's y math is unchanged; only the direction
    // pos travels, plus stopOn's target/overshoot signs, flip.)
    const speed = len * 1.5 * this.speedMul; // positions per second — reel spin speed
    const totalDistance = len * 200; // run "forever" (killed by stopOn)
    const duration = totalDistance / speed;

    this.spinTween = gsap.to(proxy, {
      pos: proxy.pos - totalDistance,
      duration,
      ease: 'none',
      onUpdate: () => {
        this._stripOffset = proxy.pos;
        this.updateFrame(proxy.pos);
      },
    });
  }

  cancelSpin() {
    this.stopDelayCall?.kill();
    this.stopDelayCall = null;
    this.spinTween?.kill();
    this.spinTween = null;
    if (this.pendingStop) {
      this.stopTween?.kill();
      this.stopTween = null;
      const { stop, resolve } = this.pendingStop;
      this.pendingStop = null;
      this.snapTo(stop);
      resolve();
    } else if (this.spinning) {
      // Spinning but no pending stop yet — snap to the last known stop so
      // we land on a defined state instead of leaving the reel mid-scroll.
      this.snapTo(this.currentStop);
    }
  }

  /**
   * Stop the reel on the given strip position.
   * @param delay     - delay before deceleration begins (used for per-reel stagger)
   * @param fast      - skip animation entirely (turbo mode or reduced-motion)
   * @param durationOverride - optional longer stop (for near-miss tension)
   * @param isTeased  - if true, ALL visible symbols get a landing bounce (not just wild/scatter)
   */
  stopOn(stop: number, delay = 0, fast = false, durationOverride?: number, isTeased = false): Promise<void> {
    return new Promise(resolve => {
      if (!this.spinning) {
        resolve();
        return;
      }

      if (fast || prefersReducedMotion()) {
        this.spinTween?.kill();
        this.spinTween = null;
        this.snapTo(stop);
        resolve();
        return;
      }

      this.pendingStop = { stop, resolve };

      // Begin deceleration. Crucially, this captures the LIVE strip position
      // and only NOW kills the constant-speed spin — so the reel keeps
      // spinning smoothly through the per-reel stagger / near-miss `delay`.
      // (The previous version killed the spin immediately and waited out
      // `delay` with no active tween, freezing the reel mid-spin — the
      // "one small stop while spinning" artifact.)
      const startDecel = () => {
        this.stopDelayCall = null;
        this.spinTween?.kill();
        this.spinTween = null;

        const len = this.len;
        const currentPos = this._stripOffset;
        // Downward scroll: pos DECREASES toward the target, which is below the
        // current position and congruent to `stop` (mod len). Lands on the same
        // board as before — only the approach direction differs.
        const target = currentPos - (((currentPos - stop) % len + len) % len) - len * 2;

        // Two-phase settle: decelerate downward past the target by a small
        // overshoot, then a quick spring back UP to land. The spring-back is
        // reverse-direction, so it stays short and constant — a long near-miss
        // tease only lengthens the forward (downward) deceleration, never the
        // reverse bounce (keeps direction consistent).
        const overshoot = 0.2; // symbols past target — same for teased + normal
        const bounceDuration = 0.18; // fixed quick settle, independent of tease length
        const baseDuration = durationOverride ?? 1.4; // normal-stop decel length (spin-feel knob)
        const decelDuration = Math.max(0.1, baseDuration - bounceDuration);
        const overshootTarget = target - overshoot; // continue past target, downward

        const proxy = { pos: currentPos };
        const tl = gsap.timeline({
          onComplete: () => {
            this.stopTween = null;
            this.pendingStop = null;
            this.spinning = false;
            this.currentStop = stop;
            this._stripOffset = stop;
            this.lastIntPos = -1;
            this.container.filters = []; // drop the motion blur once landed
            this.updateSymbolContent(stop);
            this.repositionSymbols(stop);
            this.triggerLandingOnVisible(isTeased);
            this.playStopThunk();
            resolve();
          },
        });
        // Ease the motion blur out over the deceleration (decoupled from the
        // position tween so it fades smoothly as the reel slows).
        if (this.spinBlur) {
          tl.to(this.spinBlur, { strengthY: 0, duration: decelDuration, ease: 'power2.out' }, 0);
        }
        tl.to(proxy, {
          pos: overshootTarget,
          duration: decelDuration,
          // power2.out starts gentler than power3.out, so the hand-off from
          // constant-speed spinning into deceleration doesn't visibly jump.
          ease: 'power2.out',
          onUpdate: () => {
            this._stripOffset = proxy.pos;
            this.updateFrame(proxy.pos);
          },
        }, 0);
        tl.to(proxy, {
          pos: target,
          duration: bounceDuration,
          ease: 'back.out(2.5)',
          onUpdate: () => {
            this._stripOffset = proxy.pos;
            this.updateFrame(proxy.pos);
          },
        });
        this.stopTween = tl as unknown as gsap.core.Tween;
      };

      if (delay > 0) {
        // Keep spinning through the stagger/tease delay, THEN decelerate.
        this.stopDelayCall = gsap.delayedCall(delay, startDecel);
      } else {
        startDecel();
      }
    });
  }

  snapTo(stop: number) {
    this.stopDelayCall?.kill();
    this.stopDelayCall = null;
    this.spinTween?.kill();
    this.spinning = false;
    this.container.filters = []; // drop any motion blur (turbo / reduced-motion)
    this.currentStop = stop;
    this._stripOffset = stop;
    this.lastIntPos = -1;
    this.updateSymbolContent(stop);
    this.repositionSymbols(stop);
  }

  highlightRows(rows: number[]) {
    const bufferAbove = Math.floor(BUFFER_SYMBOLS / 2);
    for (let i = 0; i < this.cells.length; i++) {
      const visibleRow = i - bufferAbove;
      if (visibleRow >= 0 && visibleRow < this.visibleRows) {
        this.cells[i].highlight(rows.includes(visibleRow));
      }
    }
  }

  clearHighlights() {
    for (const c of this.cells) c.clearHighlight();
  }

  /** Set the roll-speed multiplier (chat-config 'reelSpeed'). Takes effect on
   *  the next spin; animation only — the landed stop is unaffected. */
  setSpeedMul(mul: number): void {
    this.speedMul = Math.max(0.2, mul);
  }

  /** Play win state on all visible winning rows — fires simultaneously for a unified feel. */
  playWinStateOnRows(rows: number[]) {
    const bufferAbove = Math.floor(BUFFER_SYMBOLS / 2);
    for (const row of rows) {
      this.cells[bufferAbove + row]?.play('win');
    }
  }

  /** Apply the 'featured' state to the visible row(s). Used for near-miss tease. */
  playFeaturedOnVisibleRow(row: number) {
    const bufferAbove = Math.floor(BUFFER_SYMBOLS / 2);
    this.cells[bufferAbove + row]?.play('featured');
  }

  /** Reset every cell back to the 'static' neutral state. */
  clearAllStates() {
    for (const c of this.cells) c.clearState();
  }

  /** Force every cell to redraw its static tile. Used when external theme
   *  state (user-uploaded asset textures) mutates and visible cells must
   *  pick up the new sprite without a fresh spin. */
  refreshAllTiles() {
    for (const c of this.cells) c.refreshTile();
  }

  /** Stop all motion and dispose of per-cell tweens before Pixi destroys
   *  the scene graph. Reel-level tweens are killed here; cell tweens are
   *  killed via AnimatedSymbol.dispose(). */
  dispose(): void {
    this.stopDelayCall?.kill();
    this.stopDelayCall = null;
    this.spinTween?.kill();
    this.spinTween = null;
    this.stopTween?.kill();
    this.stopTween = null;
    this.pendingStop = null;
    this.spinning = false;
    this.container.filters = [];
    this.spinBlur?.destroy();
    this.spinBlur = null;
    for (const cell of this.cells) cell.dispose();
  }

  /** Clear state on a single visible row without disturbing other cells. */
  clearStateOnRow(row: number) {
    const bufferAbove = Math.floor(BUFFER_SYMBOLS / 2);
    this.cells[bufferAbove + row]?.clearState();
  }

  /** The AnimatedSymbol currently shown at visible row `row` (or undefined). */
  getVisibleCell(row: number): AnimatedSymbol | undefined {
    const bufferAbove = Math.floor(BUFFER_SYMBOLS / 2);
    return this.cells[bufferAbove + row];
  }

  /** Subtle whole-column settle on stop — adds weight on top of the per-symbol
   *  land bounce: a quick 3px dip + spring back. Skipped under reduced motion. */
  private playStopThunk(): void {
    if (prefersReducedMotion()) return;
    const baseY = this.container.y;
    gsap.timeline()
      .to(this.container, { y: baseY + 3, duration: 0.07, ease: 'power2.in' })
      .to(this.container, { y: baseY, duration: 0.22, ease: 'back.out(3)' });
  }

  private triggerLandingOnVisible(bounceAll = false) {
    const len = this.len;
    const bufferAbove = Math.floor(BUFFER_SYMBOLS / 2);
    for (let row = 0; row < this.visibleRows; row++) {
      const stripIdx = (this.currentStop + row) % len;
      const symId = this.strip[stripIdx] as SymbolIdType;
      const def = SYMBOLS[symId];
      const cell = this.cells[bufferAbove + row];
      if (bounceAll || def.isWild || def.isScatter) {
        // Rich landing (squash + rotation kick → idle glow) for the symbols
        // that deserve a spotlight, or every symbol on a teased reel.
        cell?.play('landing');
      } else {
        // Every other symbol still gets a subtle settle, so EVERY reel stop
        // feels tactile — not just the ones with a wild/scatter on screen.
        cell?.playLandBounce();
      }
    }
  }
}
