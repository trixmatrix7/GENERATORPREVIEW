// ReelSet — manages all 5 reels as a single unit on the PixiJS stage.
//
// Responsibilities beyond per-reel motion:
//   - Near-miss detection: if the final board has ≥2 scatters on ≥2 different
//     reels, decelerate every reel after the rightmost scatter slower to build
//     anticipation. Intensity scales with scatter count. Display-only — the
//     outcome itself is never altered.
//   - Win-cell highlighting and per-cell state triggers after the reels land.

import { Container, Graphics, Text, TextStyle, Rectangle, Sprite } from 'pixi.js';
import { gsap } from 'gsap';
import { Reel } from './Reel';
import type { AnimatedSymbol } from './AnimatedSymbol';
import { CELL_HEIGHT, REEL_GAP } from './symbolMetrics';
import { getActiveGrid, type GridConfig } from '@/config/gridConfig';
import { resolveAnchor, cell as cellAnchor, reel as reelAnchor, grid as gridAnchor } from '@/engine/anchors';
import { CANVAS_THEME } from '@/config/canvasTheme';
import { SymbolId } from '@/config/symbols';
import { FALLBACK_TIMINGS } from '@/config/symbolAnimations';
import type { WinResult, WinCombination } from '@/engine/WinEvaluator';
import { HW_START_RESPINS, type HwRound } from '@/engine/holdAndWin';
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/engine/GameConfig';
import type { SymbolAtlasMap } from './SymbolAtlasLoader';
import { playWaysLight, clearAllWaysLight, waysLightConfig } from './effects/WaysLightComet';
import { applyStickyWild, clearAllStickyWild, stickyWildConfig, type StickyHandle } from './effects/StickyWildShine';

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
  private stickyHandles: StickyHandle[] = [];
  private lastStickyBoard: number[][] | null = null;
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

  constructor(
    atlases: SymbolAtlasMap,
    config: GameConfig = DEFAULT_GAME_CONFIG,
    grid: GridConfig = getActiveGrid(),
  ) {
    this.config = config;
    this.grid = grid;
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
    this.container.addChild(this.winObjectsContainer);  // lifted winning objects — above line
    this.container.addChild(this.winAmountsContainer);  // floating amounts — top
    this.container.addChild(this.stickyContainer);      // sticky-wild overlays — above symbols
    this.container.addChild(this.waysLightContainer);   // ways-light comet — topmost fx
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
    this.clearStickyWilds();
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
      }
    }
  }

  /** Re-apply to the last settled board (used by the live studio toggle). */
  refreshStickyWilds(): void {
    if (this.lastStickyBoard) this.applyStickyWilds(this.lastStickyBoard);
  }

  clearStickyWilds(): void {
    for (const h of this.stickyHandles) h.destroy();
    this.stickyHandles = [];
    clearAllStickyWild();
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
    if (nearMiss) {
      nearMiss.teasedReels.forEach((reelIdx, position) => teaseOrder.set(reelIdx, position));
    }

    const stopPromises = this.reels.map((reel, i) => {
      const stopPromise = (() => {
        if (fast) return reel.stopOn(stops[i], 0, true);

        // Per-reel stop stagger — a more deliberate left-to-right cascade
        // reads like a real slot rather than a rushed simultaneous stop.
        const baseDelay = i * 0.22;
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
        return reel.stopOn(stops[i], baseDelay, false);
      })();

      // Fire audio + featured-state callbacks once this reel has actually
      // landed. Wrap with .catch so a single reel failure doesn't take down
      // Promise.all and leave the post-stop cleanup unrun.
      return stopPromise
        .then(() => {
          this.audioHooks.onReelStopped?.(i);
          if (this.reelHasVisibleScatter(i, stops[i])) {
            this.audioHooks.onScatterLanded?.(i);
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
    this.restoreLiftedObjects();
    this.clearWinLines();
    const allCells: Array<[number, number]> = [];
    for (const combo of winResult.combinations) {
      for (const c of combo.cells) allCells.push(c);
    }
    this.applyCellHighlight(allCells);
    this.buildDecoration(winResult.combinations);
    this.liftWinningObjects(allCells);
    // ways-light comet through every winning connection (single + multi wins).
    for (const combo of winResult.combinations) this.fireWaysLight(combo);
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
    this.restoreLiftedObjects();          // return the previous combo's objects
    this.clearWinLines();                 // clear the previous combo's line
    this.applyCellHighlight(combo.cells); // enlarge-pulse this combo
    this.buildDecoration([combo]);
    this.liftWinningObjects(combo.cells); // raise this combo's objects above the line
    // amount shown during the one-time tally; omitted in the resting loop.
    if (amountText) this.spawnComboAmount(combo, amountText);
  }

  /** Winning cells grouped left→right by reel → comet through the connection.
   *  Purely visual; self-cleaning (winPresentation `ways-light-comet`). */
  private fireWaysLight(combo: WinCombination): void {
    if (!waysLightConfig.enabled) return;
    const byReel = new Map<number, Array<{ x: number; y: number }>>();
    for (const [row, reel] of combo.cells) {
      const r = resolveAnchor(cellAnchor(reel, row), this.grid);
      const arr = byReel.get(reel) ?? [];
      arr.push({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
      byReel.set(reel, arr);
    }
    const reels = [...byReel.keys()].sort((a, b) => a - b).map(k => byReel.get(k)!);
    if (reels.length >= 2) void playWaysLight(this.waysLightContainer, reels);
  }

  clearHighlights() {
    this.restoreLiftedObjects();
    for (const reel of this.reels) {
      reel.clearHighlights();
      reel.clearAllStates();
    }
    this.clearWinLines();
    this.clearWinAmounts();
    clearAllWaysLight(); // kill any in-flight comet
  }

  /** Lift each winning cell's object layer above the win line. */
  private liftWinningObjects(cells: ReadonlyArray<[number, number]>): void {
    for (const [row, reel] of cells) {
      const cell = this.reels[reel]?.getVisibleCell(row);
      if (!cell) continue;
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
      this.reels[i].clearAllStates();
      const rows = winningRows.get(i);
      if (rows && rows.size > 0) this.reels[i].playWinStateOnRows(Array.from(rows));
    }
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
  private addTeaseGlow(reel: number, row: number): void {
    const r = resolveAnchor(cellAnchor(reel, row), this.grid);
    const g = new Graphics();
    this.drawSoftGlow(g, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.72, 0xFFE08A, 0.5);
    this.teaseGlowContainer.addChild(g);
  }

  private clearTeaseGlow(): void {
    for (const c of this.teaseGlowContainer.removeChildren()) c.destroy();
  }

  /** Build the win decoration, Fruit-Fortune style: a bold gold line through
   *  the winning symbols with node dots, plus light sparkles. The line DRAWS ON
   *  left→right (a reveal mask grows in width) and then stays solid. It lives
   *  in winLinesContainer (below the lifted symbol objects), so the symbols sit
   *  on top of the line. No frames, no glow wash, no dimming. */
  private buildDecoration(combos: ReadonlyArray<WinCombination>): void {
    const group = new Container();
    this.winLinesContainer.addChild(group);

    // Win-focus bloom — a soft radial behind each winning cell (in the win-line
    // colour), below the line/dots so wins pop without dimming the board.
    // Cleared with the rest of the decoration by clearWinLines().
    const bloom = new Container();
    group.addChild(bloom);
    const bloomSeen = new Set<string>();
    for (const combo of combos) {
      for (const p of this.comboPoints(combo)) {
        const k = `${Math.round(p.x)},${Math.round(p.y)}`;
        if (bloomSeen.has(k)) continue;
        bloomSeen.add(k);
        const gl = new Graphics();
        this.drawSoftGlow(gl, p.x, p.y, Math.max(p.w, p.h) * 0.6, this.winLineColor, 0.42);
        bloom.addChild(gl);
      }
    }

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
    // line — and its node dots — into view from left to right.
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

    const label = new Text({
      text,
      style: new TextStyle({
        fontFamily: "'Rubik', ui-sans-serif, system-ui, sans-serif",
        fontSize: 28,
        fontWeight: '900',
        fill: WIN_AMOUNT_COLOR,
        stroke: { color: 0x3a2400, width: 5 },
        dropShadow: { color: 0x000000, alpha: 0.55, blur: 5, distance: 3, angle: Math.PI / 2 },
      }),
    });
    label.anchor.set(0.5);
    label.x = cx;
    label.y = cy;
    label.alpha = 0;
    label.scale.set(0.6);
    this.winAmountsContainer.addChild(label);

    const tl = gsap.timeline({ onComplete: () => label.destroy() });
    tl.to(label, { alpha: 1, duration: 0.15, ease: 'power2.out' }, 0)
      .to(label.scale, { x: 1, y: 1, duration: 0.32, ease: 'back.out(2.5)' }, 0)
      .to(label, { y: cy - 42, duration: 1.1, ease: 'power1.out' }, 0)
      .to(label, { alpha: 0, duration: 0.4, ease: 'power1.in' }, 0.7);
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
