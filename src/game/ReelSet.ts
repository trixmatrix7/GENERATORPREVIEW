// game/ReelSet.ts — Layer 4 host. Builds the cell grid, runs the staggered drop
// choreography (left→right column stagger, outBack settle, scatter "sweat"
// slow-mo on remaining reels), and exposes per-cell access for effects.

import { Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';
import { AnimatedSymbol, type SymbolRenderCtx } from './AnimatedSymbol';
import { REEL_COUNT } from '../engine/reels';
import type { GridLayout } from '../config/gridConfig';
import type { Board } from '../engine/types';

export interface DropOptions {
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
        this.cells[row][reel].setSymbol(board[row][reel]);
        const c = this.layout.cellCenter(reel, row);
        this.cells[row][reel].view.y = c.y;
      }
    }
  }

  /** Drop the board in. Resolves when every reel has settled. */
  dropBoard(board: Board, opts: DropOptions, onReelLanded?: (reel: number) => void): Promise<void> {
    const rows = this.cells.length;
    const dropAbove = this.layout.height + this.layout.cellH * 2;
    const dur = (opts.dropDurationMs / 1000) / Math.max(0.2, opts.spinSpeed);
    const stagger = (opts.staggerMs / 1000) / Math.max(0.2, opts.spinSpeed);
    const rowGap = (opts.rowGapMs / 1000) / Math.max(0.2, opts.spinSpeed);

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
        sym.view.y = target - dropAbove;
        const delay = reelDelayBase + row * rowGap;
        lastSettle = Math.max(lastSettle, delay + reelDur);
        promises.push(
          new Promise<void>((resolve) => {
            gsap.to(sym.view, {
              y: target,
              duration: reelDur,
              delay,
              ease: 'back.out(1.1)',
              onComplete: resolve,
            });
          }),
        );
      }

      // reel-landed callback after this reel's last row settles
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
