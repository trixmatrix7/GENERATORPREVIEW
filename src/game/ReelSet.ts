// ReelSet — manages all 5 reels as a single unit on the PixiJS stage.
//
// Responsibilities beyond per-reel motion:
//   - Near-miss detection: if the final board has ≥2 scatters on ≥2 different
//     reels, decelerate every reel after the rightmost scatter slower to build
//     anticipation. Intensity scales with scatter count. Display-only — the
//     outcome itself is never altered.
//   - Win-cell highlighting and per-cell state triggers after the reels land.

import { Container, Graphics, Text, TextStyle, Rectangle, Sprite, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { Reel } from './Reel';
import { AnimatedSymbol, SYMBOL_WIDTH, SYMBOL_HEIGHT, SYMBOL_WIN_SHEETS } from './AnimatedSymbol';
import { CELL_HEIGHT, REEL_GAP } from './symbolMetrics';
import { getActiveGrid, type GridConfig } from '@/config/gridConfig';
import { resolveAnchor, cell as cellAnchor, reel as reelAnchor, grid as gridAnchor } from '@/engine/anchors';
import { CANVAS_THEME } from '@/config/canvasTheme';
import { SymbolId, type SymbolIdType } from '@/config/symbols';
import { numToHsl, hexToNum } from '@/config/color';
import { cellBackdropConfig } from '@/config/cellBackdrop';
import { FALLBACK_TIMINGS } from '@/config/symbolAnimations';
import type { WinResult, WinCombination } from '@/engine/WinEvaluator';
import { HW_START_RESPINS, type HwRound } from '@/engine/holdAndWin';
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/engine/GameConfig';
import type { SymbolAtlasMap } from './SymbolAtlasLoader';
import { playWaysLight, clearAllWaysLight, waysLightConfig } from './effects/WaysLightComet';
import { waysImmersiveConfig, danceWinningObject, prefersReducedMotion } from './effects/WaysImmersive';
import { landingImpactConfig } from './effects/LandingImpact';
import { applyStickyWild, clearAllStickyWild, stickyWildConfig, type StickyHandle } from './effects/StickyWildShine';
import type { MechEntry, MechContext } from './effects/mechTypes';
import { getActiveTeasePreset } from './effects/teaseRegistry';
import type { TeaseContext } from './effects/teaseTypes';

/** Cap on the number of reels we apply the near-miss tease to. Each teased
 *  reel after the first compounds its delay and duration. We tease every
 *  pending reel (the client's explicit ask: "one reel after the other of
 *  the ones that are still spinning") — `reelCount - 1` is the safety
 *  ceiling since you can have at most that many pending reels after
 *  detecting the rightmost scatter. Computed per-instance off the active
 *  grid so it scales with 5×5 (V2) and any Stage 3 configurable shape. */
const maxTeasedReelsFor = (reelCount: number) => reelCount - 1;

// Win-decoration palette — a single warm-gold family (no rainbow per-combo
// colours, which read as cheap).
const WIN_FRAME_COLOR = 0xFFF1B0;  // bright gold line core + node dot fill
const WIN_LINE_COLOR = 0xFFC53D;   // warm-gold line underlay + dot ring
const WIN_AMOUNT_COLOR = 0xFFFFFF;  // floating per-combo amount text

/** Total fallback landing tween duration (down + up + settle), in
 *  milliseconds. Used to defer post-landing state changes so the bounce
 *  isn't killed by an immediate state replacement on the same cell. */
const LANDING_TOTAL_DURATION_MS =
  (FALLBACK_TIMINGS.landing.downDuration +
    FALLBACK_TIMINGS.landing.upDuration +
    FALLBACK_TIMINGS.landing.settleDuration) *
  1000;

/** A detected near-miss. Multiple reels can be teased — each one slower
 *  than the previous so the suspense escalates across them. */
interface NearMiss {
  /** Reels to slow down, in landing order (left-to-right). Each subsequent
   *  reel adds more deceleration than the previous one for a "wave of
   *  suspense" effect rather than a single focal slowdown. */
  teasedReels: number[];
  /** Reels where scatter already landed — highlight these during the tease. */
  scatterReels: Array<{ reelIdx: number; row: number }>;
  /** Total scatter count on the board — drives tease intensity scaling.
   *  3+ scatters produce a more dramatic slowdown than 2. */
  scatterCount: number;
}

/**
 * Audio hooks fired by ReelSet at runtime. Set by the React layer after
 * PixiApp init. ReelSet itself does no audio I/O — these are pure callbacks.
 */
export interface ReelSetAudioHooks {
  onReelStopped?: (reelIdx: number) => void;
  onScatterLanded?: (reelIdx: number) => void;
  /** Fires when a reel enters its near-miss slowdown phase, so the React
   *  layer can play a tease sound (rising tone, low rumble, etc.). */
  onNearMissTease?: (reelIdx: number) => void;
  /** Fires once per winning combination during the sequential win reveal, so
   *  the React layer can play a rising-pitch step. `index` is 0-based. */
  onWinStep?: (index: number, total: number) => void;
}

export class ReelSet {
  readonly container: Container;
  private readonly reels: Reel[] = [];
  private readonly clipContainer: Container;
  /** Soft halos behind scatters during a near-miss tease — above the reels,
   *  below the win line. Cleared on spin start / tease end / skip. */
  private readonly teaseGlowContainer: Container;
  private readonly winLinesContainer: Container;
  /** Ways-light comet fx — topmost, self-cleaning per connection. */
  private readonly waysLightContainer: Container = new Container();
  /** Sticky-wild AAA overlays (border + shine), per wild cell. */
  private readonly stickyContainer: Container = new Container();
  /** Wild cells' OWN symbol art, lifted ABOVE the sticky border while it's
   *  applied — the money sack must sit on top of its gold frame, never
   *  under it. Restored with the sticky lifecycle. */
  private readonly stickyObjectsContainer: Container = new Container();
  private stickyLiftedCells: AnimatedSymbol[] = [];
  private stickyHandles: StickyHandle[] = [];
  private lastStickyBoard: number[][] | null = null;
  /** Atlas map — kept so the sticky-wild reveal can render real WILD tiles. */
  private readonly atlases: SymbolAtlasMap;
  /** Extra display objects owned by the sticky-wild reveal (wild tiles +
   *  pop flashes) — destroyed together with the shine handles on clear. */
  private stickyRevealObjects: Container[] = [];
  /** Money-tower art for the expanding-wild showcase (set via PixiApp). */
  private expandWildTexture: Texture | null = null;
  /** Reels currently covered by a full expanding-wild tower. Their cells are
   *  hidden behind the opaque clear-beat + tower art, so EVERY win
   *  presentation (win states, dim/highlight, object lifts, sticky borders)
   *  must skip them — ONLY the tower may show; it pulses as the wild instead.
   *  Cleared with the sticky-reveal lifecycle (next spin / clear). */
  private readonly expandedReels = new Set<number>();
  /** Each expanded reel's tower sprite + rest pose — the win presentation
   *  THUMPS the column (physical motion, no overlay flash) when it pays. */
  private readonly expandedTowerSprites = new Map<number, { spr: Sprite; baseY: number; baseScale: number }>();
  /** The momentary board-dim veil shown during a sticky-wild reveal. */
  private stickyDimVeil: Graphics | null = null;
  /** Tweens owned by the reveal (pop-ins, veil fades), killed on clear. */
  private stickyRevealTweens: gsap.core.Animation[] = [];
  /** Generation counter — bumping it cancels any in-flight staggered reveal. */
  private stickyRevealGen = 0;
  /** Floating per-combo "+amount" labels. Separate from winLinesContainer so a
   *  reveal step can clear the previous frame/line WITHOUT killing amounts that
   *  are still floating up from earlier steps. */
  private readonly winAmountsContainer: Container;
  /** Lifted winning-symbol objects sit here — ABOVE the win line, so the line
   *  renders behind the symbols. */
  private readonly winObjectsContainer: Container;
  /** Symbols whose object layer is currently lifted; restored on clear. */
  private liftedCells: AnimatedSymbol[] = [];
  /** Tweens for win frames/lines, killed when the decoration is cleared. */
  private winFxTweens: gsap.core.Animation[] = [];
  // Hold & Win bonus presentation (lock + auto-respin), drawn over the board.
  private holdWinLayer: Container | null = null;
  private holdWinTweens: gsap.core.Animation[] = [];
  /** Tweens for floating amounts, killed on a new spin / clearHighlights. */
  private winAmountTweens: gsap.core.Animation[] = [];
  private readonly separators: Graphics[] = [];
  private readonly config: GameConfig;
  private readonly grid: GridConfig;
  audioHooks: ReelSetAudioHooks = {};

  // Win-line colours — instance-settable via the chat-config adjustable param
  // 'winLineColor' (default to the module consts; applied on the next win).
  private winLineColor = WIN_LINE_COLOR;
  private winFrameColor = WIN_FRAME_COLOR;

  /** Click-to-edit callback — set by PixiApp; fires with the tapped symbol id. */
  private symbolPickHandler?: (symbolId: number) => void;

  /** Active setTimeouts from the current stopOnStops cycle (near-miss
   *  audio cues + deferred featured-state plays). Cleared on skip / new
   *  spin / start of next stopOnStops so stale cues never fire against
   *  the wrong reel state. */
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  /** Board THUD on reel stop (LandingImpact): the whole board jolts down and
   *  springs back. One tween at a time; base position captured once per
   *  stop cycle and restored on completion AND interrupt (no drift). */
  private thudTween: gsap.core.Timeline | null = null;
  private thudBaseY: number | null = null;

  constructor(
    atlases: SymbolAtlasMap,
    config: GameConfig = DEFAULT_GAME_CONFIG,
    grid: GridConfig = getActiveGrid(),
  ) {
    this.config = config;
    this.grid = grid;
    this.atlases = atlases;
    this.container = new Container();
    this.clipContainer = new Container();
    this.teaseGlowContainer = new Container();
    this.teaseGlowContainer.eventMode = 'none';
    this.winLinesContainer = new Container();
    this.winObjectsContainer = new Container();
    this.winAmountsContainer = new Container();

    // Resolve grid + reel-column bounds via the shared anchor system —
    // every pixel position downstream comes from these rects so 5×3 and
    // 5×5 grids share one positioning path.
    const gridRect = resolveAnchor(gridAnchor, grid);

    for (let i = 0; i < grid.reelCount; i++) {
      const reel = new Reel(atlases, config.reelStrips[i], config.theme, grid.visibleRows);
      reel.container.x = resolveAnchor(reelAnchor(i), grid).x;
      this.clipContainer.addChild(reel.container);
      this.reels.push(reel);
    }

    // Mask extends a couple of pixels beyond the visible grid top + bottom
    // so the buffer symbols don't pop into view at the boundary frames
    // during deceleration. Width matches the grid exactly.
    const MASK_OVERBLEED = 2;
    const mask = new Graphics();
    mask.rect(0, -MASK_OVERBLEED, gridRect.w, gridRect.h + MASK_OVERBLEED * 2);
    mask.fill(0xffffff);
    this.clipContainer.addChild(mask);
    this.clipContainer.mask = mask;

    this.container.addChild(this.clipContainer);
    this.container.addChild(this.teaseGlowContainer);  // tease halos — above reels, below line
    this.container.addChild(this.winLinesContainer);   // line — above tiles, below objects

    // Click-to-edit: tap a board cell → report its symbol id (the studio focuses
    // that symbol's art slot). Inert until setSymbolPickHandler() wires a cb.
    this.container.eventMode = 'static';
    this.container.hitArea = new Rectangle(gridRect.x, gridRect.y, gridRect.w, gridRect.h);
    this.container.on('pointertap', e => {
      if (!this.symbolPickHandler) return;
      const hit = this.cellAt(e.getLocalPosition(this.container));
      if (hit) { hit.cell.playLandBounce(); this.symbolPickHandler(hit.id); } // bounce = visible click feedback
    });
    this.stickyContainer.eventMode = 'none';            // overlays never eat click-to-edit taps
    this.container.addChild(this.stickyContainer);      // sticky-wild overlays — above symbols
    this.stickyObjectsContainer.eventMode = 'none';
    this.container.addChild(this.stickyObjectsContainer); // wild art ABOVE its gold frame
    // The WIN presentation is the FRONTMOST play layer — winners (and their
    // 1.22–1.34× pops, which overhang into neighbouring reels) must render on
    // top of the opaque expanding towers, never get clipped behind them.
    this.container.addChild(this.winObjectsContainer);  // lifted winning objects — above towers
    // Floating amounts above everything: a combo amount whose centroid falls
    // on a tower reel must never be swallowed by the column.
    this.container.addChild(this.winAmountsContainer);  // floating amounts — top
    this.container.addChild(this.waysLightContainer);   // ways-light comet — topmost fx

    // (elevateOverlayLayers() re-homes the four presentation layers above the
    // custom frame art — see PixiApp.buildScene.)
    // scale the comet head to this grid's cell size
    waysLightConfig.cellSize = resolveAnchor(cellAnchor(0, 0), grid).w;

    // Separator at the centre of each inter-reel gap. Anchor gives us the
    // left edge of reel `i`; subtract half the gap to land on the midline.
    for (let i = 1; i < grid.reelCount; i++) {
      const sep = new Graphics();
      const sx = resolveAnchor(reelAnchor(i), grid).x - REEL_GAP / 2;
      sep.rect(sx - 0.5, 0, 1, gridRect.h);
      sep.fill({ color: CANVAS_THEME.modes.dark.separatorColor, alpha: 0.5 });
      this.container.addChild(sep);
      this.separators.push(sep);
    }
  }

  /** Re-home the four PRESENTATION layers (sticky towers, lifted winning
   *  objects, floating amounts, ways-light comet) into `host` — a container
   *  the app positions exactly like this.container but ABOVE the custom
   *  frame art, so win animations are never covered by the frame border.
   *  Children keep their coordinates (host mirrors the reel-set transform). */
  elevateOverlayLayers(host: Container): void {
    // stickyContainer FIRST (under the wild art, per the layer contract) —
    // it holds the expanding towers + their gold shine borders, which must
    // breathe OVER the custom frame border too.
    host.addChild(this.stickyContainer);
    host.addChild(this.stickyObjectsContainer);
    host.addChild(this.winObjectsContainer);
    host.addChild(this.winAmountsContainer);
    host.addChild(this.waysLightContainer);
  }

  get totalWidth(): number {
    return resolveAnchor(gridAnchor, this.grid).w;
  }

  get totalHeight(): number {
    return resolveAnchor(gridAnchor, this.grid).h;
  }

  get cellHeight(): number {
    return CELL_HEIGHT;
  }

  setTheme(theme: 'dark' | 'light') {
    const color = CANVAS_THEME.modes[theme].separatorColor;
    const gridRect = resolveAnchor(gridAnchor, this.grid);
    for (let i = 0; i < this.separators.length; i++) {
      const sep = this.separators[i];
      sep.clear();
      // Separator `i` sits in the gap between reel i and reel i+1; its x
      // is the left edge of reel i+1 minus half the inter-reel gap.
      const sx = resolveAnchor(reelAnchor(i + 1), this.grid).x - REEL_GAP / 2;
      sep.rect(sx - 0.5, 0, 1, gridRect.h);
      sep.fill({ color, alpha: 0.5 });
    }
  }

  startSpin() {
    // A new spin invalidates any post-landing callbacks still pending from
    // the previous one.
    this.clearScheduledCallbacks();
    this.killThud();
    this.clearStickyWilds();
    // Full win-presentation teardown — kills motion tweens, un-lifts objects
    // (they must never float over rolling reels), clears amounts/comets/dims.
    // Matters for the showcase paths (expanding/sticky tests, FS loop) that
    // start rolls without going through PixiApp.spin().
    this.clearHighlights();
    for (const reel of this.reels) reel.startSpin();
  }

  /** AAA sticky-wild treatment on every WILD cell of the settled board.
   *  Visual only (no persist-mechanic — that's engine/contract work). */
  applyStickyWilds(board: number[][]): void {
    this.lastStickyBoard = board;
    this.clearStickyWilds();
    if (!stickyWildConfig.enabled || !board) return;
    for (let row = 0; row < board.length; row++) {
      const cols = board[row];
      if (!cols) continue;
      for (let reel = 0; reel < cols.length; reel++) {
        if (cols[reel] !== SymbolId.WILD) continue;
        const rect = resolveAnchor(cellAnchor(reel, row), this.grid);
        this.stickyHandles.push(applyStickyWild(this.stickyContainer, rect));
        // The wild's own art rides ABOVE its gold frame — lift the object
        // layer over the sticky border (restored with the sticky lifecycle).
        const cell = this.reels[reel]?.getVisibleCell(row);
        if (cell) {
          cell.liftObject(this.stickyObjectsContainer, rect.x + rect.w / 2, rect.y + rect.h / 2);
          this.stickyLiftedCells.push(cell);
        }
      }
    }
  }

  /** Re-apply to the last settled board (used by the live studio toggle).
   *  No-op while expanding towers own the display: lastStickyBoard is stale
   *  there (the trigger board, not what's shown), and the internal clear
   *  would rip the standing towers down mid-display. */
  refreshStickyWilds(): void {
    if (this.expandedReels.size > 0) return;
    if (this.lastStickyBoard) this.applyStickyWilds(this.lastStickyBoard);
  }

  clearStickyWilds(): void {
    // Cancel any staggered reveal still in flight (its pop loop checks the gen).
    this.stickyRevealGen++;
    this.expandedReels.clear();
    this.expandedTowerSprites.clear();
    // Return wild art lifted above its gold frame to the cells.
    for (const c of this.stickyLiftedCells) c.restoreObject();
    this.stickyLiftedCells.length = 0;
    for (const t of this.stickyRevealTweens) t.kill();
    this.stickyRevealTweens = [];
    for (const obj of this.stickyRevealObjects) {
      const disposable = obj as unknown as { dispose?: () => void };
      disposable.dispose?.();
      if (obj.parent) obj.parent.removeChild(obj);
      obj.destroy({ children: true });
    }
    this.stickyRevealObjects = [];
    if (this.stickyDimVeil) {
      if (this.stickyDimVeil.parent) this.stickyDimVeil.parent.removeChild(this.stickyDimVeil);
      this.stickyDimVeil.destroy();
      this.stickyDimVeil = null;
    }
    for (const h of this.stickyHandles) h.destroy();
    this.stickyHandles = [];
    clearAllStickyWild();
  }

  /** OUR sticky-wild showcase reveal. Honours the dev's `sticky-wild` rule
   *  ("wilds remain in place for subsequent spins") as a PURELY VISUAL
   *  treatment — it never rewrites the board or touches math. The screen dims
   *  briefly, 3–25 wilds pop in criss-cross across the grid one after another
   *  (each with the AAA shine), while the reels keep rolling in parallel; the
   *  wilds then stay put until the next spin. Triggered from the test panel. */
  async playStickyWildReveal(
    opts: { isLive?: () => boolean; turbo?: boolean; min?: number; max?: number } = {},
  ): Promise<void> {
    const live = opts.isLive ?? (() => true);
    const gridCells = this.grid.reelCount * this.grid.visibleRows;
    const lo = Math.max(3, Math.min(opts.min ?? 3, gridCells));
    const hi = Math.max(lo, Math.min(opts.max ?? 25, gridCells));
    const count = lo + Math.floor(Math.random() * (hi - lo + 1));

    // Every visible cell, then shuffle → a scattered "criss-cross" pop order.
    const cells: Array<[number, number]> = [];
    for (let row = 0; row < this.grid.visibleRows; row++) {
      for (let reel = 0; reel < this.grid.reelCount; reel++) cells.push([reel, row]);
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const chosen = cells.slice(0, count);

    // Reels roll in parallel. startSpin() clears any prior stickies (and bumps
    // the reveal gen); capture the fresh gen AFTER it so our pops survive.
    this.startSpin();
    const gen = this.stickyRevealGen;

    // Momentary board-dim veil — behind the popping wilds, above the reels.
    const gr = resolveAnchor(gridAnchor, this.grid);
    const veil = new Graphics();
    veil.rect(gr.x - 10, gr.y - 10, gr.w + 20, gr.h + 20).fill({ color: 0x05070d, alpha: 1 });
    veil.alpha = 0;
    veil.eventMode = 'none';
    this.stickyContainer.addChildAt(veil, 0);
    this.stickyDimVeil = veil;
    this.stickyRevealTweens.push(gsap.to(veil, { alpha: 0.44, duration: 0.28, ease: 'power2.out' }));

    // Display-only stops for the parallel spin (the overlays cover the chosen
    // cells, so whatever lands underneath is irrelevant).
    const displayStops = this.config.reelLengths.map(len => Math.floor(Math.random() * len));
    const stagger = opts.turbo ? 45 : 90;

    // Stagger-pop the wilds while the reels are still rolling.
    const popAll = (async () => {
      for (let k = 0; k < chosen.length; k++) {
        await new Promise(res => setTimeout(res, k === 0 ? 260 : stagger));
        if (this.stickyRevealGen !== gen || !live()) return; // cancelled / torn down
        this.popOneStickyWild(chosen[k][0], chosen[k][1]);
      }
    })();

    // Let the reels visibly roll, then settle underneath (parallel to the pops).
    await new Promise(res => setTimeout(res, opts.turbo ? 240 : 520));
    if (this.stickyRevealGen === gen && live()) await this.stopOnStops(displayStops, !!opts.turbo);
    await popAll;

    // The dimming was momentary — ease it back out, leaving the wilds lit.
    if (this.stickyRevealGen === gen && this.stickyDimVeil) {
      const v = this.stickyDimVeil;
      this.stickyRevealTweens.push(
        gsap.to(v, {
          alpha: 0,
          duration: 0.5,
          ease: 'power2.inOut',
          onComplete: () => {
            if (v.parent) v.parent.removeChild(v);
            v.destroy();
            if (this.stickyDimVeil === v) this.stickyDimVeil = null;
          },
        }),
      );
    }
  }

  /** Pop a single wild into a cell: an OPAQUE premium panel (so the still-
   *  spinning reel never shows through) + the real WILD tile art both grow in
   *  from the centre with a soft flash, and the AAA shine is layered on top. */
  private popOneStickyWild(reel: number, row: number, withShine = true): void {
    const rect = resolveAnchor(cellAnchor(reel, row), this.grid);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const rad = Math.min(rect.w, rect.h) * 0.16;
    // Common pop: scale 0 → overshoot → settle, from the cell centre.
    const popScale = (target: Container, to: { x: number; y: number }) => {
      const tl = gsap.timeline();
      tl.to(target, { alpha: 1, duration: 0.12, ease: 'power1.out' }, 0);
      tl.to(target.scale, { x: to.x * 1.18, y: to.y * 1.18, duration: 0.16, ease: 'back.out(3)' }, 0);
      tl.to(target.scale, { x: to.x, y: to.y, duration: 0.18, ease: 'power2.out' }, 0.16);
      this.stickyRevealTweens.push(tl);
    };

    // OPAQUE backing panel — hides whatever is rolling on the reel beneath, so
    // nothing "spins through" the locked wild. Dark base + faint top sheen for
    // depth; sits directly under the wild art.
    const back = new Graphics();
    back.roundRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h, rad).fill({ color: 0x0b0d14, alpha: 1 });
    back.roundRect(-rect.w / 2 + 3, -rect.h / 2 + 3, rect.w - 6, rect.h * 0.44, rad * 0.8).fill({ color: 0xffffff, alpha: 0.05 });
    back.position.set(cx, cy);
    back.eventMode = 'none';
    back.scale.set(0);
    back.alpha = 0;
    this.stickyContainer.addChild(back);
    this.stickyRevealObjects.push(back);
    popScale(back, { x: 1, y: 1 });

    // Real wild tile (matches on-reel art), centred so it pops from the middle.
    // Enlarge the wild object within the cell — the default art reads too small.
    const tile = new AnimatedSymbol(this.atlases, this.config.theme);
    tile.setSymbol(SymbolId.WILD);
    tile.enlargeObject(1.12); // slight extra emphasis on top of the global symbol-size preset
    tile.eventMode = 'none';
    tile.pivot.set(SYMBOL_WIDTH / 2, SYMBOL_HEIGHT / 2);
    tile.position.set(cx, cy);
    const sx = rect.w / SYMBOL_WIDTH;
    const sy = rect.h / SYMBOL_HEIGHT;
    tile.scale.set(0);
    tile.alpha = 0;
    this.stickyContainer.addChild(tile);
    this.stickyRevealObjects.push(tile);
    popScale(tile, { x: sx, y: sy });

    // AAA shine border on top (its own pop-in + calm breath live in the effect).
    // Skipped for the expanding-wild landing pop: the CELL-sized shine would
    // peek out behind the (slightly narrower) column art — the reel-sized
    // shine at lock-in is the only border there.
    if (withShine) this.stickyHandles.push(applyStickyWild(this.stickyContainer, rect));

    // A quick additive flash sells the "lock-in" moment, then self-clears.
    const flash = new Graphics();
    flash
      .roundRect(rect.x, rect.y, rect.w, rect.h, Math.min(rect.w, rect.h) * 0.16)
      .fill({ color: 0xffffff, alpha: 0.55 });
    flash.blendMode = 'add';
    flash.alpha = 0;
    flash.eventMode = 'none';
    this.stickyContainer.addChild(flash);
    this.stickyRevealObjects.push(flash);
    this.stickyRevealTweens.push(
      gsap
        .timeline()
        .to(flash, { alpha: 0.6, duration: 0.08, ease: 'power2.out' })
        .to(flash, {
          alpha: 0,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: () => {
            if (flash.parent) flash.parent.removeChild(flash);
          },
        }),
    );
  }

  /** Art for the expanding-wild column (null → effect falls back to a flat
   *  panel; normally the Vice money tower). */
  setExpandingWildTexture(tex: Texture | null): void {
    this.expandWildTexture = tex;
  }

  /** Run a mechanic showcase (see mechTypes.ts). Overlays/tweens ride the
   *  sticky-reveal lifecycle → the next spin clears everything. */
  async runMechanic(entry: MechEntry): Promise<void> {
    this.startSpin(); // clears prior showcases + bumps the generation
    const gen = this.stickyRevealGen;
    // settle immediately so mechanics start from a fresh visible board
    const stops = this.config.reelLengths.map(len => Math.floor(Math.random() * len));
    await new Promise(res => setTimeout(res, 350));
    if (this.stickyRevealGen !== gen) return;
    await this.stopOnStops(stops, true);
    if (this.stickyRevealGen !== gen) return;

    const overlay = new Container();
    overlay.eventMode = 'none';
    this.stickyContainer.addChild(overlay);
    this.stickyRevealObjects.push(overlay);
    let veil: Graphics | null = null;

    const ctx: MechContext = {
      overlay,
      grid: { reels: this.grid.reelCount, rows: this.grid.visibleRows },
      cellRect: (reel, row) => resolveAnchor(cellAnchor(reel, row), this.grid),
      reelRect: (reel) => resolveAnchor(reelAnchor(reel), this.grid),
      gridRect: () => resolveAnchor(gridAnchor, this.grid),
      spawnTile: (symbolId, reel, row, withShine = false) => {
        const rect = resolveAnchor(cellAnchor(reel, row), this.grid);
        const tileWrap = new Container();
        tileWrap.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
        const back = new Graphics();
        back.roundRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h, Math.min(rect.w, rect.h) * 0.16)
          .fill({ color: 0x0b0d14, alpha: 1 });
        tileWrap.addChild(back);
        const tile = new AnimatedSymbol(this.atlases, this.config.theme);
        tile.setSymbol(symbolId as SymbolIdType);
        tile.eventMode = 'none';
        tile.pivot.set(SYMBOL_WIDTH / 2, SYMBOL_HEIGHT / 2);
        tile.scale.set(rect.w / SYMBOL_WIDTH, rect.h / SYMBOL_HEIGHT);
        tileWrap.addChild(tile);
        tileWrap.scale.set(0);
        overlay.addChild(tileWrap);
        this.stickyRevealTweens.push(
          gsap.timeline()
            .to(tileWrap.scale, { x: 1.16, y: 1.16, duration: 0.16, ease: 'back.out(3)' })
            .to(tileWrap.scale, { x: 1, y: 1, duration: 0.16, ease: 'power2.out' }),
        );
        if (withShine) this.stickyHandles.push(applyStickyWild(overlay, rect));
        return tileWrap;
      },
      setCellSymbol: (reel, row, symbolId) => {
        this.reels[reel]?.getVisibleCell(row)?.setSymbol(symbolId as SymbolIdType);
      },
      getCellSymbol: (reel, row) => this.reels[reel]?.getVisibleCell(row)?.symbol ?? 0,
      playCellState: (reel, row, state) => {
        this.reels[reel]?.getVisibleCell(row)?.play(state);
      },
      rollAndSettle: async () => {
        if (this.stickyRevealGen !== gen) return;
        const s = this.config.reelLengths.map(len => Math.floor(Math.random() * len));
        this.startSpinKeepShowcase();
        await new Promise(res => setTimeout(res, 420));
        if (this.stickyRevealGen !== gen) return;
        await this.stopOnStops(s, true);
      },
      dimBoard: (alpha = 0.5) => {
        if (veil) return;
        const gr = resolveAnchor(gridAnchor, this.grid);
        veil = new Graphics();
        veil.rect(gr.x - 10, gr.y - 10, gr.w + 20, gr.h + 20).fill({ color: 0x05070d, alpha: 1 });
        veil.alpha = 0;
        veil.eventMode = 'none';
        this.stickyContainer.addChildAt(veil, 0);
        this.stickyRevealObjects.push(veil);
        this.stickyRevealTweens.push(gsap.to(veil, { alpha, duration: 0.25, ease: 'power2.out' }));
      },
      undimBoard: () => {
        if (!veil) return;
        const v = veil; veil = null;
        this.stickyRevealTweens.push(gsap.to(v, { alpha: 0, duration: 0.35, ease: 'power2.inOut' }));
      },
      accent: this.config.theme.accent,
      gold: 0xFFC53D,
      gsap,
      track: <T extends { kill(): void }>(t: T): T => { this.stickyRevealTweens.push(t as unknown as gsap.core.Animation); return t; },
      rand: (min, max) => min + Math.random() * (max - min),
      pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
      alive: () => this.stickyRevealGen === gen,
    };
    try { await entry.run(ctx); } catch (err) { console.warn('[ReelSet] mechanic failed:', entry.id, err); }
  }

  /** startSpin WITHOUT clearing the sticky/mechanic overlays (used by
   *  mechanics that re-roll the reels mid-choreography). */
  private startSpinKeepShowcase(): void {
    for (const reel of this.reels) reel.startSpin();
  }

  /** The currently VISIBLE board as symbol ids, board[row][reel] — read from
   *  the settled cells (display truth, not outcome data). */
  getVisibleBoard(): number[][] {
    const rows = this.grid.visibleRows;
    const board: number[][] = [];
    for (let row = 0; row < rows; row++) {
      const r: number[] = [];
      for (let reel = 0; reel < this.grid.reelCount; reel++) {
        r.push(this.reels[reel]?.getVisibleCell(row)?.symbol ?? 0);
      }
      board.push(r);
    }
    return board;
  }

  /** OUR expanding-wild showcase — Gift-Bonanza choreography on the Vice
   *  money-tower art: the reels roll and settle, a wild LANDS on 1–2 random
   *  reels, a clear-beat blanks that reel's other symbols, then the money
   *  column races out of the landing cell (both directions), locks in with an
   *  impact flash + the AAA shine border, and stays until the next spin.
   *  Purely visual — never rewrites the board or the math.
   *
   *  `sticky` mode (the 4-scatter bonus): towers from previous spins STAY —
   *  only the uncovered reels roll, and a new tower grows wherever a money
   *  sack NATURALLY lands in the settling window (no forced landings — the
   *  organic strip probability paces the fill-up). Returns ALL expanded reels
   *  (old + new) so the caller evaluates the full sticky board. */
  async playExpandingWildReveal(
    opts: { isLive?: () => boolean; turbo?: boolean; sticky?: boolean; force?: boolean } = {},
  ): Promise<number[]> {
    const live = opts.isLive ?? (() => true);

    // Candidate reels = those whose strip actually carries a WILD (reel 0 has
    // none by design). 1–3 of them get chosen; each chosen reel's display stop
    // is picked so a money sack VISIBLY lands, and the expansion starts from
    // exactly that cell — never from a freshly spawned position.
    const rows = this.grid.visibleRows;
    const findWildStop = (reel: number): { stop: number; row: number } | null => {
      const strip = this.config.reelStrips[reel];
      const len = this.config.reelLengths[reel];
      const start = Math.floor(Math.random() * len);
      for (let k = 0; k < len; k++) {
        const stop = (start + k) % len;
        for (let row = 0; row < rows; row++) {
          if (strip[(stop + row) % len] === SymbolId.WILD) return { stop, row };
        }
      }
      return null;
    };
    const wildRowInWindow = (reel: number, stop: number): number | null => {
      const strip = this.config.reelStrips[reel];
      const len = this.config.reelLengths[reel];
      for (let row = 0; row < rows; row++) {
        if (strip[(stop + row) % len] === SymbolId.WILD) return row;
      }
      return null;
    };
    const reelIdxs = Array.from({ length: this.grid.reelCount }, (_, i) => i)
      .filter(r => this.config.reelStrips[r].includes(SymbolId.WILD) && !this.expandedReels.has(r));

    let chosen: number[];
    let gen: number;
    const displayStops = this.config.reelLengths.map(len => Math.floor(Math.random() * len));
    const landingRows: number[] = [];

    if (opts.sticky) {
      // Keep standing towers; only presentation state clears. Spinning the
      // covered reels too is harmless — they're fully hidden.
      this.clearScheduledCallbacks();
      this.killThud();
      this.clearHighlights();
      this.startSpinKeepShowcase();
      gen = this.stickyRevealGen;
      // New towers grow ONLY where the settling window naturally shows a
      // sack — organic pacing, some spins add none. Capped: the first
      // `stickyTowerCap` wild reels of the ROUND become towers (leftmost
      // first, same rule as the math/mock); later wilds stay 1:1 wilds.
      const cap = (this.config as unknown as { stickyTowerCap?: number }).stickyTowerCap ?? 2;
      chosen = [];
      for (const r of reelIdxs.sort((a, b) => a - b)) {
        if (this.expandedReels.size + chosen.length >= cap) break;
        const hitRow = wildRowInWindow(r, displayStops[r]);
        if (hitRow !== null) { chosen.push(r); landingRows.push(hitRow); }
      }
    } else if (opts.force) {
      // SHOWCASE (test button): guarantee 1-3 towers — each chosen reel's
      // stop is picked so a sack visibly lands.
      for (let i = reelIdxs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [reelIdxs[i], reelIdxs[j]] = [reelIdxs[j], reelIdxs[i]];
      }
      chosen = reelIdxs.slice(0, Math.min(reelIdxs.length, 1 + Math.floor(Math.random() * 3))).sort((a, b) => a - b);
      if (chosen.length === 0) return [];

      // Roll + settle first (display-only stops; the columns cover the reels).
      this.startSpin();
      gen = this.stickyRevealGen;
      for (const reel of chosen) {
        const hit = findWildStop(reel);
        if (!hit) { landingRows.push(Math.floor(Math.random() * rows)); continue; }
        displayStops[reel] = hit.stop; // the sack visibly lands at this exact cell
        landingRows.push(hit.row);
      }
    } else {
      // LIVE 3-scatter FS spin: ORGANIC — the spin always rolls, and reels
      // expand exactly where the settling window naturally shows a sack.
      // With rare wilds most spins expand nothing; the plain board still
      // pays its natural connections. That's the volatility.
      this.startSpin();
      gen = this.stickyRevealGen;
      chosen = reelIdxs.filter(r => wildRowInWindow(r, displayStops[r]) !== null).sort((a, b) => a - b);
      for (const reel of chosen) landingRows.push(wildRowInWindow(reel, displayStops[reel])!);
    }

    const allExpanded = () => Array.from(this.expandedReels).sort((a, b) => a - b);
    await new Promise(res => setTimeout(res, opts.turbo ? 240 : 520));
    if (this.stickyRevealGen !== gen || !live()) return opts.sticky ? allExpanded() : [];
    await this.stopOnStops(displayStops, !!opts.turbo);

    // Sequential, one reel finishing before the next starts (like the ref).
    for (let k = 0; k < chosen.length; k++) {
      if (this.stickyRevealGen !== gen || !live()) return opts.sticky ? allExpanded() : [];
      await this.expandOneWildReel(chosen[k], landingRows[k], !!opts.turbo);
      await new Promise(res => setTimeout(res, opts.turbo ? 90 : 200));
    }
    if (this.stickyRevealGen !== gen || !live()) return opts.sticky ? allExpanded() : [];
    if (opts.sticky) return allExpanded();

    // (The synthetic ways-beat comet is GONE — it drew a path through random
    // cells of the in-between reels, visually "connecting" different symbols.
    // Real connections are presented by the callers: they evaluate the board
    // with the dev's WinEvaluator and run the standard per-combo win lines —
    // only same-symbol ways, wilds substituting, exactly like the math.)
    return chosen;
  }

  /** One reel's expansion: wild pops in its landing cell → the reel's other
   *  symbols vanish under an opaque clear-beat → the money column grows out of
   *  the landing cell to full reel height (masked to the reel) → impact flash
   *  + reel-sized AAA shine border. All overlays ride the sticky-reveal
   *  lifecycle, so the next spin clears everything. */
  private expandOneWildReel(reelIdx: number, row: number, turbo: boolean): Promise<void> {
    return new Promise(resolve => {
      // From here on the reel belongs to the tower — its cells are excluded
      // from every win presentation until the sticky lifecycle clears.
      this.expandedReels.add(reelIdx);
      const rr = resolveAnchor(reelAnchor(reelIdx), this.grid);
      const cellR = resolveAnchor(cellAnchor(reelIdx, row), this.grid);
      const cx = rr.x + rr.w / 2;
      const speed = turbo ? 0.6 : 1;
      const rad = 14;

      // 1) the wild LANDS — reuse the sticky pop (backing + money-stack tile
      //    + flash) WITHOUT the cell shine (the reel-sized shine at lock-in
      //    is the column's only border — no 1:1 edges peeking behind it).
      this.popOneStickyWild(reelIdx, row, false);


      // 2) clear-beat — FULLY opaque panel over the reel so no symbol shows
      //    behind the column, neither while it races out nor afterwards
      //    (win sheets/pops on covered cells are also skipped via
      //    expandedReels — only the tower may show).
      const clear = new Graphics();
      clear.roundRect(rr.x, rr.y, rr.w, rr.h, rad).fill({ color: 0x0b0d14, alpha: 1 });
      clear.alpha = 0;
      clear.eventMode = 'none';
      this.stickyContainer.addChild(clear);
      this.stickyRevealObjects.push(clear);

      // 3) the column — IDENTICAL on every reel: width-fit, tower TOP aligned
      //    with the reel top (the head always shows; only the stack base may
      //    crop at the bottom). The art never stretches or shifts — the grow
      //    is a REVEAL MASK expanding from the landing cell in both directions.
      const tex = this.expandWildTexture ?? Texture.WHITE;
      const spr = new Sprite(tex);
      spr.anchor.set(0.5, 0);
      spr.position.set(cx, rr.y);
      spr.scale.set((rr.w * 0.98) / tex.width);
      spr.alpha = 0;
      spr.eventMode = 'none';
      const mask = new Graphics();
      mask.eventMode = 'none';
      const drawReveal = (t: number) => {
        const topY = cellR.y + (rr.y - cellR.y) * t;
        const botY = (cellR.y + cellR.h) + ((rr.y + rr.h) - (cellR.y + cellR.h)) * t;
        mask.clear();
        mask.roundRect(rr.x - 1, topY, rr.w + 2, botY - topY, rad).fill(0xffffff);
      };
      drawReveal(0); // starts as exactly the landing cell
      this.stickyContainer.addChild(mask);
      spr.mask = mask;
      this.stickyContainer.addChild(spr);
      this.stickyRevealObjects.push(mask, spr);
      this.expandedTowerSprites.set(reelIdx, { spr, baseY: rr.y, baseScale: spr.scale.x });

      // 4) impact flash at full extension.
      const flash = new Graphics();
      flash.roundRect(rr.x, rr.y, rr.w, rr.h, rad).fill({ color: 0xffffff, alpha: 0.5 });
      flash.blendMode = 'add';
      flash.alpha = 0;
      flash.eventMode = 'none';
      this.stickyContainer.addChild(flash);
      this.stickyRevealObjects.push(flash);

      // Choreography: land-beat → clear → the column RACES out (expo.inOut:
      // gathers momentum, then glides into place — no hard snap) → LOCK-IN
      // with real weight: the tower squash-settles like mass landing, an
      // impact flash washes the column, the whole BOARD slams (landing-thud
      // with the hard elastic settle), and the shine border ignites.
      const baseScale = spr.scale.x;
      const tl = gsap.timeline({ onComplete: resolve });
      this.stickyRevealTweens.push(tl);
      const T_CLEAR = 0.32 * speed;
      const T_RACE = 0.40 * speed;
      const T_LOCK = T_RACE + 0.46 * speed;
      tl.to(clear, { alpha: 1, duration: 0.12 * speed, ease: 'power2.out' }, T_CLEAR);
      tl.to(spr, { alpha: 1, duration: 0.07 * speed, ease: 'power1.out' }, T_RACE - 0.02 * speed);
      const reveal = { t: 0 };
      tl.to(reveal, {
        t: 1, duration: 0.46 * speed, ease: 'expo.inOut',
        onUpdate: () => drawReveal(reveal.t),
      }, T_RACE);
      // LOCK-IN — squash-settle: the column compresses under its own weight
      // and springs back (top-anchored, so it visibly sits down).
      tl.to(spr, { y: rr.y + 6, duration: 0.08 * speed, ease: 'power3.out' }, T_LOCK);
      tl.to(spr.scale, { y: baseScale * 0.972, duration: 0.08 * speed, ease: 'power3.out' }, T_LOCK);
      tl.to(spr, { y: rr.y, duration: 0.55 * speed, ease: 'elastic.out(1, 0.4)' }, T_LOCK + 0.08 * speed);
      tl.to(spr.scale, { y: baseScale, duration: 0.55 * speed, ease: 'elastic.out(1, 0.4)' }, T_LOCK + 0.08 * speed);
      // Impact flash — brighter, faster decay: a hit, not a glow.
      tl.to(flash, { alpha: 0.7, duration: 0.05 * speed, ease: 'power2.out' }, T_LOCK);
      tl.to(flash, {
        alpha: 0, duration: 0.26 * speed, ease: 'power2.in',
        onComplete: () => { if (flash.parent) flash.parent.removeChild(flash); },
      }, T_LOCK + 0.05 * speed);
      // The board itself takes the hit (hard landing-thud slam).
      tl.call(() => { this.playLandingThud(this.grid.reelCount - 1); }, undefined, T_LOCK);
      // AAA shine border around the whole reel at lock-in.
      tl.call(() => { this.stickyHandles.push(applyStickyWild(this.stickyContainer, rr)); }, undefined, T_LOCK);
      // Hand control back just after the impact — the elastic settle plays
      // out on its own so multi-tower sequences keep their pace.
      tl.call(() => resolve(), undefined, T_LOCK + 0.16 * speed);
      // Once the settle has run out, the tower starts BREATHING (idle life
      // while it stands).
      tl.call(() => this.startTowerIdle(reelIdx), undefined, T_LOCK + 0.68 * speed);
    });
  }

  /** Schedule a callback that can be cancelled together with all others
   *  via clearScheduledCallbacks(). Used for near-miss audio cues and the
   *  deferred featured-state plays — both must die if the spin is
   *  interrupted. */
  private schedule(fn: () => void, delayMs: number): void {
    const handle = setTimeout(() => {
      const idx = this.pendingTimeouts.indexOf(handle);
      if (idx >= 0) this.pendingTimeouts.splice(idx, 1);
      fn();
    }, Math.max(0, delayMs));
    this.pendingTimeouts.push(handle);
  }

  private clearScheduledCallbacks(): void {
    for (const handle of this.pendingTimeouts) clearTimeout(handle);
    this.pendingTimeouts.length = 0;
  }

  async stopOnStops(stops: number[], fast = false, forceTease = false): Promise<void> {
    // Defensive: any timeouts left over from an interrupted previous stop
    // should never fire against the current reel state.
    this.clearScheduledCallbacks();
    this.clearTeaseGlow();

    // Near-miss tease is gated by the build's 'near-miss-tease' feature
    // (config.nearMissTease === false disables it; undefined = on for V1).
    const teaseOff = !forceTease && this.config.nearMissTease === false;
    const nearMiss = (fast || teaseOff) ? null : this.detectNearMiss(stops);

    // Build a map: reelIdx → rows to feature, so we can apply the 'featured'
    // state *after* each scatter reel actually lands. Applying it before the
    // reels stop targeted whatever symbols were scrolling past, not the final
    // scatters — that was the reason near-miss tease was invisible to users.
    // Uses an array per reel so multiple scatters on the same reel (common on
    // 5×5 grids) all get the featured glow, not just the last one.
    const scatterRowsByReel = new Map<number, number[]>();
    if (nearMiss) {
      for (const { reelIdx, row } of nearMiss.scatterReels) {
        const arr = scatterRowsByReel.get(reelIdx);
        if (arr) arr.push(row);
        else scatterRowsByReel.set(reelIdx, [row]);
      }
    }

    // Map each teased reel to its position in the tease sequence (0 = first
    // teased, 1 = second, etc.) so we can apply progressive deceleration —
    // each subsequent reel adds more drama than the one before, creating a
    // wave of suspense across the remaining reels rather than a single focal
    // slowdown on just the last reel.
    const teaseOrder = new Map<number, number>();
    // SEQUENTIAL GATES: the FIRST gate arms the moment the 2nd scatter
    // VISIBLY lands (never at spin start — that would telegraph the tease);
    // every further gate arms when the previous teased reel has landed.
    // Both transitions live in the post-stop hook below.
    let landedScatterReels = 0;
    if (nearMiss) {
      nearMiss.teasedReels.forEach((reelIdx, position) => teaseOrder.set(reelIdx, position));
    }

    const stopPromises = this.reels.map((reel, i) => {
      const stopPromise = (() => {
        if (fast) return reel.stopOn(stops[i], 0, true);

        // Per-reel stop stagger — a deliberate left-to-right cascade that
        // still reads like a real slot. Tightened (0.22 → 0.15) with the
        // shorter decel below: click→drop was too slow (the roll only has
        // to mask the on-chain settle, not stretch past it).
        const baseDelay = i * 0.15;
        const teaseIdx = teaseOrder.get(i);
        if (teaseIdx !== undefined) {
          // Progressive tease: each subsequent reel adds another full
          // tease-extra-duration on top of its base. Intensity scales with
          // scatter count — 3+ scatters get a 1.4× longer slowdown so the
          // player feels the escalating probability of triggering the bonus.
          const intensityScale = nearMiss!.scatterCount >= 3 ? 1.4 : 1.0;
          const extra = FALLBACK_TIMINGS.nearMiss.extraDuration * (teaseIdx + 1) * intensityScale;
          const teaseDelay = baseDelay + FALLBACK_TIMINGS.nearMiss.teasePause * (teaseIdx + 1);
          // Fire the tease audio cue when the slowdown becomes visible —
          // at the tease delay, not the base delay. The old code fired at
          // baseDelay which was before the reel even started decelerating.
          if (this.audioHooks.onNearMissTease) {
            const idx = i;
            this.schedule(
              () => this.audioHooks.onNearMissTease?.(idx),
              teaseDelay * 1000,
            );
          }
          return reel.stopOn(
            stops[i],
            teaseDelay,
            false,
            1.4 + extra, // base matches the normal-stop decel length in Reel.stopOn
            true, // isTeased — triggers landing bounce on all symbols
          );
        }
        // Shorter normal-stop decel (1.4s default → 1.0s) via the existing
        // override param — Reel.ts stays byte-identical. Teased reels above
        // keep their long anticipation ladder.
        return reel.stopOn(stops[i], baseDelay, false, 1.0);
      })();

      // Fire audio + featured-state callbacks once this reel has actually
      // landed. Wrap with .catch so a single reel failure doesn't take down
      // Promise.all and leave the post-stop cleanup unrun.
      return stopPromise
        .then(() => {
          if (!fast) this.playLandingThud(i); // board jolt — the stop has weight
          this.audioHooks.onReelStopped?.(i);
          if (this.reelHasVisibleScatter(i, stops[i])) {
            this.audioHooks.onScatterLanded?.(i);
            // The 2nd VISIBLE scatter opens the chain: arm the first gate.
            landedScatterReels++;
            if (nearMiss && landedScatterReels === 2 && nearMiss.teasedReels.length > 0) {
              this.teasePendingReel(nearMiss.teasedReels[0], 0);
            }
          }
          // Sequential tease: this teased reel just LANDED → arm the next
          // gate in the chain (one reel after the other, never all at once).
          const tPos = teaseOrder.get(i);
          if (nearMiss && tPos !== undefined) {
            const nextReel = nearMiss.teasedReels[tPos + 1];
            if (nextReel !== undefined) this.teasePendingReel(nextReel, tPos + 1);
          }
          // Defer featured state until the landing tween for this reel's
          // scatter cells has had time to finish — otherwise the immediate
          // play('featured') kills the bounce that signals "scatter just
          // landed!" before any frames render.
          const featuredRows = scatterRowsByReel.get(i);
          if (featuredRows) {
            const reelIdx = i;
            for (const row of featuredRows) {
              this.schedule(
                () => {
                  this.reels[reelIdx].playFeaturedOnVisibleRow(row);
                  this.addTeaseGlow(reelIdx, row);
                },
                LANDING_TOTAL_DURATION_MS,
              );
            }
          }
        })
        .catch(err => {
          console.warn(`[ReelSet] reel ${i} stop failed, skipping post-stop callbacks:`, err);
        });
    });
    await Promise.all(stopPromises);

    // Hold the featured glow briefly after the last teased reel lands so
    // the transition feels smooth rather than an abrupt snap. Without this
    // delay the glow vanishes the instant Promise.all resolves.
    if (nearMiss) {
      await new Promise<void>(resolve => {
        this.schedule(resolve, 400);
      });
      for (const { reelIdx, row } of nearMiss.scatterReels) {
        this.reels[reelIdx].clearStateOnRow(row);
      }
      this.clearTeaseGlow();
    }
  }

  skipSpin() {
    // A skipped spin must not allow scheduled audio cues or featured-state
    // plays from this round to fire against whatever the next reel state is.
    this.clearScheduledCallbacks();
    this.killThud();
    this.clearTeaseGlow();
    for (const reel of this.reels) reel.cancelSpin();
  }

  snapToStops(stops: number[]) {
    for (let i = 0; i < this.grid.reelCount; i++) {
      this.reels[i].snapTo(stops[i]);
    }
  }

  /** Light EVERY winning cell and draw all frame decorations at once. Used for
   *  single-combo wins and as the final "all lit" state after a sequential
   *  multi-combo reveal. */
  highlightWins(winResult: WinResult) {
    // Same order as revealCombo: kill motion tweens while objects are lifted.
    this.clearWinLines();
    this.restoreLiftedObjects();
    const allCells: Array<[number, number]> = [];
    for (const combo of winResult.combinations) {
      for (const c of combo.cells) allCells.push(c);
    }
    this.applyCellHighlight(allCells);
    this.buildDecoration(winResult.combinations);
    this.liftWinningObjects(allCells);
    // Finale detonation: every winner bursts in one left→right wave.
    this.playImmersiveReveal(winResult.combinations, true);
    // ways-light comet through the winning connections — LINE BY LINE (each
    // combo's comet runs through, then the next), matching the original.
    // (No-ops while the ways-immersive presentation owns the win.)
    void this.fireWaysLightSequential(winResult.combinations);
  }

  /** Reveal ONE combination: dim everything else, light this combo's cells,
   *  draw its glowing frames + faint guide line, and float its amount above it.
   *  PixiApp calls this in sequence for the one-by-one win presentation. */
  /** Set the reel roll-speed multiplier (chat-config 'reelSpeed') on every
   *  reel. Animation only — never changes the landed outcome. */
  setReelSpeed(mul: number): void {
    for (const reel of this.reels) reel.setSpeedMul(mul);
  }

  /** Wire the click-to-edit handler. A cb enables the board's pointer cursor. */
  setSymbolPickHandler(cb?: (symbolId: number) => void): void {
    this.symbolPickHandler = cb;
    this.container.cursor = cb ? 'pointer' : 'default';
  }

  /** Symbol id at a point in this.container's local space, or null if the point
   *  isn't over a visible cell. Uses the shared anchor rects so it tracks any
   *  grid shape. */
  private cellAt(p: { x: number; y: number }): { id: number; cell: AnimatedSymbol } | null {
    for (let reel = 0; reel < this.grid.reelCount; reel++) {
      for (let row = 0; row < this.grid.visibleRows; row++) {
        const r = resolveAnchor(cellAnchor(reel, row), this.grid);
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          const cell = this.reels[reel].getVisibleCell(row);
          return cell ? { id: cell.symbol, cell } : null;
        }
      }
    }
    return null;
  }

  /** Set the win-line colours (chat-config 'winLineColor'); applied on the
   *  next win reveal. `line` = core/underlay, `frame` = bright core + dots. */
  setWinColors(line: number, frame: number): void {
    this.winLineColor = line;
    this.winFrameColor = frame;
  }

  revealCombo(combo: WinCombination, amountText?: string) {
    // Kill motion tweens FIRST (their interrupt-restore writes lifted-space
    // poses), THEN un-lift the previous combo's objects.
    this.clearWinLines();                 // clear the previous combo's fx
    this.restoreLiftedObjects();          // return the previous combo's objects
    this.applyCellHighlight(combo.cells); // enlarge-pulse this combo
    this.buildDecoration([combo]);
    this.liftWinningObjects(combo.cells); // raise this combo's objects above the line
    // Immersive detonation — full punch during the tally (amount showing),
    // softer breathing pulse in the resting pattern loop.
    this.playImmersiveReveal([combo], !!amountText);
    // amount shown during the one-time tally; omitted in the resting loop.
    if (amountText) this.spawnComboAmount(combo, amountText);
  }

  /** Winning cells grouped left→right by reel → comet through the connection.
   *  Purely visual; self-cleaning (winPresentation `ways-light-comet`). */
  private fireWaysLight(combo: WinCombination): Promise<void> {
    // Ways-immersive owns the win: no line, no comet — the detonating
    // connection + dim board ARE the presentation.
    if (waysImmersiveConfig.enabled || !waysLightConfig.enabled) return Promise.resolve();
    const byReel = new Map<number, Array<{ x: number; y: number }>>();
    for (const [row, reel] of combo.cells) {
      const r = resolveAnchor(cellAnchor(reel, row), this.grid);
      const arr = byReel.get(reel) ?? [];
      arr.push({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
      byReel.set(reel, arr);
    }
    const reels = [...byReel.keys()].sort((a, b) => a - b).map(k => byReel.get(k)!);
    if (reels.length >= 2) return playWaysLight(this.waysLightContainer, reels);
    return Promise.resolve();
  }

  /** Run each winning combo's comet ONE AFTER ANOTHER (line by line) instead of
   *  all at once — matches the original wayslight "line nach line" behaviour. */
  private async fireWaysLightSequential(combos: readonly WinCombination[]): Promise<void> {
    for (const combo of combos) {
      if (waysImmersiveConfig.enabled || !waysLightConfig.enabled) return;
      await this.fireWaysLight(combo);
    }
  }

  /** Live setter for the PER-SYMBOL cell backdrop (chat-config cellBg* params).
   *  Updates the shared config, then redraws every symbol tile so the pocket
   *  (which lives on each symbol) picks up the change and keeps travelling with
   *  the symbol during the spin + landing. Colour stored as HSL (picker+sliders). */
  setCellBackdropParam(id: string, value: string | number): void {
    const c = cellBackdropConfig;
    switch (id) {
      case 'cellBgColor': { const { h, s, l } = numToHsl(hexToNum(String(value))); c.hue = h; c.sat = s; c.light = l; break; }
      case 'cellBgHue': c.hue = Number(value); break;
      case 'cellBgSaturation': c.sat = Number(value); break;
      case 'cellBgLightness': c.light = Number(value); break;
      case 'cellBgOpacity': c.opacity = Number(value); break;
      case 'cellBgRadius': c.radius = Number(value); break;
      case 'cellBgInset': c.inset = Number(value); break;
      case 'cellBgBorderColor': c.borderColor = hexToNum(String(value)); break;
      case 'cellBgBorderWidth': c.borderWidth = Number(value); break;
      default: return;
    }
    this.refreshAllTiles();
  }

  clearHighlights() {
    // Motion tweens die first (interrupt-restore needs the lifted poses),
    // then the objects return to their cells.
    this.clearWinLines();
    this.restoreLiftedObjects();
    for (const reel of this.reels) {
      reel.clearHighlights();
      reel.clearAllStates();
    }
    this.clearWinAmounts();
    clearAllWaysLight(); // kill any in-flight comet
  }

  /** Lift each winning cell's object layer above the win line. */
  private liftWinningObjects(cells: ReadonlyArray<[number, number]>): void {
    for (const [row, reel] of cells) {
      if (this.expandedReels.has(reel)) continue; // hidden behind the tower
      const cell = this.reels[reel]?.getVisibleCell(row);
      if (!cell) continue;
      // A sticky-lifted wild already sits above its gold frame (and the win
      // line) — re-lifting/restoring it here would drop it back UNDER the
      // frame mid-cycle. Leave it in the sticky objects layer.
      if (this.stickyLiftedCells.includes(cell)) continue;
      const r = resolveAnchor(cellAnchor(reel, row), this.grid);
      cell.liftObject(this.winObjectsContainer, r.x + r.w / 2, r.y + r.h / 2);
      this.liftedCells.push(cell);
    }
  }

  /** Return all lifted objects to their cells. */
  private restoreLiftedObjects(): void {
    for (const c of this.liftedCells) c.restoreObject();
    this.liftedCells.length = 0;
  }

  /** Enlarge-pulse the given winning cells. Fruit-Fortune style: the rest of
   *  the board is NOT dimmed — the size pulse + connecting line carry the win.
   *  Resets prior per-cell states first so a previous combo's pulse stops. */
  private applyCellHighlight(cells: ReadonlyArray<[number, number]>): void {
    const winningRows: Map<number, Set<number>> = new Map();
    for (const [row, reel] of cells) {
      if (!winningRows.has(reel)) winningRows.set(reel, new Set());
      winningRows.get(reel)!.add(row);
    }
    for (let i = 0; i < this.grid.reelCount; i++) {
      const rows = winningRows.get(i);
      // An expanded reel is ALL tower: its cells are hidden and must never
      // play win states / dim / pop (they'd peek out beside the column).
      // When the combo pays through it, the column itself pulses instead.
      if (this.expandedReels.has(i)) {
        if (rows && rows.size > 0) this.pulseExpandedReel(i);
        continue;
      }
      this.reels[i].clearAllStates();
      if (rows && rows.size > 0) this.reels[i].playWinStateOnRows(Array.from(rows));
      // Classic ways highlight: the CONNECTION carries the read — every cell
      // that is not part of it dims, so the win line + winners pop instantly.
      for (let row = 0; row < this.grid.visibleRows; row++) {
        this.reels[i].getVisibleCell(row)?.highlight(!!rows && rows.has(row));
      }
    }
  }

  /** The expanded tower's "I'm in this win" beat: a physical column THUMP —
   *  the tower dips and squashes, then springs back (top-anchored, so it
   *  compresses downward like weight landing on it). No overlay flash.
   *  Tweens ride the sticky lifecycle; pose is reset before each thump,
   *  and the idle breathing resumes once the thump settles. */
  private pulseExpandedReel(reelIdx: number): void {
    const tower = this.expandedTowerSprites.get(reelIdx);
    if (!tower || !tower.spr.parent) return;
    const { spr, baseY, baseScale } = tower;
    // A new thump replaces a mid-flight one cleanly (y/scale only — the
    // reveal's alpha fade is finished by the time wins present).
    gsap.killTweensOf(spr, 'y');
    gsap.killTweensOf(spr.scale);
    spr.y = baseY;
    spr.scale.set(baseScale);
    const tl = gsap.timeline({
      // The resting pattern loop thumps every ~800ms — self-splice completed
      // timelines so stickyRevealTweens can't grow unbounded during idle.
      onComplete: () => {
        const i = this.stickyRevealTweens.indexOf(tl);
        if (i >= 0) this.stickyRevealTweens.splice(i, 1);
        this.startTowerIdle(reelIdx);
      },
    });
    tl.to(spr, { y: baseY + 5, duration: 0.09, ease: 'power3.out' }, 0)
      .to(spr.scale, { y: baseScale * 0.985, duration: 0.09, ease: 'power3.out' }, 0)
      .to(spr, { y: baseY, duration: 0.55, ease: 'elastic.out(1, 0.45)' }, 0.09)
      .to(spr.scale, { y: baseScale, duration: 0.55, ease: 'elastic.out(1, 0.45)' }, 0.09);
    this.stickyRevealTweens.push(tl);
  }

  /** IDLE LIFE for a standing tower: organic breathing — width and height
   *  swell at two incommensurate periods (so the loop never reads as
   *  mechanical), each tower phase-shifted at random. Pure scale motion:
   *  no y-bob (the reveal mask would crop the head), no overlays. Tweens
   *  ride the sticky lifecycle; thumps kill + restart the breathing. */
  private startTowerIdle(reelIdx: number): void {
    const tower = this.expandedTowerSprites.get(reelIdx);
    if (!tower || !tower.spr.parent) return;
    const { spr, baseScale } = tower;
    const phase = Math.random() * 1.3;
    this.stickyRevealTweens.push(
      gsap.to(spr.scale, {
        y: baseScale * 1.007, duration: 1.7, yoyo: true, repeat: -1,
        ease: 'sine.inOut', delay: phase,
      }),
      gsap.to(spr.scale, {
        x: baseScale * 1.004, duration: 2.45, yoyo: true, repeat: -1,
        ease: 'sine.inOut', delay: phase * 0.6,
      }),
    );
  }

  /** WAYS-IMMERSIVE presentation: the OBJECTS carry the win — no overlays.
   *  Every unique winning symbol LEAPS out of its cell left→right (jump +
   *  mid-air wiggle + bounce landing on its own object layer, composing with
   *  the win-state pulse/sheet), expanded towers thump via applyCellHighlight,
   *  and a 4+/full-board match punches the board with a decaying micro-shake.
   *  Tweens go into winFxTweens — killed by clearWinLines BEFORE the objects
   *  un-lift, so the interrupt-restore always writes lifted-space poses. */
  private playImmersiveReveal(combos: ReadonlyArray<WinCombination>, intense: boolean): void {
    if (!waysImmersiveConfig.enabled || prefersReducedMotion()) return;
    const seen = new Set<string>();
    for (const combo of combos) {
      for (const [row, reel] of combo.cells) {
        const key = `${reel},${row}`;
        if (seen.has(key) || this.expandedReels.has(reel)) continue;
        seen.add(key);
        const cell = this.reels[reel]?.getVisibleCell(row);
        if (!cell) continue;
        // Symbols with a WIN SHEET play their animation ON POSITION, dead
        // still — the board dim carries the read; any leap/zoom would warp
        // the sheet ("maximum clean"). Sheet-less symbols keep the leap.
        if (SYMBOL_WIN_SHEETS.has(cell.symbol)) continue;
        danceWinningObject(
          cell.objectLayer, reel * waysImmersiveConfig.stagger, intense, this.winFxTweens,
        );
      }
    }
    const maxMatch = combos.reduce((m, c) => Math.max(m, c.matchCount), 0);
    if (intense && maxMatch >= 4) {
      this.microShake(maxMatch >= this.grid.reelCount ? 4 : 2.5);
    }
  }

  /** One reel just landed: jolt the whole board down and spring back — the
   *  weight of the stop. The FINAL reel slams hardest with an elastic settle.
   *  A new jolt replaces a mid-flight one against the SAME captured base, so
   *  staggered stops chain without drifting. */
  private playLandingThud(reelIdx: number): void {
    if (!landingImpactConfig.enabled || !landingImpactConfig.thud || prefersReducedMotion()) return;
    const base = this.thudBaseY ?? this.container.y;
    this.thudBaseY = base;
    if (this.thudTween) this.thudTween.kill(); // onInterrupt restored y to base
    const last = reelIdx === this.grid.reelCount - 1;
    const amp = last ? landingImpactConfig.thudLastAmp : landingImpactConfig.thudAmp;
    const tl = gsap.timeline({
      onComplete: () => { this.container.y = base; this.thudTween = null; this.thudBaseY = null; },
      onInterrupt: () => { this.container.y = base; },
    });
    tl.to(this.container, { y: base + amp, duration: 0.05, ease: 'power3.out' })
      .to(this.container, {
        y: base,
        duration: last ? 0.45 : 0.2,
        ease: last ? 'elastic.out(1.1, 0.4)' : 'power2.out',
      });
    this.thudTween = tl;
  }

  /** Stop a thud immediately and restore the board's base position. */
  private killThud(): void {
    if (this.thudTween) { this.thudTween.kill(); this.thudTween = null; }
    this.thudBaseY = null;
  }

  /** Tiny decaying board punch for big matches. Restores the exact base
   *  position on completion AND on interrupt (clearWinLines can kill a
   *  mid-flight shake), so the board never drifts. */
  private microShake(amp: number): void {
    // A residual landing thud would displace the captured base — settle it first.
    this.killThud();
    const base = { x: this.container.x, y: this.container.y };
    const restore = () => { this.container.position.set(base.x, base.y); };
    const tl = gsap.timeline({ onComplete: restore, onInterrupt: restore });
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const f = 1 - i / steps;
      tl.to(this.container, {
        x: base.x + (Math.random() - 0.5) * 2 * amp * f,
        y: base.y + (Math.random() - 0.5) * 2 * amp * f,
        duration: 0.035,
        ease: 'sine.inOut',
      });
    }
    tl.to(this.container, { x: base.x, y: base.y, duration: 0.05 });
    this.winFxTweens.push(tl);
  }

  /** Unique winning cell centres (ReelSet-local coords) across all combos —
   *  used as launch origins for the coin-win ceremony. */
  getWinningCellCenters(winResult: WinResult): Array<{ x: number; y: number }> {
    const seen = new Set<string>();
    const out: Array<{ x: number; y: number }> = [];
    for (const combo of winResult.combinations) {
      for (const [row, reel] of combo.cells) {
        const key = `${reel},${row}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const r = resolveAnchor(cellAnchor(reel, row), this.grid);
        out.push({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
      }
    }
    return out;
  }

  /** Cell centre points (+ size), left-to-right, for one combination. */
  private comboPoints(combo: WinCombination): Array<{ x: number; y: number; w: number; h: number }> {
    const sorted = [...combo.cells].sort((a, b) => a[1] - b[1]); // by reel
    return sorted.map(([row, reel]) => {
      const r = resolveAnchor(cellAnchor(reel, row), this.grid);
      return { x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w, h: r.h };
    });
  }

  /** Soft radial glow: stacked concentric circles (bright centre → faint edge). */
  private drawSoftGlow(g: Graphics, cx: number, cy: number, radius: number, color: number, peakAlpha: number): void {
    const steps = 8;
    for (let i = steps; i >= 1; i--) {
      const f = i / steps;
      g.circle(cx, cy, radius * f);
      g.fill({ color, alpha: peakAlpha / steps });
    }
  }

  /** Warm halo behind a scatter during a near-miss tease — a "bonus incoming"
   *  cue under the featured pulse. Lives in teaseGlowContainer (auto-cleared). */
  private teaseTweens: gsap.core.Animation[] = [];
  /** Cells stage-dimmed by the active tease preset — restored on tease end. */
  private teaseDimmedCells = new Set<AnimatedSymbol>();
  /** Cells whose transform a tease preset drifted (ctx.cellNode) — rest
   *  positions restored on tease end. */
  private teaseMovedNodes = new Map<AnimatedSymbol, { x: number; y: number }>();

  private buildTeaseCtx(): TeaseContext {
    return {
      layer: this.teaseGlowContainer,
      grid: { reels: this.grid.reelCount, rows: this.grid.visibleRows },
      cellRect: (reel, row) => resolveAnchor(cellAnchor(reel, row), this.grid),
      reelRect: (reel) => resolveAnchor(reelAnchor(reel), this.grid),
      gridRect: () => resolveAnchor(gridAnchor, this.grid),
      accent: this.config.theme.accent,
      gold: 0xFFC53D,
      gsap,
      track: <T extends { kill(): void }>(t: T): T => { this.teaseTweens.push(t as unknown as gsap.core.Animation); return t; },
      rand: (min, max) => min + Math.random() * (max - min),
      pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
      dimCell: (reel, row, alpha) => {
        if (this.expandedReels.has(reel)) return; // hidden behind a tower
        const cell = this.reels[reel]?.getVisibleCell(row);
        if (!cell) return;
        this.teaseDimmedCells.add(cell);
        gsap.killTweensOf(cell, 'alpha');
        this.teaseTweens.push(gsap.to(cell, { alpha, duration: 0.28, ease: 'power2.out' }));
      },
      cellNode: (reel, row) => {
        if (this.expandedReels.has(reel)) return null; // hidden behind a tower
        const cell = this.reels[reel]?.getVisibleCell(row);
        if (!cell) return null;
        // Snapshot the rest transform ONCE — clearTeaseGlow restores it, so
        // presets can drift the whole object without their own cleanup.
        if (!this.teaseMovedNodes.has(cell)) {
          this.teaseMovedNodes.set(cell, { x: cell.x, y: cell.y });
        }
        return cell;
      },
    };
  }

  private addTeaseGlow(reel: number, row: number): void {
    try { getActiveTeasePreset().onScatterLanded(this.buildTeaseCtx(), reel, row); }
    catch (err) { console.warn('[ReelSet] tease preset failed:', err); }
  }

  /** Preset hook: a pending right-side reel entered the tease ladder. */
  private teasePendingReel(reel: number, position: number): void {
    try { getActiveTeasePreset().onPendingReel(this.buildTeaseCtx(), reel, position); }
    catch (err) { console.warn('[ReelSet] tease preset failed:', err); }
  }

  private clearTeaseGlow(): void {
    for (const t of this.teaseTweens) { try { t.kill(); } catch { /* torn down */ } }
    this.teaseTweens = [];
    for (const c of this.teaseGlowContainer.removeChildren()) c.destroy();
    // Restore every cell the tease preset stage-dimmed.
    for (const cell of this.teaseDimmedCells) {
      gsap.killTweensOf(cell, 'alpha');
      cell.alpha = 1;
    }
    this.teaseDimmedCells.clear();
    // Restore every cell a preset drifted via ctx.cellNode.
    for (const [cell, rest] of this.teaseMovedNodes) {
      gsap.killTweensOf(cell, 'x,y');
      if (!cell.destroyed) cell.position.set(rest.x, rest.y);
    }
    this.teaseMovedNodes.clear();
  }

  /** Build the win decoration, Fruit-Fortune style: a bold gold line through
   *  the winning symbols with node dots, plus light sparkles. The line DRAWS ON
   *  left→right (a reveal mask grows in width) and then stays solid. It lives
   *  in winLinesContainer (below the lifted symbol objects), so the symbols sit
   *  on top of the line. No frames, no glow wash, no dimming. */
  private buildDecoration(combos: ReadonlyArray<WinCombination>): void {
    // Ways-immersive: NO decoration at all — no line, no dots, no sparkles,
    // no light sweep. The winners' own motion + the deep dim carry the win.
    if (waysImmersiveConfig.enabled) return;
    const group = new Container();
    this.winLinesContainer.addChild(group);

    // (win-focus bloom removed — the gold radial behind every winning cell
    // fought the transparent symbol art; the line/dots + symbol win anims
    // carry the win on their own)

    // The line/dots are revealed left→right by a growing mask; sparkles sit in
    // a separate steady layer (not masked) so they twinkle normally.
    const lineLayer = new Container();
    group.addChild(lineLayer);
    const sparkLayer = new Container();
    group.addChild(sparkLayer);

    let drew = false;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const combo of combos) {
      const pts = this.comboPoints(combo);
      if (pts.length === 0) continue;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      // Bold gold connecting line: a solid wider underlay + a thick bright core.
      // Skipped when the ways-light comet is the selected win-line feature — it
      // owns the connection then (the contributor's design: nothing stays).
      if (pts.length >= 2 && !waysLightConfig.enabled) {
        const line = new Graphics();
        line.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) line.lineTo(pts[i].x, pts[i].y);
        // Bold gold connecting line: a solid wider underlay + a thick bright core.
        line.stroke({ color: this.winLineColor, width: 11, alpha: 0.9, cap: 'round', join: 'round' });
        line.stroke({ color: this.winFrameColor, width: 7, alpha: 1, cap: 'round', join: 'round' });
        lineLayer.addChild(line);
      }

      // Bold node dots where the line meets each winning symbol.
      for (const p of pts) {
        const dot = new Graphics();
        dot.circle(p.x, p.y, 8);
        dot.fill({ color: this.winFrameColor, alpha: 1 });
        dot.circle(p.x, p.y, 8);
        dot.stroke({ color: this.winLineColor, width: 3, alpha: 1 });
        lineLayer.addChild(dot);
      }

      this.spawnSparkles(sparkLayer, pts);
      drew = true;
    }

    if (!drew) {
      group.destroy({ children: true });
      return;
    }

    // Reveal mask anchored at the left edge (minX); scaling its x sweeps the
    // line — and its node dots — into view from left to right. Skipped when
    // the layer is empty (immersive mode draws no line/dots).
    if (lineLayer.children.length > 0) {
      const pad = 16;
      const mask = new Graphics();
      mask.rect(0, 0, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2).fill(0xffffff);
      mask.x = minX - pad;
      mask.y = minY - pad;
      lineLayer.addChild(mask);
      lineLayer.mask = mask;

      // Periodic draw-on: sweep left→right, hold, fade out, pause, repeat — so the
      // line keeps animating rather than drawing once and sitting still.
      const sweep = gsap.timeline({ repeat: -1, repeatDelay: 0.5 });
      sweep
        .set(mask.scale, { x: 0 })
        .set(lineLayer, { alpha: 1 })
        .to(mask.scale, { x: 1, duration: 0.5, ease: 'power2.out' })
        .to(lineLayer, { alpha: 0, duration: 0.35, ease: 'power1.in' }, '+=1.1');
      this.winFxTweens.push(sweep);
    }

    // Full-board win (matched across every reel) → a light band sweeps the line.
    // Suppressed when the ways-light comet owns the win-line.
    if (!waysLightConfig.enabled && combos.some(c => c.matchCount >= this.grid.reelCount)) {
      this.spawnLightSweep(group, minX - 30, maxX + 30, minY - 60, maxY + 60);
    }
  }

  /** A bright light band that sweeps left→right across a full-board
   *  (5-of-a-kind) win line — the celebratory "shine" for the biggest line
   *  wins. Cosmetic only; cleaned via winFxTweens + container teardown. */
  private spawnLightSweep(layer: Container, x0: number, x1: number, yTop: number, yBot: number): void {
    const h = yBot - yTop;
    const bar = new Container();
    bar.y = yTop;
    const g = new Graphics();
    g.rect(-22, 0, 44, h).fill({ color: this.winLineColor, alpha: 0.10 });
    g.rect(-10, 0, 20, h).fill({ color: this.winFrameColor, alpha: 0.18 });
    g.rect(-3, 0, 6, h).fill({ color: 0xffffff, alpha: 0.5 });
    bar.addChild(g);
    bar.x = x0;
    bar.alpha = 0;
    layer.addChild(bar);

    const tw = gsap.timeline({ repeat: -1, repeatDelay: 1.2 });
    tw.set(bar, { x: x0, alpha: 0 })
      .to(bar, { alpha: 1, duration: 0.15, ease: 'power1.out' }, 0)
      .to(bar, { x: x1, duration: 0.7, ease: 'sine.inOut' }, 0)
      .to(bar, { alpha: 0, duration: 0.2, ease: 'power1.in' }, 0.55);
    this.winFxTweens.push(tw);
  }

  /** Twinkling 4-point sparkles scattered over the winning cells — the touch
   *  that reads as "magic". Positions/timings are cosmetic randomness only
   *  (never an outcome path). */
  private spawnSparkles(
    layer: Container,
    pts: Array<{ x: number; y: number; w: number; h: number }>,
  ): void {
    for (const p of pts) {
      for (let s = 0; s < 2; s++) {
        const outer = 6 + Math.random() * 4;
        const star = new Graphics();
        star.star(0, 0, 4, outer, outer * 0.4);
        star.fill({ color: 0xFFFFFF, alpha: 0.95 });
        star.x = p.x + (Math.random() - 0.5) * p.w * 0.7;
        star.y = p.y + (Math.random() - 0.5) * p.h * 0.7;
        star.scale.set(0);
        star.alpha = 0;
        layer.addChild(star);

        const dur = 0.5 + Math.random() * 0.4;
        const tw = gsap.timeline({
          repeat: -1,
          delay: Math.random() * 0.9,
          repeatDelay: Math.random() * 0.7,
        });
        tw.to(star.scale, { x: 1, y: 1, duration: dur * 0.45, ease: 'back.out(2)' }, 0)
          .to(star, { alpha: 1, duration: dur * 0.35 }, 0)
          .to(star, { rotation: Math.PI * 0.5, duration: dur, ease: 'none' }, 0)
          .to(star.scale, { x: 0, y: 0, duration: dur * 0.5, ease: 'power1.in' }, dur * 0.5)
          .to(star, { alpha: 0, duration: dur * 0.5 }, dur * 0.5);
        this.winFxTweens.push(tw);
      }
    }
  }

  /** Float a combo's win amount up from the centre of its cells, then fade. */
  private spawnComboAmount(combo: WinCombination, text: string): void {
    const pts = this.comboPoints(combo);
    if (pts.length === 0) return;
    let cx = 0;
    let cy = 0;
    for (const p of pts) { cx += p.x; cy += p.y; }
    cx /= pts.length;
    cy /= pts.length;

    // Immersive mode carries the amount as the win's headline — bigger type,
    // plus a "N WAYS" subline so the connection's weight reads instantly.
    const immersive = waysImmersiveConfig.enabled;
    const label = new Text({
      text,
      style: new TextStyle({
        fontFamily: "'Rubik', ui-sans-serif, system-ui, sans-serif",
        fontSize: immersive ? 34 : 28,
        fontWeight: '900',
        fill: WIN_AMOUNT_COLOR,
        stroke: { color: 0x3a2400, width: 5 },
        dropShadow: { color: 0x000000, alpha: 0.55, blur: 5, distance: 3, angle: Math.PI / 2 },
      }),
    });
    label.anchor.set(0.5);
    const group = new Container();
    group.eventMode = 'none';
    group.x = cx;
    group.y = cy;
    group.alpha = 0;
    group.scale.set(0.6);
    group.addChild(label);
    if (immersive && combo.ways > 1) {
      const ways = new Text({
        text: `${combo.ways} WAYS`,
        style: new TextStyle({
          fontFamily: "'Poppins', ui-sans-serif, sans-serif",
          fontSize: 15,
          fontWeight: '800',
          fontStyle: 'italic',
          fill: this.winFrameColor,
          letterSpacing: 2,
          stroke: { color: 0x3a2400, width: 4 },
          dropShadow: { color: 0x000000, alpha: 0.5, blur: 4, distance: 2, angle: Math.PI / 2 },
        }),
      });
      ways.anchor.set(0.5, 0);
      ways.y = label.height * 0.46;
      group.addChild(ways);
    }
    this.winAmountsContainer.addChild(group);

    const tl = gsap.timeline({ onComplete: () => group.destroy({ children: true }) });
    tl.to(group, { alpha: 1, duration: 0.15, ease: 'power2.out' }, 0)
      .to(group.scale, { x: 1, y: 1, duration: 0.32, ease: 'back.out(2.5)' }, 0)
      .to(group, { y: cy - 42, duration: 1.1, ease: 'power1.out' }, 0)
      .to(group, { alpha: 0, duration: 0.4, ease: 'power1.in' }, 0.7);
    this.winAmountTweens.push(tl);
  }

  // ── Hold & Win presentation ────────────────────────────────────────────────
  /**
   * Play the Hold & Win bonus on the actual board: dim the reels, lock the
   * trigger coins, then auto-run the respins from the pre-derived round (each
   * landing pops a coin and resets the respin counter), celebrate a GRAND fill,
   * and reveal the collected total. Purely presentational — `round` was computed
   * deterministically from the spin randomness; the payout is already in the
   * authoritative winAmount. Awaited by PixiApp.resolve so the spin holds.
   */
  async playHoldAndWin(
    round: HwRound,
    opts: {
      accent?: number;
      turbo?: boolean;
      reduced?: boolean;
      isLive?: () => boolean;
    } = {},
  ): Promise<void> {
    const live = opts.isLive ?? (() => true);
    const accent = opts.accent ?? 0xFFC93C;
    const fast = !!(opts.turbo || opts.reduced);
    const popDur = fast ? 0.12 : 0.3;
    const stepPause = fast ? 70 : 340;
    const cols = this.grid.reelCount;

    this.clearHoldWin();
    const layer = new Container();
    this.holdWinLayer = layer;
    this.container.addChild(layer);

    const tween = (target: object, vars: gsap.TweenVars): Promise<void> =>
      new Promise<void>(res => { this.holdWinTweens.push(gsap.to(target, { ...vars, onComplete: () => res() })); });
    const wait = (ms: number): Promise<void> => new Promise<void>(res => setTimeout(res, ms));

    try {
      const gr = resolveAnchor(gridAnchor, this.grid);
      const cx = gr.x + gr.w / 2;

      // Dim band extends into the header (52px) + footer (20px) so the title and
      // respin badge sit in clear bands ABOVE/BELOW the cells, not cramped over
      // row 0 / the bottom row.
      const dim = new Graphics();
      dim.rect(gr.x - 10, gr.y - 40, gr.w + 20, gr.h + 58).fill({ color: 0x070A0F, alpha: 0.86 });
      layer.addChild(dim);

      const title = new Text({
        text: 'HOLD & WIN',
        style: new TextStyle({ fontFamily: "'Poppins', ui-sans-serif, sans-serif", fontSize: 22, fontWeight: '800', fontStyle: 'italic', fill: accent, letterSpacing: 2, dropShadow: { color: 0x000000, blur: 4, distance: 0, alpha: 0.6 } }),
      });
      title.anchor.set(0.5, 0); title.x = cx; title.y = gr.y - 36; layer.addChild(title);

      const badge = new Text({
        text: `RESPINS  ${HW_START_RESPINS}`,
        style: new TextStyle({ fontFamily: "'Rubik', sans-serif", fontSize: 14, fontWeight: '700', fill: 0xFFFFFF, letterSpacing: 1 }),
      });
      badge.anchor.set(0.5, 0); badge.x = cx; badge.y = gr.y + gr.h + 4; layer.addChild(badge);

      const coinLayer = new Container(); layer.addChild(coinLayer);
      const locked = new Set<number>();

      layer.alpha = 0;
      await tween(layer, { alpha: 1, duration: 0.25 });
      if (!live()) return;

      // Lock the trigger coins.
      for (const c of round.initial) { this.spawnHwCoin(coinLayer, c, accent, popDur); locked.add(c.idx); }
      await wait(fast ? 50 : 260);

      // Auto-respins.
      for (const step of round.steps) {
        if (!live()) return;
        if (!fast) await this.hwRespinShimmer(layer, locked, accent);
        for (const c of step.landed) {
          this.spawnHwCoin(coinLayer, c, accent, popDur);
          locked.add(c.idx);
          this.audioHooks.onReelStopped?.(c.idx % cols);
          if (c.tier) this.audioHooks.onScatterLanded?.(c.idx % cols);
        }
        badge.text = step.landed.length > 0 ? `RESPINS RESET  ${step.respinsAfter}` : `RESPINS  ${step.respinsAfter}`;
        if (step.landed.length > 0) this.holdWinTweens.push(gsap.fromTo(badge.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.25, ease: 'back.out(2)' }));
        await wait(stepPause);
      }
      if (!live()) return;

      // GRAND fill.
      if (round.grand) {
        this.audioHooks.onScatterLanded?.(0);
        const grand = new Text({
          text: 'GRAND!',
          style: new TextStyle({ fontFamily: "'Poppins', sans-serif", fontSize: 38, fontWeight: '900', fill: accent, stroke: { color: 0x000000, width: 5 } }),
        });
        grand.anchor.set(0.5); grand.x = cx; grand.y = gr.y + gr.h * 0.32; grand.scale.set(0); layer.addChild(grand);
        await tween(grand.scale, { x: 1, y: 1, duration: fast ? 0.2 : 0.45, ease: 'back.out(2.2)' });
        await wait(fast ? 200 : 500);
      }

      // Collect total (in bet-multiples — the currency amount lands in the win ceremony after).
      const total = new Text({
        text: `TOTAL  ${round.totalMultiplier}×`,
        style: new TextStyle({ fontFamily: "'Poppins', sans-serif", fontSize: 30, fontWeight: '900', fill: 0xFFFFFF, stroke: { color: 0x3A2400, width: 4 }, dropShadow: { color: 0x000000, blur: 5, distance: 2, alpha: 0.6 } }),
      });
      total.anchor.set(0.5); total.x = cx; total.y = gr.y + gr.h / 2; total.scale.set(0.6); total.alpha = 0; layer.addChild(total);
      await Promise.all([
        tween(total, { alpha: 1, duration: 0.2 }),
        tween(total.scale, { x: 1, y: 1, duration: 0.34, ease: 'back.out(2.2)' }),
      ]);
      await wait(fast ? 300 : 900);
      if (!live()) return;

      await tween(layer, { alpha: 0, duration: 0.35 });
    } finally {
      this.clearHoldWin();
    }
  }

  /** Draw a coin token (value or jackpot tier) at a flat cell index, popping in.
   *  Uses the user-uploaded coin PNG (SymbolId.COIN) when present; otherwise
   *  draws a minted gold coin (rim + radial sheen + engraved ring + specular) or
   *  a dark accent medallion for jackpots. */
  private spawnHwCoin(layer: Container, coin: { idx: number; value: number; tier?: string }, accent: number, popDur: number): void {
    const cols = this.grid.reelCount;
    const reel = coin.idx % cols;
    const row = Math.floor(coin.idx / cols);
    const r = resolveAnchor(cellAnchor(reel, row), this.grid);
    const radius = Math.min(r.w, r.h) * 0.42;
    const isJp = !!coin.tier;

    const tok = new Container();
    tok.x = r.x + r.w / 2; tok.y = r.y + r.h / 2;

    const tex = this.config.theme.userAssetTextures?.get(SymbolId.COIN);
    if (tex) {
      // User-uploaded coin art — fit to the cell; value/tier label overlaid.
      const sp = new Sprite(tex);
      sp.anchor.set(0.5);
      const size = Math.min(r.w, r.h) * 0.94;
      sp.width = size; sp.height = size;
      tok.addChild(sp);
    } else {
      const g = new Graphics();
      if (isJp) {
        // Jackpot medallion — soft glow, dark disc, accent rim + inner ring.
        g.circle(0, 0, radius * 1.06).fill({ color: accent, alpha: 0.2 });
        g.circle(0, 0, radius).fill({ color: 0x14181F });
        g.circle(0, 0, radius).stroke({ color: accent, width: Math.max(2, radius * 0.1) });
        g.circle(0, 0, radius * 0.7).stroke({ color: accent, width: 1.5, alpha: 0.6 });
      } else {
        // Minted gold coin: dark rim → radial sheen (deep gold edge → bright
        // centre) → engraved inner ring → specular highlight.
        g.circle(0, 0, radius * 1.02).fill({ color: 0x6E4400 });
        const steps = 7;
        for (let i = steps; i >= 1; i--) {
          const f = i / steps;
          g.circle(0, 0, radius * 0.94 * f);
          g.fill({ color: this.lerpColor(0xFFE486, 0xF2A312, f) }); // bright centre, gold edge
        }
        g.circle(0, 0, radius * 0.66).stroke({ color: 0xC98A1A, width: Math.max(1.5, radius * 0.07) });
        g.ellipse(-radius * 0.26, -radius * 0.34, radius * 0.36, radius * 0.2).fill({ color: 0xFFFFFF, alpha: 0.5 });
      }
      tok.addChild(g);
    }

    const txt = new Text({
      text: coin.tier ?? `${coin.value}×`,
      style: new TextStyle({
        fontFamily: "'Poppins', ui-sans-serif, sans-serif",
        fontSize: Math.max(11, radius * (isJp ? 0.34 : 0.56)),
        fontWeight: '900',
        fill: isJp ? accent : 0x5A3A00,
        stroke: { color: isJp ? 0x000000 : 0xFFEFB0, width: Math.max(1, radius * 0.05) },
        dropShadow: { color: 0x000000, alpha: 0.35, blur: 2, distance: 1, angle: Math.PI / 2 },
      }),
    });
    txt.anchor.set(0.5); tok.addChild(txt);
    layer.addChild(tok);

    tok.scale.set(0);
    this.holdWinTweens.push(gsap.to(tok.scale, { x: 1, y: 1, duration: popDur, ease: 'back.out(2)' }));
  }

  /** Linear interpolate between two 0xRRGGBB colours (t in [0,1]). */
  private lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * t) << 16)
      | (Math.round(ag + (bg - ag) * t) << 8)
      | Math.round(ab + (bb - ab) * t);
  }

  /** A quick shimmer over the empty cells — reads as the respin rolling. */
  private hwRespinShimmer(layer: Container, locked: Set<number>, accent: number): Promise<void> {
    const cols = this.grid.reelCount;
    const rows = this.grid.visibleRows;
    const fx = new Container(); layer.addChild(fx);
    for (let idx = 0; idx < cols * rows; idx++) {
      if (locked.has(idx)) continue;
      const reel = idx % cols;
      const row = Math.floor(idx / cols);
      const r = resolveAnchor(cellAnchor(reel, row), this.grid);
      const g = new Graphics();
      g.roundRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8, 8).stroke({ color: accent, width: 2, alpha: 0.5 });
      g.alpha = 0;
      fx.addChild(g);
    }
    if (fx.children.length === 0) { fx.destroy(); return Promise.resolve(); }
    return new Promise<void>(res => {
      const tl = gsap.timeline({ onComplete: () => { fx.destroy({ children: true }); res(); } });
      tl.to(fx.children, { alpha: 0.85, duration: 0.12, stagger: 0.012 })
        .to(fx.children, { alpha: 0, duration: 0.14 }, '+=0.04');
      this.holdWinTweens.push(tl);
    });
  }

  private clearHoldWin(): void {
    for (const t of this.holdWinTweens) t.kill();
    this.holdWinTweens.length = 0;
    if (this.holdWinLayer) {
      this.holdWinLayer.destroy({ children: true });
      this.holdWinLayer = null;
    }
  }

  private clearWinLines(): void {
    for (const t of this.winFxTweens) t.kill();
    this.winFxTweens.length = 0;
    for (const c of this.winLinesContainer.removeChildren()) c.destroy({ children: true });
  }

  private clearWinAmounts(): void {
    for (const t of this.winAmountTweens) t.kill();
    this.winAmountTweens.length = 0;
    for (const c of this.winAmountsContainer.removeChildren()) c.destroy({ children: true });
  }

  /** Force every cell across every reel to redraw its static tile —
   *  invoked by PixiApp when user-uploaded asset textures change so the
   *  swap is visible without waiting for the next spin. */
  refreshAllTiles() {
    for (const reel of this.reels) reel.refreshAllTiles();
  }

  /** Demo helper: force the visible cell (reel,row) to display a given symbol —
   *  so a synthetic ways win actually shows the SAME symbol on the connecting
   *  cells (a real connection, not fake lines over random symbols). Persists
   *  until the next spin. */
  forceVisibleSymbol(reel: number, row: number, symbolId: number): void {
    this.reels[reel]?.getVisibleCell(row)?.setSymbol(symbolId as SymbolIdType);
  }

  /** Stop all reel motion, cancel pending scheduled callbacks, and
   *  dispose per-cell tweens before Pixi tears down the scene graph.
   *  Called by PixiApp.destroy(). */
  dispose(): void {
    this.clearScheduledCallbacks();
    this.restoreLiftedObjects();
    this.clearWinLines();
    this.clearWinAmounts();
    this.clearHoldWin();
    for (const reel of this.reels) reel.dispose();
  }

  /**
   * Detect a near-miss scatter situation on the final board.
   * Rule: ≥2 scatters total AND at least one reel still pending (i.e.
   * landing AFTER the rightmost scatter reel). Same-reel stacks count —
   * e.g. 2 scatters on reel 0 with reels 1-4 pending is the strongest
   * tease setup in the game. Returns the pending reels in landing order;
   * each subsequent reel decelerates slower than the one before for a
   * wave-of-suspense effect.
   *
   * Intensity scales with scatter count: 3+ scatters produce a longer,
   * more dramatic tease than 2 scatters — matching how real slots (Fruit
   * Fortune, Gift Bonanza, Sugar Circus) escalate anticipation when the
   * player is closer to triggering the bonus.
   *
   * Scatters only on the rightmost reel leave nothing pending so no
   * tease fires.
   */
  private detectNearMiss(stops: number[]): NearMiss | null {
    const scatterCells: Array<{ reelIdx: number; row: number }> = [];
    const { reelStrips, reelLengths } = this.config;
    const { reelCount, visibleRows } = this.grid;

    for (let r = 0; r < reelCount; r++) {
      for (let row = 0; row < visibleRows; row++) {
        const symIdx = (stops[r] + row) % reelLengths[r];
        if (reelStrips[r][symIdx] === SymbolId.SCATTER) {
          scatterCells.push({ reelIdx: r, row });
        }
      }
    }

    // Need at least 2 scatters total, and at least one reel still pending
    // after the rightmost scatter reel. Stacked scatters on a single early
    // reel (e.g. 2 on reel 0 with reels 1-4 pending) are the strongest tease
    // setup in the game and must fire.
    if (scatterCells.length < 2) return null;
    const rightmostScatterReel = Math.max(...scatterCells.map(s => s.reelIdx));
    if (rightmostScatterReel >= reelCount - 1) return null; // no pending reels

    // Cap the tease ladder at every pending reel — `maxTeasedReelsFor`
    // returns `reelCount - 1`, which is the absolute ceiling of pending
    // reels after the rightmost scatter.
    const maxTeased = maxTeasedReelsFor(reelCount);
    const teasedReels: number[] = [];
    for (
      let r = rightmostScatterReel + 1;
      r < reelCount && teasedReels.length < maxTeased;
      r++
    ) {
      teasedReels.push(r);
    }

    return { teasedReels, scatterReels: scatterCells, scatterCount: scatterCells.length };
  }

  private reelHasVisibleScatter(reelIdx: number, stop: number): boolean {
    const len = this.config.reelLengths[reelIdx];
    const strip = this.config.reelStrips[reelIdx];
    for (let row = 0; row < this.grid.visibleRows; row++) {
      if (strip[(stop + row) % len] === SymbolId.SCATTER) return true;
    }
    return false;
  }

}
