// game/ReelSet.ts — Layer 4 host. Builds the cell grid, runs the staggered drop
// choreography (left→right column stagger, outBack settle, scatter "sweat"
// slow-mo on remaining reels), and exposes per-cell access for effects.

import { Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { AnimatedSymbol, type SymbolRenderCtx } from './AnimatedSymbol';
import { REEL_COUNT } from '../engine/reels';
import type { GridLayout } from '../config/gridConfig';
import type { Board } from '../engine/types';

import type { SpinStyle } from '../registries/types';

export interface DropOptions {
  style: SpinStyle;
  dropDurationMs: number;
  staggerMs: number;
  rowGapMs: number;
  spinSpeed: number;
  sweatFromReel?: number; // reels >= this index fall in slow-mo
  sweatSlowFactor?: number;
}

export class ReelSet {
  readonly symbolsLayer: Container;
  private maskG: Graphics;
  private layout: GridLayout;
  private ctx: SymbolRenderCtx;
  /** cells[row][reel] */
  cells: AnimatedSymbol[][] = [];

  constructor(layout: GridLayout, ctx: SymbolRenderCtx) {
    this.layout = layout;
    this.ctx = ctx;
    this.symbolsLayer = new Container();
    this.maskG = new Graphics();
    this.symbolsLayer.addChild(this.maskG);
    this.symbolsLayer.mask = this.maskG;
    this.build();
  }

  private build(): void {
    const { spec } = this.layout;
    this.maskG.clear();
    this.maskG.rect(0, 0, this.layout.width, this.layout.height).fill({ color: 0xffffff });

    this.cells = [];
    for (let row = 0; row < spec.rows; row++) {
      this.cells[row] = [];
      for (let reel = 0; reel < REEL_COUNT; reel++) {
        const sym = new AnimatedSymbol(this.ctx, reel, row);
        const c = this.layout.cellCenter(reel, row);
        sym.view.x = c.x;
        sym.view.y = c.y;
        this.symbolsLayer.addChild(sym.view);
        this.cells[row][reel] = sym;
      }
    }
  }

  cell(reel: number, row: number): AnimatedSymbol {
    return this.cells[row][reel];
  }

  cellsFlat(): AnimatedSymbol[] {
    return this.cells.flat();
  }

  setBoardInstant(board: Board): void {
    for (let row = 0; row < this.cells.length; row++) {
      for (let reel = 0; reel < REEL_COUNT; reel++) {
        const sym = this.cells[row][reel];
        sym.setSymbol(board[row][reel]);
        const c = this.layout.cellCenter(reel, row);
        sym.view.y = c.y;
        sym.view.alpha = 1;
        sym.view.scale.set(1);
      }
    }
  }

  /** Bring the board in using the selected spin STYLE. Resolves when settled.
   *  Style is OVERLAY (visual only); the board contents are SPEC and unchanged. */
  dropBoard(board: Board, opts: DropOptions, onReelLanded?: (reel: number) => void): Promise<void> {
    const rows = this.cells.length;
    const dropAbove = this.layout.height + this.layout.cellH * 2;
    const speed = Math.max(0.2, opts.spinSpeed);
    const dur = opts.dropDurationMs / 1000 / speed;
    const stagger = opts.staggerMs / 1000 / speed;
    const rowGap = opts.rowGapMs / 1000 / speed;
    const promises: Promise<void>[] = [];

    for (let reel = 0; reel < REEL_COUNT; reel++) {
      const slow =
        opts.sweatFromReel !== undefined && reel >= opts.sweatFromReel ? opts.sweatSlowFactor ?? 1 : 1;
      const reelDur = dur * slow;
      const reelDelayBase = reel * stagger * (slow > 1 ? 1.6 : 1);
      let lastSettle = 0;

      for (let row = 0; row < rows; row++) {
        const sym = this.cells[row][reel];
        sym.setSymbol(board[row][reel]);
        const target = this.layout.cellCenter(reel, row).y;
        const delay = reelDelayBase + row * rowGap;
        lastSettle = Math.max(lastSettle, delay + reelDur);

        // reset transform state then apply the style's entry animation
        sym.view.y = target;
        sym.view.alpha = 1;
        sym.view.scale.set(1);

        promises.push(
          new Promise<void>((resolve) => {
            if (opts.style === 'fade') {
              sym.view.alpha = 0;
              sym.view.scale.set(0.6);
              gsap.to(sym.view, { alpha: 1, duration: reelDur, delay, ease: 'power2.out' });
              gsap.to(sym.view.scale, { x: 1, y: 1, duration: reelDur, delay, ease: 'back.out(1.6)', onComplete: resolve });
            } else {
              // drop / slam / reel-spin all fall from above; ease/offset differ
              const above = opts.style === 'reel-spin' ? dropAbove * 1.8 : dropAbove;
              const ease = opts.style === 'slam' ? 'back.out(2.4)' : opts.style === 'reel-spin' ? 'power3.out' : 'back.out(1.1)';
              sym.view.y = target - above;
              gsap.to(sym.view, { y: target, duration: reelDur, delay, ease, onComplete: resolve });
            }
          }),
        );
      }

      gsap.delayedCall(lastSettle, () => onReelLanded?.(reel));
    }

    return Promise.all(promises).then(() => undefined);
  }

  rebuild(layout: GridLayout, ctx: SymbolRenderCtx): void {
    for (const c of this.cellsFlat()) c.destroy();
    this.symbolsLayer.removeChildren();
    this.symbolsLayer.addChild(this.maskG);
    this.layout = layout;
    this.ctx = ctx;
    this.build();
  }

  killAll(): void {
    for (const c of this.cellsFlat()) c.killTweens();
  }

  destroy(): void {
    for (const c of this.cellsFlat()) c.destroy();
    this.symbolsLayer.destroy({ children: true });
  }
}
