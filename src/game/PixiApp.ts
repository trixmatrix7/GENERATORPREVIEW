// game/PixiApp.ts — the renderer core. Owns the Pixi Application + the 12-layer
// compose stack and runs the animated spin lifecycle off a deterministic Outcome.
// Layer order (back→front): 1 background · 2 reel frame · 3 backdrop+grid ·
// 4 symbols · 6/8 effects · particles · 7/9/10 banners/win-screens. Sound = 11.

import { Application, Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { gsap } from 'gsap';
import { ReelSet } from './ReelSet';
import type { SymbolRenderCtx } from './AnimatedSymbol';
import { AnticipationColumns, orbitScatter, fsSpinOut, fsSpinIn, type OrbitHandle } from './effects';
import { spawnCoinBurst } from './particles';
import { Banners } from './banners';
import { computeLayout, GRIDS, type GridId, type GridLayout } from '../config/gridConfig';
import { HOLD_WIN } from '../config/gameConfig';
import { SymbolId, isScatter } from '../config/symbols';
import { REEL_COUNT } from '../engine/reels';
import type { CanvasTheme } from '../config/canvasTheme';
import type { ThemeSymbol, SoundEventEntry, SpinSystemEntry, WinRevealMode } from '../registries/types';
import type { Registries } from '../registries';
import type { AnimationPreset } from '../registries/presets';
import type { ParamValues } from '../config/adjustableParams';
import type { Outcome, Board, Cell } from '../engine/types';
import type { SoundManager } from '../audio/SoundManager';

export type SoundSet = 'full' | 'minimal' | 'off';

export interface RenderConfig {
  grid: GridId;
  theme: CanvasTheme;
  symbolMeta: Map<number, ThemeSymbol>;
  preset: AnimationPreset;
  params: ParamValues;
  registries: Registries;
  sound: SoundManager;
  spinSystem: SpinSystemEntry;
  winReveal: WinRevealMode;
  soundSet: SoundSet;
  onWinUpdate?: (winX: number) => void;
  onPhase?: (phase: string) => void;
}

// cues kept when the sound set is "minimal"
const MINIMAL_CUES = new Set(['spin-start', 'reel-stop', 'win-small', 'win-normal', 'win-big', 'win-mega', 'free-spin-trigger']);

const PAD = 54;
const TOP = 70;

const sleep = (ms: number) => new Promise<void>((r) => gsap.delayedCall(ms / 1000, r));

export class PixiApp {
  private app = new Application();
  private ready = false;
  private busy = false;
  private token = 0;

  private bgLayer = new Container();
  private frameLayer = new Container();
  private backdropLayer = new Container();
  private reelArea = new Container(); // holds the reel symbols (rotated by FS transition)
  private fxBelow = new Container(); // anticipation columns (below symbols)
  private fxAbove = new Container(); // scatter orbit (above symbols)
  private burstLayer = new Container();
  private overlay = new Container();

  private reels!: ReelSet;
  private banners!: Banners;
  private counter!: Text;
  private layout!: GridLayout;
  private cfg!: RenderConfig;

  private orbits: OrbitHandle[] = [];
  private columns?: AnticipationColumns;

  async init(parent: HTMLElement, cfg: RenderConfig): Promise<void> {
    this.cfg = cfg;
    this.layout = computeLayout(GRIDS[cfg.grid]);
    const { w, h } = this.designSize();
    await this.app.init({
      background: cfg.theme.background,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      width: w,
      height: h,
    });
    parent.appendChild(this.app.canvas);
    this.app.canvas.style.width = '100%';
    this.app.canvas.style.height = '100%';
    this.app.canvas.style.display = 'block';

    this.app.stage.addChild(
      this.bgLayer,
      this.frameLayer,
      this.backdropLayer,
      this.fxBelow,
      this.reelArea,
      this.fxAbove,
      this.burstLayer,
      this.overlay,
    );

    this.reels = new ReelSet(this.layout, this.symbolCtx());
    this.reelArea.addChild(this.reels.symbolsLayer);

    this.counter = new Text({ text: '', style: this.counterStyle() });
    this.counter.anchor.set(0.5, 0);
    this.overlay.addChild(this.counter);

    this.banners = new Banners(this.overlay, this.burstLayer, w, h, cfg.theme);

    this.ready = true;
    this.relayout();
    this.showIdle();
  }

  private designSize(): { w: number; h: number } {
    return { w: this.layout.width + PAD * 2, h: this.layout.height + TOP + PAD };
  }

  private symbolCtx(): SymbolRenderCtx {
    return { cellW: this.layout.cellW, cellH: this.layout.cellH, theme: this.cfg.theme, symbolMeta: this.cfg.symbolMeta };
  }

  private counterStyle(): TextStyleOptions {
    return { fontFamily: 'Poppins, sans-serif', fontStyle: 'italic', fontWeight: '900', fontSize: 34, fill: this.cfg.theme.glow, align: 'center', stroke: { color: 0x000000, width: 3 } };
  }

  // ── layout / decoration ────────────────────────────────────────────────────
  private relayout(): void {
    const { w, h } = this.designSize();
    this.app.renderer.resize(w, h);
    const ox = (w - this.layout.width) / 2;
    const oy = TOP;
    this.reelArea.position.set(ox, oy);
    this.reelArea.pivot.set(0, 0);
    this.reelArea.scale.set(1);
    this.reelArea.rotation = 0;
    this.reelArea.alpha = 1;
    this.fxBelow.position.set(ox, oy);
    this.fxAbove.position.set(ox, oy);
    this.counter.position.set(w / 2, 14);
    this.banners?.resize(w, h);
    this.drawDecoration(ox, oy);
  }

  private drawDecoration(ox: number, oy: number): void {
    const t = this.cfg.theme;
    const { width: gw, height: gh } = this.layout;
    const { w, h } = this.designSize();

    this.bgLayer.removeChildren();
    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill({ color: t.background });
    bg.rect(0, 0, w, h).fill({ color: t.backgroundVignette, alpha: 0.0 });
    // soft vignette frame
    bg.roundRect(8, 8, w - 16, h - 16, 24).stroke({ width: 2, color: t.frameInner, alpha: 0.12 });
    this.bgLayer.addChild(bg);

    this.frameLayer.removeChildren();
    const frame = new Graphics();
    frame.roundRect(ox - 14, oy - 14, gw + 28, gh + 28, 22).fill({ color: t.frame, alpha: 1 });
    frame.roundRect(ox - 14, oy - 14, gw + 28, gh + 28, 22).stroke({ width: 3, color: t.frameInner, alpha: 0.85 });
    this.frameLayer.addChild(frame);

    this.backdropLayer.removeChildren();
    const back = new Graphics();
    back.roundRect(ox - 2, oy - 2, gw + 4, gh + 4, 12).fill({ color: t.reelBackdrop, alpha: t.reelBackdropAlpha });
    // cell grid
    for (let r = 1; r < this.layout.spec.cols; r++) {
      const x = ox + this.layout.reelX(r) - this.layout.cellW * 0 - 2;
      back.rect(x, oy, 1, gh).fill({ color: t.cellGrid, alpha: t.cellGridAlpha });
    }
    for (let row = 1; row < this.layout.spec.rows; row++) {
      const y = oy + this.layout.rowY(row) - 1;
      back.rect(ox, y, gw, 1).fill({ color: t.cellGrid, alpha: t.cellGridAlpha });
    }
    this.backdropLayer.addChild(back);
  }

  // ── config updates ───────────────────────────────────────────────────────
  setConfig(partial: Partial<RenderConfig>): void {
    if (!this.ready) {
      this.cfg = { ...this.cfg, ...partial };
      return;
    }
    const gridChanged = partial.grid && partial.grid !== this.cfg.grid;
    const themeChanged = partial.theme && partial.theme !== this.cfg.theme;
    this.cfg = { ...this.cfg, ...partial };
    if (gridChanged) {
      this.layout = computeLayout(GRIDS[this.cfg.grid]);
      this.reels.rebuild(this.layout, this.symbolCtx());
      this.relayout();
      this.showIdle();
    } else if (themeChanged) {
      this.relayout();
      this.showIdle();
    }
  }

  // ── sound helper ───────────────────────────────────────────────────────────
  private soundAllowed(id: string): boolean {
    if (this.cfg.soundSet === 'off') return false;
    if (this.cfg.soundSet === 'minimal') return MINIMAL_CUES.has(id);
    return true;
  }
  private sfx(id: string, pitchMul = 1): void {
    if (!this.soundAllowed(id)) return;
    const e = this.cfg.registries.soundEvents.find((s) => s.id === id) as SoundEventEntry | undefined;
    if (e && e.implemented) this.cfg.sound.play(e, pitchMul);
  }
  private loop(id: string): void {
    if (!this.soundAllowed(id)) return;
    const e = this.cfg.registries.soundEvents.find((s) => s.id === id) as SoundEventEntry | undefined;
    if (e && e.implemented) this.cfg.sound.startLoop(e);
  }
  private stopLoop(id: string): void {
    this.cfg.sound.stopLoop(id);
  }

  // ── idle / static board ──────────────────────────────────────────────────
  showIdle(): void {
    const rows = this.layout.spec.rows;
    const filler: Board = Array.from({ length: rows }, (_, row) =>
      Array.from({ length: REEL_COUNT }, (_, reel) => ((row + reel) % 7) + 2),
    );
    this.reels.setBoardInstant(filler);
    this.counter.text = '';
  }

  showBoardInstant(o: Outcome): void {
    this.clearAnticipation();
    this.reels.setBoardInstant(o.base.board);
  }

  // ── the full spin ──────────────────────────────────────────────────────────
  async spin(o: Outcome): Promise<void> {
    if (!this.ready) return;
    const my = ++this.token;
    this.busy = true;
    this.clearAnticipation();
    this.overlay.removeChildren();
    this.overlay.addChild(this.counter);
    this.counter.text = '';
    let shownWinX = 0;
    const setWin = (x: number) => {
      shownWinX = x;
      this.counter.text = x > 0 ? `${x.toFixed(2)}× bet` : '';
      this.cfg.onWinUpdate?.(x);
    };

    this.cfg.onPhase?.('spin');
    this.sfx('spin-start');
    this.loop('reel-spin-loop');

    const plan = this.sweatPlan(o.base.board);
    let scattersLanded = 0;

    // spin SYSTEM is overlay (visual): its params seed the drop, sliders override.
    const sp = this.cfg.spinSystem.params ?? {};
    await this.reels.dropBoard(
      o.base.board,
      {
        style: this.cfg.spinSystem.style,
        dropDurationMs: sp.dropDurationMs ?? sp.spinMs ?? sp.fadeMs ?? this.cfg.params.dropDurationMs,
        staggerMs: sp.staggerMs ?? this.cfg.params.dropStaggerMs,
        rowGapMs: sp.rowGapMs ?? 30,
        spinSpeed: this.cfg.params.spinSpeed,
        sweatFromReel: plan.sweatFromReel,
        sweatSlowFactor: this.cfg.params.anticipationSlowFactor,
      },
      (reel) => {
        if (my !== this.token) return;
        this.sfx('reel-stop');
        // landing squash on the reel's cells
        for (let row = 0; row < this.layout.spec.rows; row++) {
          void this.reels.cell(reel, row).playLanding(this.cfg.preset.states.landing, this.cfg.params);
        }
        // scatter landing → anticipation
        const reelScatters = plan.scatterCells.filter((c) => c.reel === reel);
        if (reelScatters.length) {
          this.sfx('scatter-land');
          scattersLanded += reelScatters.length;
          if (scattersLanded >= 2) this.startAnticipation(plan, reel);
          for (const c of reelScatters) {
            if (scattersLanded >= 2 && this.cfg.preset.effects.scatterOrbit) this.addOrbit(c);
            if (scattersLanded >= 2) this.reels.cell(c.reel, c.row).startIdlePulse(this.cfg.preset.states.idle, this.cfg.params);
          }
        }
      },
    );
    if (my !== this.token) return;
    this.stopLoop('reel-spin-loop');

    // near-miss tease: exactly 2 scatters, no trigger
    if (o.base.scatterCount === 2 && !o.freeSpins.triggered) {
      this.sfx('near-miss-tease');
      await sleep(700);
      await this.banners.flashBanner('SO CLOSE!', this.cfg.theme.warmFlash);
    }

    // ── base win reveal (mode = overlay; the wins themselves are SPEC) ──
    this.cfg.onPhase?.('reveal');
    if (o.base.scatterWinX > 0) setWin(shownWinX + o.base.scatterWinX);
    if (this.cfg.winReveal === 'all-at-once') {
      if (o.base.connections.length) {
        const total = o.base.connections.reduce((s, c) => s + c.winX, 0);
        setWin(shownWinX + total);
        this.sfx('win-connect-sound', 1.3);
        const cells = o.base.connections.flatMap((c) => c.cells);
        await Promise.all(cells.map((c) => this.reels.cell(c.reel, c.row).playWin(this.cfg.preset.states.win, this.cfg.params)));
      }
    } else {
      for (let i = 0; i < o.base.connections.length; i++) {
        if (my !== this.token) return;
        const conn = o.base.connections[i];
        this.sfx('win-connect-sound', 1 + i * 0.12);
        setWin(shownWinX + conn.winX);
        await Promise.all(conn.cells.map((c) => this.reels.cell(c.reel, c.row).playWin(this.cfg.preset.states.win, this.cfg.params)));
        await sleep(150);
      }
    }
    if (o.base.connections.length && !o.freeSpins.triggered) {
      this.sfx(o.base.baseWinX >= 10 ? 'win-big' : o.base.baseWinX >= 2 ? 'win-normal' : 'win-small');
    }

    // ── free spins ──
    if (o.freeSpins.triggered) {
      if (my !== this.token) return;
      await this.runFreeSpins(o, my, setWin, () => shownWinX);
    }

    // ── hold & win ──
    if (o.holdWin.triggered) {
      if (my !== this.token) return;
      await this.runHoldAndWin(o, my, setWin, () => shownWinX);
    }

    this.clearAnticipation();

    // ── celebration ──
    if (this.cfg.preset.effects.winScreens && (o.tier === 'big' || o.tier === 'mega')) {
      await this.banners.winScreen(o.tier, o.totalWinX, this.cfg.params.celebrationIntensity);
    }
    setWin(o.totalWinX);
    this.cfg.onPhase?.('idle');
    this.busy = false;
  }

  private async runFreeSpins(o: Outcome, my: number, setWin: (x: number) => void, getWin: () => number): Promise<void> {
    this.sfx('free-spin-trigger');
    spawnCoinBurst(this.burstLayer, { x: this.designSize().w / 2, y: this.designSize().h / 2 }, { count: 40, color: this.cfg.theme.goldFrame });
    this.clearAnticipation();
    await fsSpinOut(this.reelArea, this.layout);
    if (my !== this.token) return;
    await this.banners.fsIntro(o.freeSpins.spins.length || 18, o.freeSpins.multiplier);
    this.relayoutReelAreaAfterTransition();
    await fsSpinIn(this.reelArea);
    if (my !== this.token) return;

    const shown = Math.min(o.freeSpins.spins.length, 10);
    for (let i = 0; i < shown; i++) {
      if (my !== this.token) return;
      const fs = o.freeSpins.spins[i];
      this.reels.setBoardInstant(fs.board);
      for (const cell of this.reels.cellsFlat()) void cell.playLanding(this.cfg.preset.states.landing, this.cfg.params);
      this.sfx('reel-stop');
      if (fs.winX > 0) {
        setWin(getWin() + fs.winX);
        this.sfx('win-connect-sound', 1.2 + i * 0.05);
      }
      await sleep(260 / Math.max(0.5, this.cfg.params.spinSpeed));
    }
    // fold any FS spins beyond the shown montage into the counter at once
    const shownSum = o.freeSpins.spins.slice(0, shown).reduce((s, f) => s + f.winX, 0);
    const rest = o.freeSpins.totalWinX - shownSum;
    if (rest > 0.0001) setWin(getWin() + rest);
    await this.banners.fsOutro(o.freeSpins.totalWinX);
    // restore base board
    this.reels.setBoardInstant(o.base.board);
  }

  private async runHoldAndWin(o: Outcome, my: number, setWin: (x: number) => void, getWin: () => number): Promise<void> {
    this.cfg.onPhase?.('hold-win');
    // place coins on the board
    this.reels.setBoardInstant(o.base.board);
    await this.banners.flashBanner('HOLD & WIN', this.cfg.theme.goldFrame);
    let running = getWin(); // base/FS win accumulated so far
    for (const step of o.holdWin.steps) {
      if (my !== this.token) return;
      for (let k = 0; k < step.landed.length; k++) {
        const c = step.landed[k];
        const cell = this.reels.cell(c.reel, c.row);
        cell.setSymbol(SymbolId.COIN);
        void cell.playWin(this.cfg.preset.states.win, this.cfg.params);
        this.sfx('coin-chime', 1 + Math.min(1, step.values[k] / 10));
        this.spawnValueText(c, step.isJackpot[k] ? `${step.values[k]}×` : `${step.values[k]}`, step.isJackpot[k]);
      }
      running += step.values.reduce((s, v) => s + v, 0);
      setWin(running);
      await sleep(360 / Math.max(0.5, this.cfg.params.spinSpeed));
    }
    if (o.holdWin.grand) {
      await this.banners.flashBanner('GRAND!', 0xffd633);
      running += HOLD_WIN.grandValue;
      setWin(running);
    }
  }

  private spawnValueText(c: Cell, text: string, jackpot: boolean): void {
    const center = this.layout.cellCenter(c.reel, c.row);
    const t = new Text({
      text,
      style: { fontFamily: 'Poppins, sans-serif', fontStyle: 'italic', fontWeight: '900', fontSize: jackpot ? 26 : 20, fill: jackpot ? 0xffd633 : 0xffffff, stroke: { color: 0x000000, width: 3 } },
    });
    t.anchor.set(0.5);
    t.position.set(this.reelArea.x + center.x, this.reelArea.y + center.y);
    this.overlay.addChild(t);
    gsap.timeline({ onComplete: () => t.destroy() })
      .fromTo(t, { alpha: 0 }, { alpha: 1, duration: 0.15 })
      .to(t, { y: t.y - 24, duration: 0.6 }, '<')
      .to(t, { alpha: 0, duration: 0.3 });
  }

  private relayoutReelAreaAfterTransition(): void {
    const { w } = this.designSize();
    const ox = (w - this.layout.width) / 2;
    this.reelArea.pivot.set(0, 0);
    this.reelArea.position.set(ox, TOP);
    this.reelArea.scale.set(1);
  }

  // ── anticipation ───────────────────────────────────────────────────────────
  private sweatPlan(board: Board): { sweatFromReel?: number; scatterCells: Cell[] } {
    const scatterCells: Cell[] = [];
    let count = 0;
    let sweatFromReel: number | undefined;
    for (let reel = 0; reel < REEL_COUNT; reel++) {
      for (let row = 0; row < board.length; row++) {
        if (isScatter(board[row][reel])) {
          scatterCells.push({ reel, row });
          count++;
          if (count === 2 && sweatFromReel === undefined) sweatFromReel = reel + 1;
        }
      }
    }
    if (count < 2) return { scatterCells: [] };
    return { sweatFromReel: sweatFromReel !== undefined && sweatFromReel < REEL_COUNT ? sweatFromReel : undefined, scatterCells };
  }

  private startAnticipation(plan: { sweatFromReel?: number; scatterCells: Cell[] }, fromReel: number): void {
    if (this.cfg.preset.effects.anticipationColumns) {
      if (!this.columns) this.columns = new AnticipationColumns(this.fxBelow, this.layout, this.cfg.theme);
      const pending: number[] = [];
      for (let r = fromReel + 1; r < REEL_COUNT; r++) pending.push(r);
      if (pending.length) this.columns.setPending(pending, pending[0]);
    }
  }

  private addOrbit(c: Cell): void {
    const center = this.layout.cellCenter(c.reel, c.row);
    this.orbits.push(orbitScatter(this.fxAbove, center, this.layout.cellW, this.cfg.theme));
  }

  private clearAnticipation(): void {
    for (const o of this.orbits) o.stop();
    this.orbits = [];
    this.columns?.clear();
    this.columns = undefined;
    for (const cell of this.reels?.cellsFlat() ?? []) cell.stopIdlePulse();
  }

  // ── single-state preview (for the state buttons) ─────────────────────────
  async previewState(state: 'idle' | 'landing' | 'win' | 'reset'): Promise<void> {
    if (!this.ready) return;
    const cells = this.reels.cellsFlat();
    if (state === 'idle') {
      for (const c of cells) c.startIdlePulse(this.cfg.preset.states.idle, this.cfg.params);
      await sleep(2000);
      for (const c of cells) c.stopIdlePulse();
    } else if (state === 'landing') {
      await Promise.all(cells.map((c, i) => sleep(i * 12).then(() => c.playLanding(this.cfg.preset.states.landing, this.cfg.params))));
    } else if (state === 'win') {
      await Promise.all(cells.map((c) => c.playWin(this.cfg.preset.states.win, this.cfg.params)));
    } else {
      for (const c of cells) c.resetWin(this.cfg.preset.states.reset);
    }
  }

  stop(): void {
    this.token++;
    this.busy = false;
    this.clearAnticipation();
    this.cfg.sound.stopAllLoops();
    gsap.globalTimeline.getChildren().forEach((t) => t.progress(1));
  }

  isBusy(): boolean {
    return this.busy;
  }

  destroy(): void {
    this.token++;
    this.clearAnticipation();
    this.cfg?.sound.stopAllLoops();
    this.reels?.destroy();
    try {
      this.app.destroy(true, { children: true });
    } catch {
      /* */
    }
  }
}
