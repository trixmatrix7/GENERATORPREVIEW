// ReelSet — manages all 5 reels as a single unit on the PixiJS stage.
//
// Responsibilities beyond per-reel motion:
//   - Near-miss detection: if the final board has ≥2 scatters on ≥2 different
//     reels, decelerate every reel after the rightmost scatter slower to build
//     anticipation. Intensity scales with scatter count. Display-only — the
//     outcome itself is never altered.
//   - Win-cell highlighting and per-cell state triggers after the reels land.

import { Container, Graphics, Text, TextStyle, Rectangle, Sprite, Texture, FillGradient, Assets } from 'pixi.js';
import { gsap } from 'gsap';
import { Reel } from './Reel';
import { AnimatedSymbol, SYMBOL_WIDTH, SYMBOL_HEIGHT, SYMBOL_WIN_SHEETS, SYMBOL_SIZE_MULS } from './AnimatedSymbol';
import { CELL_HEIGHT, REEL_GAP } from './symbolMetrics';
import { getActiveGrid, type GridConfig } from '@/config/gridConfig';
import { resolveAnchor, cell as cellAnchor, reel as reelAnchor, grid as gridAnchor } from '@/engine/anchors';
import { CANVAS_THEME } from '@/config/canvasTheme';
import { SymbolId, fruitGiftTierId, type SymbolIdType } from '@/config/symbols';
import { numToHsl, hexToNum } from '@/config/color';
import { cellBackdropConfig } from '@/config/cellBackdrop';
import { symbolSizing } from '@/config/symbolSizing';
import { FALLBACK_TIMINGS } from '@/config/symbolAnimations';
import type { WinResult, WinCombination } from '@/engine/WinEvaluator';
import { HW_START_RESPINS, type HwRound } from '@/engine/holdAndWin';
import { DEFAULT_GAME_CONFIG, type GameConfig } from '@/engine/GameConfig';
import type { SymbolAtlasMap } from './SymbolAtlasLoader';
import { playWaysLight, clearAllWaysLight, waysLightConfig } from './effects/WaysLightComet';
import { waysImmersiveConfig, danceWinningObject, prefersReducedMotion } from './effects/WaysImmersive';
import { landingImpactConfig } from './effects/LandingImpact';
import { applyStickyWild, clearAllStickyWild, stickyWildConfig, type StickyHandle } from './effects/StickyWildShine';
import { getActiveTeasePreset, teaseTuning } from './effects/teaseRegistry';
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
  /** Fruit Stacks tumble: winners burst open (per cascade step). */
  onTumblePop?: (stepIdx: number) => void;
  /** A gift's ×N slams into the win plate. */
  onPlateImpact?: () => void;
  /** A gift's ×N detaches and starts flying to the plate. */
  onGiftFly?: () => void;
  onReelStopped?: (reelIdx: number) => void;
  /** Every reel of this spin has landed (all symbols dropped in) — used to
   *  stop the reel-spin rattle exactly when the spinning ends. */
  onAllReelsStopped?: () => void;
  onScatterLanded?: (reelIdx: number) => void;
  /** Classic win jingle, ONCE per winning spin below the marquee threshold —
   *  tier by win/bet multiple. Marquee wins keep their own music instead. */
  onWinJingle?: (tier: 'small' | 'normal' | 'big') => void;
  /** The TEASE engages (2nd visible scatter, gates arming) — start the riser
   *  + duck the music. */
  onTeaseStart?: () => void;
  /** The tease resolves: hit=true → 3+ scatters (FS flow takes over); miss →
   *  the riser must NOT resolve (cut + thud + near-silence beat). */
  onTeaseEnd?: (hit: boolean) => void;
  /** A money wild is visible on this stopped reel (cash-drop foley). */
  onWildLanded?: (reelIdx: number) => void;
  /** An expanding-wild reveal just started racing up this reel — the sound's
   *  slam is authored to land on the tower's lock-in beat (~0.42s). */
  onWildExpand?: (reelIdx: number) => void;
  /** Fires when a reel enters its near-miss slowdown phase, so the React
   *  layer can play a tease sound (rising tone, low rumble, etc.). */
  onNearMissTease?: (reelIdx: number) => void;
  /** Fires once per winning combination during the sequential win reveal, so
   *  the React layer can play a rising-pitch step. `index` is 0-based. */
  /** A winning connection is revealed. `symbolId` lets the theme play that
   *  symbol's own voice (goat bleat, cow moo, corn pop) instead of one
   *  generic chime. */
  onWinStep?: (index: number, total: number, symbolId?: number) => void;
}

/** The plant multiplier BADGE — a centred square field the studio can recolour
 *  and re-font live (Noski). Frame + background + number colour + font are all
 *  parameters (setMultiBadgeParam). */
export const multiBadgeConfig = {
  bgColor: 0x14260d, bgAlpha: 0.9,
  borderColor: 0x7ef23e, borderWidth: 3,
  numberColor: 0xCFFF7A,
  fontFamily: "'Rubik', ui-sans-serif, system-ui, sans-serif",
  sizeFrac: 0.6,   // square side as a fraction of the reel width (smaller than the old ring)
  corner: 12,
};

/** Live-adjustable look of the 1×1 wild LOCK backing (the panel + frame behind
 *  the pot when a wild pops on a cell). Frame + backdrop colour/opacity are all
 *  studio parameters (setOneWildParam). frameWidth 0 = no frame (default). */
export const oneWildConfig = {
  backdropColor: 0x0b0d14, backdropAlpha: 1,
  frameColor: 0x7ef23e, frameWidth: 0,
};

/** Live-adjustable ×N label on the FRUIT GIFT symbols (Noski: font felt off —
 *  it was a mix of Arial and Poppins across the five draw sites; now ONE
 *  config drives them all). Position = anchor on the symbol cell, angle =
 *  diagonal tilt in degrees. Studio params fruitMulti* feed this.
 *  LOOK = the intro-art ×500 (baked gold balloon numerals): chunky rounded
 *  UPRIGHT font + vertical gold gradient + chocolate outline — rebuilt
 *  procedurally so any value works without baking 500 art variants. */
export const fruitMultiConfig = {
  fontFamily: "'Baloo 2', 'Rubik', ui-sans-serif, system-ui, sans-serif",
  color: 0xffd21e,
  size: 38,        // px on the grid — Winna-vermessen: Ziffern-Cap ~0.35 der Zellhoehe
  pos: 'unten',    // anchor on the symbol, see FRUIT_MULTI_POS
  angleDeg: 0,     // diagonal tilt
};

/** Vertical 3-stop gradient derived from the base colour (intro-art recipe:
 *  creamy top → base → deeper/warmer bottom). Works for any param colour. */
function fruitMultiGradientFill(base: number): FillGradient {
  const r = (base >> 16) & 255, g = (base >> 8) & 255, b = base & 255;
  const mix = (c: number, t: number, w: number) => Math.round(c + (t - c) * w);
  const toHex = (rr: number, gg: number, bb: number) => (rr << 16) | (gg << 8) | bb;
  const top = toHex(mix(r, 255, 0.55), mix(g, 255, 0.55), mix(b, 255, 0.45));
  // bottom: darken + push warm (red keeps, green drops harder → gold turns orange)
  const bot = toHex(Math.round(r * 0.93), Math.round(g * 0.62), Math.round(b * 0.55));
  const grad = new FillGradient(0, 0, 0, 1);
  grad.addColorStop(0, top);
  grad.addColorStop(0.48, base);
  grad.addColorStop(1, bot);
  return grad;
}

/** Anchor → [x,y] fraction inside the cell. 'unten' = the reference look
 *  (value hangs at the gift's bottom edge, Winna construct). */
export const FRUIT_MULTI_POS: Record<string, [number, number]> = {
  'mitte': [0.5, 0.5], 'oben': [0.5, 0.16], 'unten': [0.5, 0.95],
  'links': [0.2, 0.5], 'rechts': [0.8, 0.5],
  'oben-links': [0.2, 0.16], 'oben-rechts': [0.8, 0.16],
  'unten-links': [0.2, 0.95], 'unten-rechts': [0.8, 0.95],
};

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
  /** Optional frame-by-frame GROW clip (Crack Farm plant). When set, a
   *  bottom-up wild landing plays these frames (sprout → full plant) in place
   *  of the static mask-wipe reveal. The last frame must match
   *  expandWildTexture (wild_column.png) so the freeze onto the crisp static
   *  tower is seamless. Relocation glides still use the static art. */
  private growSheet: Texture[] | null = null;
  private growSheetFps = 40;
  /** Reels currently covered by a full expanding-wild tower. Their cells are
   *  hidden behind the opaque clear-beat + tower art, so EVERY win
   *  presentation (win states, dim/highlight, object lifts, sticky borders)
   *  must skip them — ONLY the tower may show; it pulses as the wild instead.
   *  Cleared with the sticky-reveal lifecycle (next spin / clear). */
  private readonly expandedReels = new Set<number>();
  /** Active FS wild-expansion mode (set by PixiApp for the round): in
   *  'perSpin' EVERY reel with a visible wild becomes fully wild for the
   *  evaluation; in 'sticky' only while the tower cap is not yet reached.
   *  A scatter behind such a reel is COVERED and must not count for the
   *  tease/trigger (Noski: "das verdeckte Scatter zählt nicht"). */
  public fsExpandMode: 'perSpin' | 'sticky' | null = null;
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
  /** True while the tease riser audio is live (guards the end hook so a
   *  skip outside a tease never fires the miss-thud). */
  private teaseAudioOn = false;

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
    this.clipMask = mask;
    this.clipRect = { w: gridRect.w, h: gridRect.h };

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
    this.roamGlideByReel.clear(); // sprites themselves die with stickyRevealObjects below
    this.glideArrivalReels.clear();
    // Un-hide any reel a ghost-mode plant covered.
    for (const r of this.expandHiddenReels) { try { if (this.reels[r]?.container) this.reels[r].container.alpha = 1; } catch { /* torn down */ } }
    this.expandHiddenReels = [];
    // The pad row lives in stickyContainer, which is about to be emptied —
    // drop our references so ensurePads() rebuilds it next round.
    this.killPadTweens();
    this.padLayer = null;
    this.padSprites = [];
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
    back.roundRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h, rad).fill({ color: oneWildConfig.backdropColor, alpha: oneWildConfig.backdropAlpha });
    back.roundRect(-rect.w / 2 + 3, -rect.h / 2 + 3, rect.w - 6, rect.h * 0.44, rad * 0.8).fill({ color: 0xffffff, alpha: 0.05 });
    if (oneWildConfig.frameWidth > 0) {
      const fw = oneWildConfig.frameWidth;
      back.roundRect(-rect.w / 2 + fw / 2, -rect.h / 2 + fw / 2, rect.w - fw, rect.h - fw, rad)
        .stroke({ color: oneWildConfig.frameColor, width: fw, alignment: 0.5 });
    }
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

  /** Frame-by-frame plant-grow clip for bottom-up wild landings (Crack Farm).
   *  Pass null to fall back to the static mask-wipe reveal. */
  setExpandGrowSheet(frames: Texture[] | null, fps = 40): void {
    this.growSheet = frames && frames.length ? frames : null;
    if (fps) this.growSheetFps = fps;
  }

  /** startSpin WITHOUT clearing the sticky/mechanic overlays (used by
   *  mechanics that re-roll the reels mid-choreography). */
  private startSpinKeepShowcase(): void {
    for (let i = 0; i < this.reels.length; i++) {
      // A reel under a STANDING plant stays hidden while it spins — otherwise
      // its strip shows through as symbols sliding behind the plant (Noski).
      // The plant replaces that column entirely.
      if (this.expandedReels.has(i)) {
        this.reels[i].container.alpha = 0;
        if (!this.expandHiddenReels.includes(i)) this.expandHiddenReels.push(i);
      }
      this.reels[i].startSpin();
    }
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
  /** Growth choreography for the wild expansion: 'race' = the column races
   *  out of the landing cell in both directions (Vice money tower);
   *  'bottom-up' = the landed wild SLIDES DOWN to the reel floor and the
   *  plant GROWS UP out of it (Crack Farm mutant bean). */
  expandGrowth: 'race' | 'bottom-up' = 'race';

  /** Expanding-wild look. `shine` = the gold AAA border/gloss frame around the
   *  reel at lock-in (Vice money tower); Crack Farm turns it OFF (Noski: the
   *  yellow frame "fuckt mich ab"). `plantAlpha` < 1 makes the standing plant
   *  translucent so it reads as a growing ghost on the blank reel, matching
   *  the roaming traveller. */
  expandStyle: { shine: boolean; plantAlpha: number } = { shine: true, plantAlpha: 1 };

  /** Reels whose symbol container was hidden behind a GHOST-mode expanding
   *  wild (Crack Farm) — the plant sits on the blank reel window instead of a
   *  black clear-panel. Alpha restored on clearStickyWilds. */
  private expandHiddenReels: number[] = [];

  // ── PLANT PADS (Crack Farm relocation choreography) ──────────────────────
  // Instead of floating across the board, a plant SINKS out of its reel and a
  // row of glowing green pads under the grid picks the next spot: they pulse,
  // the highlight whips left/right between reels, locks on one — and the
  // plant pushes back UP out of that pad. Used for the free-spins position
  // switch and (later) the base-game feature.
  private padLayer: Container | null = null;
  private padSprites: Graphics[] = [];
  private padTweens: gsap.core.Tween[] = [];

  /** Build (once) the row of pads sitting just under the reel window. */
  private ensurePads(): Container {
    if (this.padLayer) return this.padLayer;
    const layer = new Container();
    layer.eventMode = 'none';
    const g = resolveAnchor(gridAnchor, this.grid);
    for (let i = 0; i < this.grid.reelCount; i++) {
      const rr = resolveAnchor(reelAnchor(i), this.grid);
      const pad = new Graphics();
      // DEZENT (Noski: the first pass read as a big AI blob) — a thin, wide
      // sliver of light on the barn floor, not a glowing ball.
      const w = rr.w * 0.62, h = 7;
      pad.ellipse(0, 0, w * 0.5, h * 0.9).fill({ color: 0x7CFF4F, alpha: 0.16 });
      pad.ellipse(0, 0, w * 0.34, h * 0.55).fill({ color: 0xBFFF9A, alpha: 0.34 });
      pad.ellipse(0, 0, w * 0.16, h * 0.32).fill({ color: 0xEFFFE2, alpha: 0.55 });
      pad.blendMode = 'add'; // reads as light on the dark barn floor
      pad.position.set(rr.x + rr.w / 2, g.y + g.h + 7);
      pad.alpha = 0;
      pad.scale.set(0.6, 0.6);
      pad.eventMode = 'none';
      layer.addChild(pad);
      this.padSprites.push(pad);
    }
    this.stickyContainer.addChild(layer);
    this.padLayer = layer;
    return layer;
  }

  private killPadTweens(): void {
    for (const t of this.padTweens) t.kill();
    this.padTweens = [];
  }

  /** Fade every pad out (end of the choreography). */
  hidePads(ms = 0.25): void {
    if (!this.padLayer) return;
    this.killPadTweens();
    for (const pad of this.padSprites) {
      this.padTweens.push(gsap.to(pad, { alpha: 0, duration: ms, ease: 'power1.in' }));
      this.padTweens.push(gsap.to(pad.scale, { x: 0.6, y: 0.6, duration: ms, ease: 'power1.in' }));
    }
  }

  /** All pads breathe faintly — "something is about to pick a spot". */
  private padsIdle(): void {
    this.ensurePads();
    this.killPadTweens();
    this.padSprites.forEach((pad, i) => {
      gsap.killTweensOf(pad); gsap.killTweensOf(pad.scale);
      pad.alpha = 0.22; pad.scale.set(0.8, 0.8);
      this.padTweens.push(gsap.to(pad, {
        alpha: 0.4, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: i * 0.06,
      }));
    });
  }

  /** Light exactly ONE pad hard (the current candidate). */
  private padFocus(idx: number): void {
    this.padSprites.forEach((pad, i) => {
      const on = i === idx;
      gsap.killTweensOf(pad); gsap.killTweensOf(pad.scale);
      pad.alpha = on ? 0.85 : 0.14;
      // Widen rather than balloon — keeps it a light sliver, not a blob.
      pad.scale.set(on ? 1.3 : 0.8, on ? 1.15 : 0.8);
    });
  }

  /** The pad tease: the highlight whips between reels, each hop quicker than
   *  the last, then LOCKS on `target`. Resolves when the lock lands. */
  private playPadTease(target: number): Promise<void> {
    this.padsIdle();
    const n = this.grid.reelCount;
    const hops: number[] = [];
    let cur = Math.floor(Math.random() * n);
    // Bounce across the row, then settle on the target.
    for (let i = 0; i < 7; i++) {
      cur = (cur + (i % 2 === 0 ? 3 : n - 2)) % n;
      hops.push(cur);
    }
    hops.push(target);
    return new Promise(resolve => {
      const tl = gsap.timeline({ onComplete: () => resolve() });
      this.padTweens.push(tl as unknown as gsap.core.Tween);
      let t = 0;
      let step = 0.11;
      hops.forEach((h, i) => {
        const last = i === hops.length - 1;
        tl.call(() => {
          this.padFocus(h);
          if (last) {
            const pad = this.padSprites[h];
            gsap.fromTo(pad.scale, { x: 1.9, y: 2.1 }, { x: 1.45, y: 1.6, duration: 0.28, ease: 'back.out(2.4)' });
          }
        }, undefined, t);
        t += step;
        step = Math.max(0.055, step * 0.88); // accelerate
      });
      tl.to({}, { duration: 0.14 }); // brief hold on the locked pad
    });
  }

  async playExpandingWildReveal(
    opts: { isLive?: () => boolean; turbo?: boolean; sticky?: boolean; force?: boolean; roaming?: boolean;
            /** Crack Farm: standing plants change reel every spin (sink out → pads → rise). */
            relocate?: boolean;
            /** Crack Farm v2: weights for how many plants a round grows (index 0 = 1 plant).
             *  Present = the round draws 1..N instead of the flat stickyTowerCap. */
            plantCountWeights?: number[] } = {},
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
    let relocateActive = false;
    const displayStops = this.config.reelLengths.map(len => Math.floor(Math.random() * len));
    const landingRows: number[] = [];

    if (opts.sticky && opts.relocate) {
      // CRACK FARM STICKY: the plants are KEPT for the round but they do NOT
      // stand still — every spin they sink out and push back up somewhere
      // else (Noski: "zwischen den spins immer dieser positions wechsel").
      // Count stays; a fresh wild landing can add one, up to the cap.
      // How many plants this ROUND may grow. With plantCountWeights the count
      // is drawn once per round from the weights (Noski: "meistens 1-2,
      // manchmal 3, selten 4, ganz selten 5") and then held — redrawing every
      // spin would make plants blink in and out instead of relocating.
      let cap = (this.config as unknown as { stickyTowerCap?: number }).stickyTowerCap ?? 2;
      if (opts.plantCountWeights?.length) {
        if (this.roundPlantCap === null) {
          const weights = opts.plantCountWeights;
          const total = weights.reduce((a, b) => a + b, 0);
          let x = Math.random() * total;
          let n = 1;
          for (let i = 0; i < weights.length; i++) {
            x -= weights[i];
            if (x < 0) { n = i + 1; break; }
          }
          this.roundPlantCap = Math.min(n, this.grid.reelCount);
        }
        cap = this.roundPlantCap;
      }
      const standing = Array.from(this.expandedReels);
      this.startSpin(); // wipes the old plants — they are re-placed below
      gen = this.stickyRevealGen;
      // A plant is an OVERLAY, so it can rise on ANY reel — including reel 0,
      // whose strip carries no wild. (Settlement + the certified model place on
      // all five; restricting the display to wild-carrying reels would cap the
      // shown plants at 4 while the payout used 5.) The plant covers the reel
      // in ghost mode, so a "seed" sack is nice-to-have, not required.
      const allReels = Array.from({ length: this.grid.reelCount }, (_, i) => i)
        .filter(r => !this.expandedReels.has(r));
      const pool = allReels.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      // A wild landing anywhere this spin earns one extra plant (up to cap).
      const gained = reelIdxs.some(r => wildRowInWindow(r, displayStops[r]) !== null) ? 1 : 0;
      const want = Math.min(cap, Math.max(standing.length, 1) + gained);
      chosen = [];
      for (const r of pool) {
        if (chosen.length >= want) break;
        const hit = findWildStop(r);
        if (hit) displayStops[r] = hit.stop;   // land a sack under the plant when the strip has one
        chosen.push(r);
        // Bottom-up plants pop at the reel floor; the row only matters as the
        // seed-drop origin, which reels without a wild simply skip.
        landingRows.push(hit ? hit.row : this.grid.visibleRows - 1);
      }
      // Keep rows aligned with their reels when sorting.
      const paired = chosen.map((r, i) => ({ r, row: landingRows[i] })).sort((a, b) => a.r - b.r);
      chosen = paired.map(x => x.r);
      landingRows.length = 0;
      for (const x of paired) landingRows.push(x.row);
      // EVERY wild in the round becomes a plant — no stray 1×1 wilds (Noski:
      // "wilds die nicht zur pflanze werden das darf nicht sein"). So any
      // NON-plant reel whose window would show a wild is re-stopped to a
      // wild-free window; the only wilds on the board are the plants.
      const chosenSet = new Set(chosen);
      for (let r = 0; r < this.grid.reelCount; r++) {
        if (chosenSet.has(r)) continue;
        if (wildRowInWindow(r, displayStops[r]) === null) continue;
        const len = this.config.reelLengths[r];
        for (let k = 1; k <= len; k++) {
          const s = (displayStops[r] + k) % len;
          if (wildRowInWindow(r, s) === null) { displayStops[r] = s; break; }
        }
      }
      // EVERY previously standing plant DANCES to a new reel (Noski: the bug
      // was only the first plant swapping while the rest flew out the bottom
      // and re-grew). All ghosts mix simultaneously; each locks when its own
      // expandOneWildReel runs — and that loop is sequential, so they lock one
      // after another (mix → 1 locks → rest keep mixing → 2 locks → 3 locks).
      // Any NEW plant this spin (chosen beyond the standing count) grows fresh.
      if (!opts.turbo && standing.length > 0 && chosen.length > 0) {
        relocateActive = true;
        const nReloc = Math.min(standing.length, chosen.length);
        for (let i = 0; i < nReloc; i++) this.startPlantRelocate(standing[i], chosen[i]);
        for (const extra of standing.slice(nReloc)) this.sinkPlantGhost(extra);
      }
    } else if (opts.sticky) {
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
    } else if (opts.roaming) {
      // ROAMING PLANT (crack-farm 3sc FS): EXACTLY ONE random wild-capable
      // reel sprouts fully wild this spin — guaranteed action every spin,
      // cleared on the next one. The chosen reel's stop is forced so the
      // wild visibly lands before the plant grows.
      // WS-Referenz (research 14 §3): steht vom VORHERIGEN Free Spin schon
      // eine Pflanze, verschwindet sie nicht — sie hebt ab und GLEITET über
      // die rollenden Reels zu ihrem neuen Reel (Pop-out + Lean), parkt
      // dort und slammt ein (preGrown-Pfad statt Neu-Wachsen).
      const glideFrom = !opts.turbo && this.expandedReels.size === 1
        ? Array.from(this.expandedReels)[0]
        : null;
      this.startSpin();
      gen = this.stickyRevealGen;
      chosen = [];
      if (reelIdxs.length > 0) {
        const pick = reelIdxs[Math.floor(Math.random() * reelIdxs.length)];
        const hit = findWildStop(pick);
        if (hit) {
          displayStops[pick] = hit.stop;
          chosen = [pick];
          landingRows.push(hit.row);
        }
      }
      if (glideFrom !== null && chosen.length === 1) {
        relocateActive = this.startPlantRelocate(glideFrom, chosen[0]);
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

    // Sequential, one reel finishing before the next starts (like the ref) —
    // this is the LOCK ORDER: each relocating plant locks in turn while the
    // others keep standing/mixing. A reel with a dancing ghost glide-pops
    // (preGrown); a fresh plant grows.
    for (let k = 0; k < chosen.length; k++) {
      if (this.stickyRevealGen !== gen || !live()) return opts.sticky ? allExpanded() : [];
      await this.expandOneWildReel(chosen[k], landingRows[k], !!opts.turbo, relocateActive && this.roamGlideByReel.has(chosen[k]));
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

  /** BASE-GAME PLANT FEATURE reveal. The reels have already stopped on the
   *  spin's board; the screen then DARKENS (Noski: "der slot soll so
   *  verdunkelt werden"), the green pads light up, and 1..5 plants — each with
   *  its own multiplier — RISE out of the soil on the given reels. The caller
   *  then evaluates the board with those reels wild and presents the win.
   *
   *  Placement is CALLER-CHOSEN (derived from the spin stops so settlement and
   *  display agree), never random here. Returns the reels a plant now stands
   *  on, sorted — the caller marks exactly these wild.
   */
  async playBaseFeatureReveal(
    plants: ReadonlyMap<number, number>,
    opts: { isLive?: () => boolean; turbo?: boolean } = {},
  ): Promise<number[]> {
    const live = opts.isLive ?? (() => true);
    const reels = [...plants.keys()].filter(r => r >= 0 && r < this.grid.reelCount).sort((a, b) => a - b);
    if (reels.length === 0) return [];

    // Fresh reveal generation — a spin() cancels anything still in flight.
    this.clearStickyWilds();
    const gen = ++this.stickyRevealGen;

    // 1) DARKEN the whole reel field, deeper than the FS momentary dim — the
    //    feature owns the screen. Sits above the reels, below the plants.
    const gr = resolveAnchor(gridAnchor, this.grid);
    const veil = new Graphics();
    veil.rect(gr.x - 14, gr.y - 14, gr.w + 28, gr.h + 28).fill({ color: 0x03060c, alpha: 1 });
    veil.alpha = 0;
    veil.eventMode = 'none';
    this.stickyContainer.addChildAt(veil, 0);
    this.stickyRevealObjects.push(veil);
    this.stickyRevealTweens.push(gsap.to(veil, { alpha: 0.72, duration: 0.3, ease: 'power2.out' }));

    // 2) Pads light + tease across the target reels, then the plants rise.
    this.padsIdle();
    await new Promise(res => setTimeout(res, opts.turbo ? 120 : 300));
    if (this.stickyRevealGen !== gen || !live()) return [];

    const bottomRow = this.grid.visibleRows - 1;
    for (const reel of reels) {
      if (this.stickyRevealGen !== gen || !live()) break;
      // preGrown pushes the plant up out of the lit pad (the same seat used by
      // the free-spin relocation), so the base feature reuses that motion.
      await this.expandOneWildReel(reel, bottomRow, !!opts.turbo, true);
      this.setTowerMultiplier(plants);
      await new Promise(res => setTimeout(res, opts.turbo ? 70 : 170));
    }
    if (this.stickyRevealGen !== gen || !live()) return Array.from(this.expandedReels).sort((a, b) => a - b);
    this.hidePads(0.3);
    return reels;
  }

  /** Ease the base-feature darken back out and tear the plants down. */
  endBaseFeatureReveal(): void {
    // undim: fade the veil (it lives in stickyRevealObjects) before the clear.
    for (const o of this.stickyRevealObjects) {
      if (o instanceof Graphics) this.stickyRevealTweens.push(gsap.to(o, { alpha: 0, duration: 0.35, ease: 'power2.inOut' }));
    }
    this.schedule(() => this.clearStickyWilds(), 380);
  }

  /** The roaming plant's TRAVELER sprite: lifts off its old reel, pops out
   *  slightly oversized, leans into the travel direction and glides ABOVE the
   *  rolling reels to the new reel, where it settles back down (Wild-Storm
   *  roam, research 14 §3 — continuous glide, no hop). Registered on the NEW
   *  spin's sticky lifecycle, so an aborted spin cleans it up. The preGrown
   *  park in expandOneWildReel swaps it for the real tower. */
  /** Relocating plant ghosts, KEYED BY TARGET REEL — several plants can dance
   *  at once in the sticky round (Noski: every plant must swap, not just the
   *  first). Each locks when its own expandOneWildReel runs (sequential). */
  private roamGlideByReel = new Map<number, Sprite>();

  /** RELOCATION CHOREOGRAPHY (Crack Farm): the standing plant SINKS out of
   *  its reel, the pad row under the grid whips its highlight left/right and
   *  locks on the new reel — and expandOneWildReel then pushes the plant back
   *  UP out of that pad. Replaces the old float-across-the-board roam. */
  /** Sink ONE plant out through its reel floor (no pad tease). Used for the
   *  extra plants when several relocate at once — the pads only narrate the
   *  first one, the rest just clear the board. */
  private sinkPlantGhost(reelIdx: number): void {
    const tex = this.expandWildTexture;
    if (!tex) return;
    const rr = resolveAnchor(reelAnchor(reelIdx), this.grid);
    const ghost = new Sprite(tex);
    ghost.anchor.set(0.5, 1);
    ghost.scale.set(this.expandGrowth === 'bottom-up'
      ? Math.min(rr.h / tex.height, (rr.w * 1.3) / tex.width)
      : (rr.w * 0.98) / tex.width);
    ghost.position.set(rr.x + rr.w / 2, rr.y + rr.h);
    ghost.alpha = this.expandStyle.plantAlpha;
    ghost.eventMode = 'none';
    this.stickyContainer.addChild(ghost);
    this.stickyRevealObjects.push(ghost);
    const tl = gsap.timeline();
    this.stickyRevealTweens.push(tl);
    tl.to(ghost.scale, { y: ghost.scale.y * 0.9, duration: 0.1, ease: 'power2.out' }, 0);
    tl.to(ghost, { y: rr.y + rr.h + rr.h * 0.85, duration: 0.32, ease: 'power2.in' }, 0.06);
    tl.to(ghost, { alpha: 0, duration: 0.2, ease: 'power1.in' }, 0.2);
    tl.call(() => { if (ghost.parent) ghost.parent.removeChild(ghost); }, undefined, 0.4);
  }

  /** Set while a relocating plant has GLIDED into its target reel — the reveal
   *  there locks it in place (small pop) instead of rising it from the floor. */
  /** Target reels whose relocating ghost has arrived and locked — the reveal
   *  there does the clean glide-pop (per reel, so several can lock in turn). */
  private glideArrivalReels = new Set<number>();

  private startPlantRelocate(fromReel: number, toReel: number): boolean {
    const tex = this.expandWildTexture;
    if (!tex) return false;
    const rFrom = resolveAnchor(reelAnchor(fromReel), this.grid);
    const rTo = resolveAnchor(reelAnchor(toReel), this.grid);
    const ghost = new Sprite(tex);
    ghost.anchor.set(0.5, 1);
    ghost.scale.set(this.expandGrowth === 'bottom-up'
      ? Math.min(rFrom.h / tex.height, (rFrom.w * 1.3) / tex.width)
      : (rFrom.w * 0.98) / tex.width);
    const floorY = rFrom.y + rFrom.h;         // reel floor — stays level (no sink)
    ghost.position.set(rFrom.x + rFrom.w / 2, floorY);
    ghost.alpha = this.expandStyle.plantAlpha;
    ghost.eventMode = 'none';
    this.stickyContainer.addChild(ghost);
    this.stickyRevealObjects.push(ghost);
    this.roamGlideByReel.set(toReel, ghost);

    // WILD-STORM DANCE (Noski, ref: 'wild storm .mov' FS). The tornado wild
    // there stays DEAD VERTICAL and LEVEL — it never tilts. Between spins it
    // swipes left↔right ACROSS the reels a couple of times (a "where will it
    // land?" shuffle), then glides onto the target and STANDS STILL. Speed
    // reads through a horizontal squash-stretch in the travel direction, never
    // a lean; the arrival is a soft ease, never a springy overshoot.
    const baseSX = ghost.scale.x;
    const baseSY = ghost.scale.y;
    const cxOf = (r: number) => { const a = resolveAnchor(reelAnchor(r), this.grid); return a.x + a.w / 2; };
    const last = this.grid.reelCount - 1;
    const fromX = rFrom.x + rFrom.w / 2;
    const toX = rTo.x + rTo.w / 2;
    // Dance to the opposite outer reel, back across, then home — always visibly
    // travelling "über die reels", ending on the target.
    const farA = fromReel <= last / 2 ? last : 0;
    const route = [farA, farA === 0 ? last : 0, toReel];
    const tl = gsap.timeline();
    this.stickyRevealTweens.push(tl);
    // Tiny lift so the base clears the reel lip; it then stays LEVEL the whole
    // dance (no vertical bob, no arc — 'gerade bleiben').
    tl.to(ghost, { y: floorY - 6, duration: 0.10, ease: 'power2.out' }, 0);
    let t = 0.06, dur = 0.32, prevX = fromX;   // slower swipes (Noski: swap was too fast in FS)
    for (let i = 0; i < route.length; i++) {
      const isFinal = i === route.length - 1;
      const tx = isFinal ? toX : cxOf(route[i]);
      const stretch = Math.min(1.16, 1 + Math.min(0.16, Math.abs(tx - prevX) / (rFrom.w * 6)));
      // Smooth level swipe — sine while shuffling, a clean decel onto the target.
      tl.to(ghost, { x: tx, duration: dur, ease: isFinal ? 'power3.out' : 'sine.inOut' }, t);
      // Horizontal squash-stretch → speed cue WITHOUT any tilt.
      tl.to(ghost.scale, { x: baseSX * (isFinal ? 1 : stretch), y: baseSY * (isFinal ? 1 : 0.98), duration: dur * 0.5, ease: 'power1.out' }, t);
      tl.to(ghost.scale, { x: baseSX, y: baseSY, duration: dur * 0.5, ease: 'power2.in' }, t + dur * 0.5);
      prevX = tx;
      t += dur * 0.9;
      dur = Math.max(0.22, dur * 0.92);       // each swipe a touch quicker (gentle decay)
    }
    // Settle level and LOCK ON — the plant does NOT fade out (Noski:
    // "verschwindet kurz durchsichtig"). It stays fully visible and FIXED on the
    // target reel while the other reels drop; the opaque backdrop pop hides the
    // reel rolling behind it. The real tower reveal takes over seamlessly —
    // clearRoamGlide (in expandOneWildReel's preGrown branch) removes this ghost
    // exactly as the tower pops in, so there is never an empty/transparent gap.
    tl.to(ghost, { y: floorY, duration: 0.12, ease: 'power2.inOut' }, t);
    t += 0.15;
    tl.call(() => {
      this.glideArrivalReels.add(toReel);
      // LOCK ON: hide the target reel so its spin can't show through the
      // translucent plant — it now stands FIXED on the blank reel window
      // (barn bg) exactly like the parked tower, while the OTHER reels drop.
      const rc = this.reels[toReel]?.container;
      if (rc && !this.expandHiddenReels.includes(toReel)) { rc.alpha = 0; this.expandHiddenReels.push(toReel); }
    }, undefined, t);
    return true;
  }

  private startRoamGlide(fromReel: number, toReel: number): boolean {
    const tex = this.expandWildTexture;
    if (!tex) return false;
    const rFrom = resolveAnchor(reelAnchor(fromReel), this.grid);
    const rTo = resolveAnchor(reelAnchor(toReel), this.grid);
    const spr = new Sprite(tex);
    spr.anchor.set(0.5, 1); // bottom-anchored like the standing plant
    // Same fit rule as the standing tower, so the traveller and the parked
    // plant are exactly the same size (height-fit for the squat plant art).
    spr.scale.set(this.expandGrowth === 'bottom-up'
      ? Math.min(rFrom.h / tex.height, (rFrom.w * 1.3) / tex.width)
      : (rFrom.w * 0.98) / tex.width);
    spr.position.set(rFrom.x + rFrom.w / 2, rFrom.y + rFrom.h);
    spr.alpha = this.expandStyle.plantAlpha; // same translucency as the standing plant
    spr.eventMode = 'none';
    this.stickyContainer.addChild(spr);
    this.stickyRevealObjects.push(spr);
    this.roamGlideByReel.set(toReel, spr);
    const base = spr.scale.x;
    const tl = gsap.timeline();
    this.stickyRevealTweens.push(tl);
    const cxOf = (r: number) => {
      const a = resolveAnchor(reelAnchor(r), this.grid);
      return a.x + a.w / 2;
    };
    // Lift + pop-out (the reference funnel overflows its panel while roaming).
    tl.to(spr.scale, { x: base * 1.12, y: base * 1.12, duration: 0.2, ease: 'back.out(1.8)' }, 0);
    tl.to(spr, { y: rFrom.y + rFrom.h - 14, duration: 0.2, ease: 'power2.out' }, 0);

    // FAST LEFT/RIGHT TEASE (Noski): instead of one slow drift, the plant
    // whips between the outer reels several times — each pass quicker and
    // shorter than the last — before snapping into its real reel. Reads as a
    // "where will it land?" tease with real speed.
    const last = this.grid.reelCount - 1;
    const teaseStops = [last, 0, last, 1, toReel];
    let t = 0.18;
    let dur = 0.2;
    let prevX = rFrom.x + rFrom.w / 2;
    for (let i = 0; i < teaseStops.length; i++) {
      const isFinal = i === teaseStops.length - 1;
      const targetX = isFinal ? rTo.x + rTo.w / 2 : cxOf(teaseStops[i]);
      const d = Math.sign(targetX - prevX) || 1;
      tl.to(spr, {
        x: targetX,
        duration: dur,
        ease: isFinal ? 'back.out(1.5)' : 'power2.inOut',
      }, t);
      // Lean hard into each dash, whip back out of it.
      tl.to(spr, { rotation: d * (isFinal ? 0.05 : 0.26), duration: dur * 0.55, ease: 'power2.out' }, t);
      tl.to(spr, { rotation: 0, duration: dur * 0.6, ease: 'power1.inOut' }, t + dur * 0.55);
      prevX = targetX;
      t += dur * 0.86;          // slight overlap keeps it flowing, not steppy
      dur = Math.max(0.13, dur * 0.86); // each dash faster than the last
    }
    // Settle onto the new reel floor, tuck back to standing size — timed to
    // the end of the tease chain, not a fixed clock.
    tl.to(spr.scale, { x: base, y: base, duration: 0.22, ease: 'power2.in' }, t);
    tl.to(spr, { y: rTo.y + rTo.h, duration: 0.22, ease: 'power2.in' }, t);
    return true;
  }

  /** Remove the traveler the moment the REAL tower takes over (preGrown park).
   *  Destruction stays with the sticky lifecycle (the sprite is registered
   *  in stickyRevealObjects) — this only takes it off screen. */
  private clearRoamGlide(reel: number): void {
    const spr = this.roamGlideByReel.get(reel);
    if (!spr) return;
    this.roamGlideByReel.delete(reel);
    gsap.killTweensOf(spr);
    gsap.killTweensOf(spr.scale);
    if (spr.parent) spr.parent.removeChild(spr);
  }

  /** One reel's expansion: wild pops in its landing cell → the reel's other
   *  symbols vanish under an opaque clear-beat → the money column grows out of
   *  the landing cell to full reel height (masked to the reel) → impact flash
   *  + reel-sized AAA shine border. All overlays ride the sticky-reveal
   *  lifecycle, so the next spin clears everything.
   *  `preGrown` (roam glide park): the plant is ALREADY standing — the
   *  traveler slides off, the real column appears at full height instantly
   *  and only the lock-in slam plays (no seed-drop, no grow reveal). */
  private expandOneWildReel(reelIdx: number, row: number, turbo: boolean, preGrown = false): Promise<void> {
    return new Promise(resolve => {
      // Bill-riffle riser foley — its slam is authored to land on the
      // lock-in beat (~0.42s), matching T_RACE + the settle. The roam park
      // has no grow phase, so no riser — the landing-thud carries the beat.
      if (!preGrown) this.audioHooks.onWildExpand?.(reelIdx);
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
      // BOTTOM-UP growth: the plant grows out of the reel FLOOR, so a wild
      // landing on an upper row first SLIDES DOWN to the bottom cell (a seed
      // dropping into the soil) — the pop happens at the bottom row.
      // GHOST look (Crack Farm): the translucent plant grows on the BLANK reel
      // window — every black panel is suppressed and the reel's own symbols are
      // hidden by dropping the reel container's alpha (robust against the
      // settle-bounce cell rotation, unlike hiding individual cells).
      const ghost = !this.expandStyle.shine;
      const bottomUp = this.expandGrowth === 'bottom-up';
      const rows = this.grid.visibleRows;
      const potRow = bottomUp ? rows - 1 : row;
      const T_SLIDE = !preGrown && !ghost && bottomUp && row < rows - 1 ? 0.22 * speed : 0;
      if (preGrown || ghost) {
        // Roam park / ghost: the plant IS the reveal — no wild-pop backing
        // panel (that panel is an opaque black box behind the plant).
      } else if (bottomUp && row < rows - 1) {
        // Seed-drop beat: a copy of the 1×1 wild slides from the landing
        // cell down to the reel floor, then the pot pops there.
        const wildTex = this.config.theme.userAssetTextures?.get(SymbolId.WILD);
        const fromR = resolveAnchor(cellAnchor(reelIdx, row), this.grid);
        const toR = resolveAnchor(cellAnchor(reelIdx, rows - 1), this.grid);
        if (wildTex) {
          const seed = new Sprite(wildTex as Texture);
          seed.anchor.set(0.5);
          seed.position.set(fromR.x + fromR.w / 2, fromR.y + fromR.h / 2);
          const fit = Math.min(fromR.w, fromR.h) * 0.88;
          seed.width = fit; seed.height = fit;
          seed.eventMode = 'none';
          this.stickyContainer.addChild(seed);
          this.stickyRevealObjects.push(seed);
          this.stickyRevealTweens.push(gsap.to(seed, {
            y: toR.y + toR.h / 2, duration: T_SLIDE, ease: 'power2.in',
            onComplete: () => { if (seed.parent) seed.parent.removeChild(seed); },
          }));
        }
        this.schedule(() => this.popOneStickyWild(reelIdx, potRow, false), T_SLIDE * 1000);
      } else {
        this.popOneStickyWild(reelIdx, potRow, false);
      }


      // 2) clear-beat — hide what's behind the growing column.
      //    Default (Vice): a FULLY opaque panel over the reel.
      //    GHOST (Crack Farm): NO black panel — Noski saw it as a "schwarzer
      //    background der pflanze". Instead the reel's whole symbol container
      //    is dimmed to alpha 0, so the translucent plant sits on the same
      //    blank reel window as everywhere else (barn bg through the tint),
      //    never a black box. Restored on clearStickyWilds.
      let clear: Graphics | null = null;
      if (ghost) {
        const rc = this.reels[reelIdx]?.container;
        if (rc && !this.expandHiddenReels.includes(reelIdx)) {
          rc.alpha = 0;
          this.expandHiddenReels.push(reelIdx);
        }
      } else {
        clear = new Graphics();
        clear.roundRect(rr.x, rr.y, rr.w, rr.h, rad).fill({ color: 0x0b0d14, alpha: 1 });
        clear.alpha = 0;
        clear.eventMode = 'none';
        this.stickyContainer.addChild(clear);
        this.stickyRevealObjects.push(clear);
      }

      // 3) the column — IDENTICAL on every reel: width-fit, tower TOP aligned
      //    with the reel top (the head always shows; only the stack base may
      //    crop at the bottom). The art never stretches or shifts — the grow
      //    is a REVEAL MASK expanding from the landing cell in both directions.
      const tex = this.expandWildTexture ?? Texture.WHITE;
      const spr = new Sprite(tex);
      // 'race' anchors the column TOP (head always visible, base may crop);
      // 'bottom-up' anchors the plant BASE on the reel floor (the pot always
      // sits in the soil; the head reveals as the plant grows upward).
      if (bottomUp) {
        spr.anchor.set(0.5, 1);
        spr.position.set(cx, rr.y + rr.h);
      } else {
        spr.anchor.set(0.5, 0);
        spr.position.set(cx, rr.y);
      }
      // Fit: the Vice money tower is WIDTH-fit (tall narrow art). The Crack
      // Farm plant art is much squatter, so width-fitting would leave it far
      // short of the reel top — fit it to the reel HEIGHT instead and let the
      // wider art spill over the reel edges (capped at 1.3x reel width), which
      // is exactly how the reference towers overflow their column.
      spr.scale.set(bottomUp
        ? Math.min(rr.h / tex.height, (rr.w * 1.3) / tex.width)
        : (rr.w * 0.98) / tex.width);
      spr.alpha = 0;
      spr.eventMode = 'none';
      const mask = new Graphics();
      mask.eventMode = 'none';
      // The bottom-up mask only has to gate the plant's HEIGHT as it grows —
      // horizontally it must never clip, because the plant art deliberately
      // spills past the reel edges (Noski: the left leaf was being cut off).
      // So it runs a full reel-width wider on each side, with square corners
      // (a rounded corner would nibble the overhanging leaves).
      const overX = rr.w;
      const drawReveal = (t: number) => {
        mask.clear();
        if (bottomUp) {
          // The window grows from the reel FLOOR upward (plant growth).
          const topY = (rr.y + rr.h) - Math.max(cellR.h * 0.4, rr.h * t);
          mask.rect(rr.x - overX, topY, rr.w + overX * 2, (rr.y + rr.h) - topY).fill(0xffffff);
        } else {
          const topY = cellR.y + (rr.y - cellR.y) * t;
          const botY = (cellR.y + cellR.h) + ((rr.y + rr.h) - (cellR.y + cellR.h)) * t;
          mask.roundRect(rr.x - 1, topY, rr.w + 2, botY - topY, rad).fill(0xffffff);
        }
      };
      // preGrown (roam park): the plant arrives standing — mask opens fully.
      drawReveal(preGrown ? 1 : 0); // otherwise: exactly the landing cell (race) / the soil (bottom-up)
      this.stickyContainer.addChild(mask);
      spr.mask = mask;
      this.stickyContainer.addChild(spr);
      this.stickyRevealObjects.push(mask, spr);
      this.expandedTowerSprites.set(reelIdx, { spr, baseY: bottomUp ? rr.y + rr.h : rr.y, baseScale: spr.scale.x });

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
      // Bottom-up shifts every beat by the seed-drop slide. The roam park
      // compresses everything: the traveler already stands on the reel, so
      // the swap (clear panel + real column) happens near-instantly and only
      // the lock-in slam plays.
      const T_CLEAR = preGrown ? 0 : T_SLIDE + 0.32 * speed;
      const T_RACE = preGrown ? 0.04 : T_SLIDE + 0.40 * speed;
      // preGrown now PUSHES UP over 0.34s, so the lock-in slam waits for it
      // to actually seat instead of firing while it is still rising.
      // Crack Farm plays a real frame-by-frame GROW clip on the first landing.
      const useGrow = !preGrown && bottomUp && !!this.growSheet && this.growSheet.length > 1;
      // The bloom (aufgeh-Animation) plays 25% SLOWER so it reads clearly — the
      // race→lock window stretches with it, so the lock-in slam still lands on
      // the fully-open plant (Noski: "aufgeh animation 25% langsamer").
      const T_LOCK = preGrown ? 0.36 : T_RACE + 0.46 * speed * (useGrow ? 1.25 : 1);
      if (clear) tl.to(clear, { alpha: 1, duration: (preGrown ? 0.04 : 0.12) * speed, ease: 'power2.out' }, T_CLEAR);
      // The static tower fades in at T_RACE for the mask-wipe / roam paths; for
      // the grow clip it stays hidden until the bloom lands on the lock-in slam.
      if (!useGrow) tl.to(spr, { alpha: this.expandStyle.plantAlpha, duration: (preGrown ? 0.03 : 0.07) * speed, ease: 'power1.out' }, Math.max(0, T_RACE - 0.02 * speed));
      if (preGrown) {
        tl.call(() => this.clearRoamGlide(reelIdx), undefined, 0);
        const restY = rr.y + rr.h;
        if (this.glideArrivalReels.has(reelIdx)) {
          // GLIDED IN sideways (Wild-Storm relocation): the dance already set
          // it down straight — lock in with a CLEAN grow-in, no springy snap.
          this.glideArrivalReels.delete(reelIdx);
          spr.y = restY;
          const bsx = spr.scale.x, bsy = spr.scale.y;
          spr.scale.set(bsx * 0.9, bsy * 0.9);
          tl.to(spr.scale, { x: bsx, y: bsy, duration: 0.2, ease: 'back.out(1.6)' }, T_RACE);
        } else {
          // PUSH UP OUT OF THE PAD: the plant rises from below the reel floor
          // into place (used by the base-game feature reveal).
          spr.y = restY + rr.h * 0.95;
          tl.to(spr, { y: restY, duration: 0.34, ease: 'back.out(1.25)' }, T_RACE);
        }
        // Pads dim away as the plant seats itself.
        tl.call(() => this.hidePads(0.3), undefined, T_RACE + 0.2);
      } else if (useGrow) {
        // GROW CLIP: a dedicated sprite plays the sprout→full-plant frames on
        // the blank reel window. Its footprint matches the static tower's, so
        // freezing onto wild_column.png at the end is seamless. The bloom is
        // timed to COMPLETE on the lock-in slam (flash + board-thud punctuate
        // the moment the plant fully opens). spr's own scale is never touched
        // here, so the lock-in squash still reads off its resting baseScale.
        const gs = this.growSheet!;
        const last = gs.length - 1;
        drawReveal(1); // spr's mask fully open for the freeze-frame hand-off
        const grow = new Sprite(gs[0]);
        grow.anchor.set(0.5, 1);
        grow.position.set(cx, rr.y + rr.h);
        grow.scale.set((spr.height || rr.h) / gs[0].height);
        grow.alpha = this.expandStyle.plantAlpha;
        grow.eventMode = 'none';
        this.stickyContainer.addChild(grow);
        this.stickyRevealObjects.push(grow);
        const gi = { f: 0 };
        const growDur = Math.max(0.06, T_LOCK - T_RACE);
        this.stickyRevealTweens.push(gsap.to(gi, {
          f: last, duration: growDur, ease: 'power1.in', // accelerating bloom
          onUpdate: () => {
            const idx = Math.min(last, Math.max(0, Math.round(gi.f)));
            if (grow.texture !== gs[idx]) grow.texture = gs[idx];
          },
          onComplete: () => {
            spr.alpha = this.expandStyle.plantAlpha; // reveal crisp static tower
            if (grow.parent) grow.parent.removeChild(grow);
          },
          delay: T_RACE,
        }));
      } else {
        const reveal = { t: 0 };
        tl.to(reveal, {
          // Plant growth reads organic with a spring at the top (back.out);
          // the money column keeps its expo race-out.
          t: 1, duration: (bottomUp ? 0.52 : 0.46) * speed, ease: bottomUp ? 'back.out(1.1)' : 'expo.inOut',
          onUpdate: () => drawReveal(reveal.t),
        }, T_RACE);
      }
      // LOCK-IN — squash-settle: the column compresses under its own weight
      // and springs back. Top-anchored towers visibly sit down; the
      // bottom-anchored plant compresses into its pot (y stays fixed).
      const restY = bottomUp ? rr.y + rr.h : rr.y;
      if (!bottomUp) tl.to(spr, { y: restY + 6, duration: 0.08 * speed, ease: 'power3.out' }, T_LOCK);
      tl.to(spr.scale, { y: baseScale * (bottomUp ? 0.94 : 0.972), duration: 0.08 * speed, ease: 'power3.out' }, T_LOCK);
      if (!bottomUp) tl.to(spr, { y: restY, duration: 0.55 * speed, ease: 'elastic.out(1, 0.4)' }, T_LOCK + 0.08 * speed);
      tl.to(spr.scale, { y: baseScale, duration: 0.55 * speed, ease: 'elastic.out(1, 0.4)' }, T_LOCK + 0.08 * speed);
      // Impact flash — brighter, faster decay: a hit, not a glow.
      tl.to(flash, { alpha: 0.7, duration: 0.05 * speed, ease: 'power2.out' }, T_LOCK);
      tl.to(flash, {
        alpha: 0, duration: 0.26 * speed, ease: 'power2.in',
        onComplete: () => { if (flash.parent) flash.parent.removeChild(flash); },
      }, T_LOCK + 0.05 * speed);
      // The board itself takes the hit (hard landing-thud slam).
      tl.call(() => { this.playLandingThud(this.grid.reelCount - 1); }, undefined, T_LOCK);
      // AAA shine border around the whole reel at lock-in (Crack Farm off).
      if (this.expandStyle.shine) {
        tl.call(() => { this.stickyHandles.push(applyStickyWild(this.stickyContainer, rr)); }, undefined, T_LOCK);
      }
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
    // Tease CAMERA: engaged at the 2nd landed scatter, one step closer per
    // landed teased reel; released after ALL reels stop (bounce out on a
    // miss, stay locked on a hit — PixiApp owns the motion).
    let teaseZoomOn = false;
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
          if (this.reelHasVisibleWild(i, stops[i])) {
            this.audioHooks.onWildLanded?.(i); // cash-bundle drop foley
          }
          if (this.reelHasVisibleScatter(i, stops[i])) {
            this.audioHooks.onScatterLanded?.(i);
            // The 2nd VISIBLE scatter opens the chain: arm the first gate
            // and push the CAMERA in for the tease.
            landedScatterReels++;
            if (landedScatterReels === 2 && !fast) {
              teaseZoomOn = true;
              this.teaseAudioOn = true;
              this.cameraHooks?.zoomStep(0);
              this.audioHooks.onTeaseStart?.(); // riser in, music ducks
            }
            if (nearMiss && landedScatterReels === 2 && nearMiss.teasedReels.length > 0) {
              this.teasePendingReel(nearMiss.teasedReels[0], 0);
            }
          }
          // Sequential tease: this teased reel just LANDED → arm the next
          // gate in the chain (one reel after the other, never all at once)
          // and pull the camera one step CLOSER (the tension arc).
          const tPos = teaseOrder.get(i);
          if (nearMiss && tPos !== undefined) {
            if (teaseZoomOn) this.cameraHooks?.zoomStep(tPos + 1);
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
    // All symbols have dropped in — the spinning is over, so the reel-spin
    // rattle stops right here (not at the later 'settled' state).
    this.audioHooks.onAllReelsStopped?.();

    // Tease camera resolution: bounce RELAXED back out on a miss; on a hit
    // (3+ scatters) the lock is kept — the trigger choreography + iris own
    // the exit (PixiApp.resetTeaseZoom at the iris' black beat).
    if (teaseZoomOn) {
      let sc = 0;
      for (let r = 0; r < this.grid.reelCount; r++) {
        if (this.reelHasVisibleScatter(r, stops[r])) sc++;
      }
      this.cameraHooks?.release(sc >= 3);
      if (this.teaseAudioOn) {
        this.teaseAudioOn = false;
        this.audioHooks.onTeaseEnd?.(sc >= 3); // hit: FS flow; miss: thud + silence
      }
      // MISS: re-arm the resting breathe on the reels that landed BEFORE the
      // tease — their landing timeline gets KILLED while the tease owns the
      // stage, so `transitionAfterLanding` never fires and the cells sit
      // stuck in 'landing' with a dead tween, frozen next to the breathing
      // teased reels (Noski: "die 3 Reels rechts atmen, die linken 2 nicht").
      if (sc < 3) {
        for (const reel of this.reels) {
          for (let row = 0; row < this.grid.visibleRows; row++) {
            const cell = reel.getVisibleCell(row);
            if (!cell) continue;
            const st = cell.currentState;
            const tw = (cell as unknown as { tween?: { isActive?: () => boolean } }).tween;
            const stuckLanding = st === 'landing' && !(tw?.isActive?.());
            if (st === 'static' || stuckLanding) {
              cell.play('static'); // resets the dead landing state cleanly
              cell.play('idle');
            }
          }
        }
      }
    }

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
    this.cameraHooks?.release(false); // any tease zoom bounces back out
    if (this.teaseAudioOn) {
      this.teaseAudioOn = false;
      this.audioHooks.onTeaseEnd?.(false); // kill a mid-flight riser cleanly
    }
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

  /** Fire the light comet along ONE combo's cells — public entry for the
   *  payline line-by-line cycle (PixiApp.startLineCycle). */
  playComboComet(combo: WinCombination): Promise<void> {
    return this.fireWaysLight(combo);
  }

  revealCombo(combo: WinCombination, amountText?: string) {
    // Kill motion tweens FIRST (their interrupt-restore writes lifted-space
    // poses), THEN un-lift the previous combo's objects.
    this.clearWinLines();                 // clear the previous combo's fx
    this.restoreLiftedObjects();          // return the previous combo's objects
    this.applyCellHighlight(combo.cells); // enlarge-pulse this combo
    this.flashWinCells(combo.cells);      // white-hot pop on the winners
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
    // PAYLINE combos carry the FULL line shape (all reels, past the paying
    // run) — the beam draws edge-to-edge like a classic lines slot
    // (research/slot-feel/14 §2). Ways combos fall back to the winning cells.
    const path = (combo as WinCombination & { linePath?: [number, number][] }).linePath;
    const cells = path ?? combo.cells;
    const byReel = new Map<number, Array<{ x: number; y: number }>>();
    for (const [row, reel] of cells) {
      const r = resolveAnchor(cellAnchor(reel, row), this.grid);
      const arr = byReel.get(reel) ?? [];
      arr.push({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
      byReel.set(reel, arr);
    }
    const reels = [...byReel.keys()].sort((a, b) => a - b).map(k => byReel.get(k)!);
    if (path && reels.length >= 2) {
      // Edge-to-edge: enter from the board's left edge, exit past the right.
      const rFirst = resolveAnchor(cellAnchor(0, path[0][0]), this.grid);
      const rLast = resolveAnchor(cellAnchor(this.grid.reelCount - 1, path[path.length - 1][0]), this.grid);
      reels.unshift([{ x: rFirst.x - 8, y: rFirst.y + rFirst.h / 2 }]);
      reels.push([{ x: rLast.x + rLast.w + 8, y: rLast.y + rLast.h / 2 }]);
    }
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

  /** Winner BACKLIGHT burst (lines convention, research 14 §2): a hot radial
   *  glow pops BEHIND each winning symbol and fades — the "white-hot" beat
   *  without touching the symbol's own pixels. (The earlier brightness-filter
   *  version bleached the art: lifting all channels reads as a pale/matte
   *  film — Noski. Additive light underneath keeps the art 100% crisp.)
   *  Skipped while ways-immersive owns the presentation (Vice untouched). */
  private winGlowTex: Texture | null = null;

  private getWinGlowTex(): Texture {
    if (!this.winGlowTex) {
      const S = 128;
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grad.addColorStop(0, 'rgba(255,246,216,0.95)'); // warm white core
      grad.addColorStop(0.45, 'rgba(255,246,216,0.35)');
      grad.addColorStop(1, 'rgba(255,246,216,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, S, S);
      this.winGlowTex = Texture.from(c);
    }
    return this.winGlowTex;
  }

  private flashWinCells(cells: ReadonlyArray<[number, number]>): void {
    if (waysImmersiveConfig.enabled) return;
    for (const [row, reel] of cells) {
      if (this.expandedReels.has(reel)) continue; // tower pulses instead
      const r = resolveAnchor(cellAnchor(reel, row), this.grid);
      const glow = new Sprite(this.getWinGlowTex());
      glow.anchor.set(0.5);
      glow.position.set(r.x + r.w / 2, r.y + r.h / 2);
      const target = Math.max(r.w, r.h) * 1.5; // light spills past the cell
      glow.width = glow.height = target * 0.55;
      glow.alpha = 0;
      glow.blendMode = 'add';
      glow.eventMode = 'none';
      // Lives in winLinesContainer (under the lifted objects, over the board)
      // — clearWinLines sweeps it with the rest of the combo fx.
      this.winLinesContainer.addChild(glow);
      const tl = gsap.timeline({
        onComplete: () => { if (glow.parent) glow.parent.removeChild(glow); glow.destroy(); },
      });
      tl.to(glow, { alpha: 0.9, duration: 0.09, ease: 'power2.out' }, 0)
        .to(glow, { width: target, height: target, duration: 0.42, ease: 'power2.out' }, 0)
        .to(glow, { alpha: 0, duration: 0.33, ease: 'power1.in' }, 0.09);
      this.winFxTweens.push(tl);
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

  /** PLANT MULTIPLIER badge (crack-farm sticky rounds): every standing tower
   *  carries the SHARED multiplier plaque at its BASE (Wild-Storm position,
   *  research 14 §3). DEBUT RULE: no badge while the multi is still 1x — it
   *  first appears (pop) after the first tower-crossing win raised it.
   *  UPGRADE: the new value spawns small+dim above the slot, drifts down in
   *  ~0.12s and pops to full size — the WS slam. Badges ride the sticky
   *  lifecycle (stickyRevealObjects), swept with the towers. */
  private towerBadges = new Map<number, { root: Container; label: Text }>();

  /** Plant count drawn for the CURRENT free-spin round (Crack Farm v2), or
   *  null outside a round. Reset by resetPlantRound() when a round ends. */
  private roundPlantCap: number | null = null;

  /** Clears the round's drawn plant count so the next round draws fresh. */
  resetPlantRound(): void { this.roundPlantCap = null; }

  /** Per-VALUE artwork for the multiplier ring that hangs in the plant
   *  (Crack Farm vine wreath with the number baked in). Values without art
   *  fall back to the drawn plate + text, so partial sets are fine. */
  private multiRingTex = new Map<number, Texture>();

  setMultiRingTextures(map: Map<number, Texture>): void { this.multiRingTex = map; }

  /** Live-adjustable multiplier BADGE (Noski: drop the vine wreath, "mach ein
   *  feld mittig quadratisch" with tweakable frame/background/number colour +
   *  font). Read when a badge is drawn; studio param changes apply to the next
   *  one shown. */
  setMultiBadgeParam(id: string, value: string | number): void {
    const c = multiBadgeConfig;
    switch (id) {
      case 'multiBadgeBg': c.bgColor = hexToNum(String(value)); break;
      case 'multiBadgeBgAlpha': c.bgAlpha = Number(value); break;
      case 'multiBadgeBorder': c.borderColor = hexToNum(String(value)); break;
      case 'multiBadgeBorderWidth': c.borderWidth = Number(value); break;
      case 'multiBadgeNumberColor': c.numberColor = hexToNum(String(value)); break;
      case 'multiBadgeFont': c.fontFamily = `'${String(value)}', ui-sans-serif, system-ui, sans-serif`; break;
      case 'multiBadgeSize': c.sizeFrac = Number(value); break;
      case 'multiBadgeCorner': c.corner = Number(value); break;
      default: return;
    }
  }

  /** Live-adjustable fruit gift ×N label (font / colour / size / anchor
   *  position on the symbol / diagonal angle). Read when the next label is
   *  drawn — all five draw sites share this config. */
  setFruitMultiParam(id: string, value: string | number): void {
    const c = fruitMultiConfig;
    switch (id) {
      case 'fruitMultiFont': c.fontFamily = `'${String(value)}', ui-sans-serif, system-ui, sans-serif`; break;
      case 'fruitMultiColor': c.color = hexToNum(String(value)); break;
      case 'fruitMultiSize': c.size = Number(value); break;
      case 'fruitMultiPos': c.pos = String(value); break;
      case 'fruitMultiAngle': c.angleDeg = Number(value); break;
      default: return;
    }
  }

  /** Shared TextStyle for every gift ×N label — the intro-×500 look:
   *  upright balloon numerals, gold gradient, chocolate outline, soft drop. */
  private fruitMultiStyle(sizeOffset = 0): TextStyle {
    const c = fruitMultiConfig;
    const size = Math.max(10, c.size + sizeOffset);
    return new TextStyle({
      fontFamily: c.fontFamily, fontSize: size, fontWeight: '800',
      fill: fruitMultiGradientFill(c.color),
      stroke: { color: 0x241300, width: Math.max(3, Math.round(size * 0.18)), join: 'round' },
      dropShadow: { color: 0x1a0d00, alpha: 0.4, blur: 1, distance: Math.max(2, size * 0.07), angle: Math.PI / 2 },
      align: 'center',
    });
  }

  /** Param-anchored position + tilt of a gift label inside its cell rect. */
  private fruitMultiPlace(rect: { x: number; y: number; w: number; h: number }): { x: number; y: number; rot: number } {
    const c = fruitMultiConfig;
    const [fx, fy] = FRUIT_MULTI_POS[c.pos] ?? FRUIT_MULTI_POS['unten'];
    return { x: rect.x + rect.w * fx, y: rect.y + rect.h * fy, rot: (c.angleDeg * Math.PI) / 180 };
  }

  // ── BAKED MULTI ART (Noski: "genau die will ich haben auf den geschenken")
  // — one gold PNG per value ×2..×500 (public/theme/fruitstacks/multis/).
  // Loaded lazily per value; the procedural balloon text stays as fallback
  // while a texture is in flight (rare — values are prefetched at decode). ──
  private multiArtBase: string | null = null;
  private multiArtTex = new Map<number, Texture>();
  private multiArtLoading = new Set<number>();

  setMultiArtBase(base: string | null): void { this.multiArtBase = base; }

  /** Fire-and-forget: warm the textures for every value this round shows. */
  prefetchMultiArt(values: number[]): void {
    if (!this.multiArtBase) return;
    for (const v of values) {
      const n = Math.round(v);
      if (n < 2 || n > 500 || this.multiArtTex.has(n) || this.multiArtLoading.has(n)) continue;
      this.multiArtLoading.add(n);
      Assets.load<Texture>(`${this.multiArtBase}x${n}.webp`)
        .then(t => { this.multiArtTex.set(n, t); })
        .catch(() => { /* keep text fallback */ })
        .finally(() => { this.multiArtLoading.delete(n); });
    }
  }

  /** ×N display node: the baked art when loaded, else balloon text. Returned
   *  WRAPPER is scale-1-normalised (grid size), so every flight tween can
   *  keep using absolute scale targets. Size follows the fruitMultiSize param. */
  private makeMultiValue(value: number, sizeOffset = 0): Container {
    const wrap = new Container();
    wrap.eventMode = 'none';
    const tex = this.multiArtTex.get(Math.round(value));
    if (tex) {
      const spr = new Sprite(tex);
      spr.anchor.set(0.5);
      const h = Math.max(10, fruitMultiConfig.size + sizeOffset) * 1.12;
      spr.scale.set(h / tex.height);
      wrap.addChild(spr);
    } else {
      const t = new Text({ text: `×${value}`, style: this.fruitMultiStyle(sizeOffset) });
      t.anchor.set(0.5);
      wrap.addChild(t);
    }
    return wrap;
  }

  /** Live-adjustable 1×1 wild lock backing (frame colour/width + backdrop
   *  colour/opacity). Read when the next wild pops. */
  setOneWildParam(id: string, value: string | number): void {
    const c = oneWildConfig;
    switch (id) {
      case 'oneWildBackdrop': c.backdropColor = hexToNum(String(value)); break;
      case 'oneWildBackdropAlpha': c.backdropAlpha = Number(value); break;
      case 'oneWildFrame': c.frameColor = hexToNum(String(value)); break;
      case 'oneWildFrameWidth': c.frameWidth = Number(value); break;
      default: return;
    }
  }

  /** @param mult  one shared value (Vice Heat), or a per-reel map (Crack Farm
   *   v2, where every plant carries and doubles its OWN multiplier). */
  setTowerMultiplier(mult: number | ReadonlyMap<number, number>): void {
    if (typeof mult !== 'number') {
      for (const [reelIdx, m] of mult) this.setOneTowerMultiplier(reelIdx, m);
      return;
    }
    for (const reelIdx of this.expandedReels) this.setOneTowerMultiplier(reelIdx, mult);
  }

  private setOneTowerMultiplier(reelIdx: number, mult: number): void {
    if (mult <= 1) return; // debut rule: 1x carries no badge
    const text = `x${mult}`;
    {
      let badge = this.towerBadges.get(reelIdx);
      if (badge && !badge.root.parent) { this.towerBadges.delete(reelIdx); badge = undefined; }
      const rr = resolveAnchor(reelAnchor(reelIdx), this.grid);
      const cfg = multiBadgeConfig;
      // Centred square field in the plant's middle (Noski: "feld mittig
      // quadratisch, etwas kleiner"). Side scales with the reel + the param.
      const side = Math.round(rr.w * cfg.sizeFrac);
      const slotY = rr.y + rr.h * 0.5;
      if (!badge) {
        const root = new Container();
        root.eventMode = 'none';
        const plate = new Graphics();
        plate.roundRect(-side / 2, -side / 2, side, side, cfg.corner).fill({ color: cfg.bgColor, alpha: cfg.bgAlpha });
        plate.roundRect(-side / 2, -side / 2, side, side, cfg.corner).stroke({ color: cfg.borderColor, width: cfg.borderWidth, alpha: 0.98 });
        root.addChild(plate);
        const label = new Text({
          text,
          style: new TextStyle({
            fontFamily: cfg.fontFamily,
            fontSize: Math.round(side * 0.4), fontWeight: '900', fontStyle: 'italic', fill: cfg.numberColor,
            stroke: { color: 0x0c1806, width: Math.max(3, Math.round(side * 0.06)) },
          }),
        });
        label.anchor.set(0.5);
        // Long numbers (x1024) shrink to stay inside the square.
        if (label.width > side * 0.86) label.scale.set((side * 0.86) / label.width);
        root.addChild(label);
        root.position.set(rr.x + rr.w / 2, slotY);
        this.stickyContainer.addChild(root);
        this.stickyRevealObjects.push(root);
        this.towerBadges.set(reelIdx, { root, label });
        this.stickyRevealTweens.push(
          gsap.fromTo(root.scale, { x: 0.2, y: 0.2 }, { x: 1, y: 1, duration: 0.38, ease: 'back.out(2.2)' }),
        );
      } else if (badge.label.text !== text) {
        // WS upgrade slam: old value vanishes instantly; the new one spawns
        // small + dim half a cell ABOVE the slot, drifts down, pops <=100ms.
        const { root, label } = badge;
        gsap.killTweensOf(root);
        gsap.killTweensOf(root.scale);
        label.text = text;
        root.alpha = 0.7;
        root.position.set(rr.x + rr.w / 2, slotY - 52);
        root.scale.set(0.55);
        const tl = gsap.timeline();
        tl.to(root, { y: slotY, alpha: 1, duration: 0.12, ease: 'power2.in' }, 0)
          .to(root.scale, { x: 1.3, y: 1.3, duration: 0.06, ease: 'power2.out' }, 0.12)
          .to(root.scale, { x: 1, y: 1, duration: 0.1, ease: 'power2.in' }, 0.18);
        this.stickyRevealTweens.push(tl);
      }
    }
  }

  /** Quick badge pulse — fired on each step of the win plaque's xN tick-up
   *  so the tower visibly "answers" the ramp (WS sync, research 14 §2). */
  pulseTowerBadges(): void {
    for (const { root } of this.towerBadges.values()) {
      if (!root.parent) continue;
      gsap.killTweensOf(root.scale);
      gsap.fromTo(root.scale, { x: 1.22, y: 1.22 }, { x: 1, y: 1, duration: 0.16, ease: 'power2.out' });
    }
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
  /** Tease CAMERA hooks (set by PixiApp): zoomStep(n) pushes the view closer
   *  (0 = the 2nd scatter just landed, then +1 per landed teased reel);
   *  release(hit) either bounces back out (miss) or keeps the lock (hit). */
  cameraHooks: { zoomStep: (step: number) => void; release: (hit: boolean) => void } | null = null;

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
    if (!teaseTuning.scatterLandedFx) return;
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
   *  the winning symbols with node dots. The line DRAWS ON left→right (a
   *  reveal mask grows in width) and then stays solid. It lives in
   *  winLinesContainer (below the lifted symbol objects), so the symbols sit
   *  on top of the line. No frames, no glow wash, no dimming, no sparkles
   *  (Noski 2026-07-22: Sterne über den Win-Sprites raus). */
  private buildDecoration(combos: ReadonlyArray<WinCombination>): void {
    // Ways-immersive: NO decoration at all — no line, no dots, no sparkles,
    // no light sweep. The winners' own motion + the deep dim carry the win.
    if (waysImmersiveConfig.enabled) return;
    const group = new Container();
    this.winLinesContainer.addChild(group);

    // (win-focus bloom removed — the gold radial behind every winning cell
    // fought the transparent symbol art; the line/dots + symbol win anims
    // carry the win on their own)

    // The line/dots are revealed left→right by a growing mask.
    const lineLayer = new Container();
    group.addChild(lineLayer);

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

    // TOWER-MULTIPLIED line (crack-farm sticky FS): the plaque ramps LIVE —
    // "base x1 → x2 → … xN" with the badge pulsing on every step, then the
    // resolved product pops in (Wild-Storm anatomy, research 14 §2). The
    // extras ride the combo as display-only fields set by the FS loop.
    const extras = combo as WinCombination & { multApplied?: number; baseText?: string; finalText?: string };
    if ((extras.multApplied ?? 1) > 1 && extras.baseText && extras.finalText) {
      const N = extras.multApplied!;
      const MAX_STEPS = 8; // big multis ramp in jumps (WS: x6→x14→x16)
      const steps: number[] = [];
      if (N <= MAX_STEPS) { for (let v = 1; v <= N; v++) steps.push(v); }
      else {
        for (let s = 0; s < MAX_STEPS; s++) steps.push(Math.max(1, Math.round(1 + (N - 1) * (s / (MAX_STEPS - 1)))));
      }
      label.text = extras.baseText;
      const tl = gsap.timeline({ onComplete: () => group.destroy({ children: true }) });
      tl.to(group, { alpha: 1, duration: 0.12, ease: 'power2.out' }, 0)
        .to(group.scale, { x: 1, y: 1, duration: 0.28, ease: 'back.out(2.2)' }, 0);
      steps.forEach((v, idx) => {
        tl.call(() => {
          label.text = `${extras.baseText} x${v}`;
          this.pulseTowerBadges();
          gsap.fromTo(group.scale, { x: 1.1, y: 1.1 }, { x: 1, y: 1, duration: 0.08, ease: 'power2.out' });
        }, undefined, 0.18 + idx * 0.09);
      });
      const tEnd = 0.18 + steps.length * 0.09 + 0.06;
      tl.call(() => { label.text = extras.finalText!; }, undefined, tEnd);
      tl.fromTo(group.scale, { x: 1.35, y: 1.35 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2.5)' }, tEnd);
      tl.to(group, { y: cy - 42, duration: 0.9, ease: 'power1.out' }, tEnd + 0.1);
      tl.to(group, { alpha: 0, duration: 0.4, ease: 'power1.in' }, tEnd + 0.6);
      this.winAmountTweens.push(tl);
      return;
    }

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
    // An EXPANDED reel is entirely wild — the plant covers the whole column,
    // so whatever the strip carries behind it does not exist for the game:
    // no scatter trigger, no retrigger, no near-miss tease, no land sound.
    if (this.expandedReels.has(reelIdx)) return false;
    const len = this.config.reelLengths[reelIdx];
    const strip = this.config.reelStrips[reelIdx];
    // FS expanding rounds: a reel whose window carries a WILD is (about to
    // be) fully wild — everything behind the tower is void, so its scatter
    // must not arm the tease. Sticky rounds only expand while the tower cap
    // has room (beyond it the wild plays 1:1 and the scatter DOES count) —
    // mirrors the settlement's evaluation rule exactly.
    if (this.fsExpandMode) {
      let hasWild = false;
      for (let row = 0; row < this.grid.visibleRows; row++) {
        if (strip[(stop + row) % len] === SymbolId.WILD) { hasWild = true; break; }
      }
      if (hasWild) {
        const cap = (this.config as unknown as { stickyTowerCap?: number }).stickyTowerCap ?? 2;
        const expandsNow = this.fsExpandMode === 'perSpin' || this.expandedReels.size < cap;
        if (expandsNow) return false;
      }
    }
    for (let row = 0; row < this.grid.visibleRows; row++) {
      if (strip[(stop + row) % len] === SymbolId.SCATTER) return true;
    }
    return false;
  }

  private reelHasVisibleWild(reelIdx: number, stop: number): boolean {
    if (this.expandedReels.has(reelIdx)) return false; // covered by the plant
    const len = this.config.reelLengths[reelIdx];
    const strip = this.config.reelStrips[reelIdx];
    for (let row = 0; row < this.grid.visibleRows; row++) {
      if (strip[(stop + row) % len] === SymbolId.WILD) return true;
    }
    return false;
  }

  // ── FRUIT STACKS: tumble cascade + crate badges ──────────────────────────
  // The cascade runs ENTIRELY on the live cells between spins: winners pop
  // apart (Noski: "auseinander ploppen"), survivors gravity-fall, fresh
  // symbols drop in from above the mask, then every cell is normalised via
  // setSymbol() to the derived boardAfter. The frozen Reel never notices —
  // it re-derives cells only on the next startSpin().

  /** ×N value badges on the multiplier crates currently on the board.
   *  Cleared on startSpin (winAmountsContainer children are per-spin). */
  private crateBadges: Container[] = [];

  setCrateBadges(crates: { cell: [number, number]; value: number }[]): void {
    this.clearCrateBadges();
    for (const c of crates) {
      const [row, reel] = c.cell;
      // The gift art itself carries the TIER (reference stages: silver ×2-5,
      // red ×6-30, gold ×31-500) — swap the cell to its stage the moment the
      // value is known. Math keeps id 0; this is display-only.
      this.reels[reel]?.getVisibleCell(row)?.setSymbol(fruitGiftTierId(c.value));
      const rect = resolveAnchor(cellAnchor(reel, row), this.grid);
      const label = this.makeMultiValue(c.value);
      // Default 'unten' = reference construct (Winna): the value hangs AT THE
      // GIFT'S BOTTOM EDGE; anchor/tilt are studio params (fruitMulti*).
      const pl = this.fruitMultiPlace(rect);
      label.x = pl.x; label.y = pl.y; label.rotation = pl.rot;
      label.eventMode = 'none';
      this.winAmountsContainer.addChild(label);
      this.crateBadges.push(label);
      gsap.fromTo(label.scale, { x: 0.2, y: 0.2 }, { x: 1, y: 1, duration: 0.28, ease: 'back.out(2.2)' });
    }
  }

  clearCrateBadges(): void {
    for (const b of this.crateBadges) { try { b.parent?.removeChild(b); b.destroy(); } catch { /* torn down */ } }
    this.crateBadges = [];
  }

  // ── FRUIT STACKS: top win plaque + FS pool badge + gift-fly choreography ─
  // Reference construct (research 18, frame-measured 15fps burst): cascade
  // wins tick into a PLATE above the grid; when the chain ends, each gift
  // PULSES, its ×N detaches and FLIES to the plate, the plate reads
  // "«win» ×«sum»" (price + multi connected), holds ~0.8s, then resolves
  // to the product.

  private fruitPlaque: Container | null = null;
  private fruitPlaqueText: Text | null = null;
  private fruitPlaqueTex: Texture | null = null;
  private fruitPool: Container | null = null;
  private fruitPoolValue: Container | null = null;
  private fruitPoolValueY = 0;
  private fruitPoolShown = -1;

  setFruitPlaqueTexture(tex: Texture | null): void {
    this.fruitPlaqueTex = tex;
  }

  /** Cluster games have no reel separators (Noski: symbols frontmost). */
  setSeparatorsVisible(v: boolean): void {
    for (const s of this.separators) s.visible = v;
  }

  private clipMask: Graphics | null = null;
  private clipRect: { w: number; h: number } | null = null;

  /** Widen the reel clip so OVERSIZED symbols (Fruit-Stacks scatter, 1.18×
   *  the cell) never get shaved at the grid edge (Noski: "Rahmen überdeckt
   *  es"). Top stays small — the tumble refill temps drop in hidden above
   *  the grid and would otherwise peek early. */
  private clipMarginCfg: { left: number; top: number; right: number; bottom: number } | null = null;

  setClipMargin(m: { left: number; top: number; right: number; bottom: number }): void {
    this.clipMarginCfg = m;
    this.applyClipRect(m);
    // Vertikal geöffnete Maske legt die BUFFER-Zellen der Reels frei (Noski:
    // "oben und unten schauen reels raus") — bei offener Maske verstecken.
    this.buffersHidden = m.top > 4 || m.bottom > 4;
    this.applyBufferCellVisibility();
  }

  private applyClipRect(m: { left: number; top: number; right: number; bottom: number }): void {
    if (!this.clipMask || !this.clipRect) return;
    this.clipMask.clear();
    this.clipMask.rect(-m.left, -m.top, this.clipRect.w + m.left + m.right, this.clipRect.h + m.top + m.bottom);
    this.clipMask.fill(0xffffff);
  }

  /** Während Drop-Out/Drop-In: vertikal ENG clippen, damit fallende Symbole
   *  HINTER dem Rahmen verschwinden (Noski: "sollen dahinter verschwinden
   *  nach unten") — seitlich bleibt der Scatter-Overflow offen. */
  private tightenClipForDrop(): void {
    if (this.clipMarginCfg) this.applyClipRect({ ...this.clipMarginCfg, top: 2, bottom: 2 });
  }

  private restoreClipMargin(): void {
    if (this.clipMarginCfg) this.applyClipRect(this.clipMarginCfg);
  }

  private buffersHidden = false;

  /** Hide every reel cell that is NOT part of the visible window. Re-applied
   *  after each drop-in in case the window ever remaps. */
  private applyBufferCellVisibility(): void {
    if (!this.buffersHidden) return;
    for (const reel of this.reels) {
      const vis = new Set<AnimatedSymbol>();
      for (let row = 0; row < this.grid.visibleRows; row++) {
        const c = reel.getVisibleCell(row);
        if (c) vis.add(c);
      }
      for (const ch of reel.container.children) {
        if (ch instanceof AnimatedSymbol) ch.visible = vis.has(ch);
      }
    }
  }

  /** Downward SQUASH on a live cell's art (the ONE landing animation for
   *  Fruit Stacks): compresses toward the floor and springs back — never
   *  stretches taller, never leaves the cell. */
  private squashLand(cell: AnimatedSymbol): void {
    // TUMBLE-Nachdroppen landet SANFT (Noski: der starke Aufprall gehört
    // dem ERSTEN Drop, nicht jedem Refill) — nur ein Hauch von Setzen.
    const inner = cell.objectLayer;
    gsap.killTweensOf(inner.scale); gsap.killTweensOf(inner, 'y');
    const baseY = SYMBOL_HEIGHT / 2;
    const sink = SYMBOL_HEIGHT * 0.022;
    gsap.timeline()
      .to(inner.scale, { y: 0.94, x: 1.02, duration: 0.07, ease: 'power1.out' }, 0)
      .to(inner, { y: baseY + sink, duration: 0.07, ease: 'power1.out' }, 0)
      .to(inner.scale, { y: 1, x: 1, duration: 0.16, ease: 'power2.out' }, 0.07)
      .to(inner, { y: baseY, duration: 0.16, ease: 'power2.out' }, 0.07);
  }

  /** BONUS (scatter) renders IN FRONT of every other symbol (Noski): raise
   *  scatter cells inside their reel AND the whole reel column that carries
   *  one (cross-reel overlap — the basket art overhangs its cell). */
  elevateScatterCells(): void {
    this.clipContainer.sortableChildren = true;
    for (const reel of this.reels) {
      let has = false;
      for (let row = 0; row < this.grid.visibleRows; row++) {
        const cell = reel.getVisibleCell(row);
        if (!cell) continue;
        if (cell.symbol === SymbolId.SCATTER) {
          has = true;
          try { cell.parent?.setChildIndex(cell, cell.parent.children.length - 1); } catch { /* buffer cells */ }
        }
      }
      reel.container.zIndex = has ? 5 : 0;
    }
  }

  /** DROP-OUT (cluster construct, replaces the reel spin): the standing board
   *  falls away downward, column by column — the grid then waits empty. */
  async playFruitDropOut(opts: { isLive: () => boolean; turbo?: boolean }): Promise<void> {
    this.tightenClipForDrop(); // Symbole tauchen HINTER dem Rahmen ab
    const speed = opts.turbo ? 0.5 : 1;
    const rows = this.grid.visibleRows;
    const drop = rows * CELL_HEIGHT + CELL_HEIGHT;
    for (let reel = 0; reel < this.grid.reelCount; reel++) {
      for (let row = 0; row < rows; row++) {
        const cell = this.reels[reel]?.getVisibleCell(row);
        if (!cell) continue;
        cell.clearState();
        const inner = cell.objectLayer;
        gsap.killTweensOf(inner); gsap.killTweensOf(inner.scale);
        gsap.to(inner, {
          y: SYMBOL_HEIGHT / 2 + drop, alpha: 0,
          // WINNA-MESSUNG (frame-diff 2026-07-22): der Drop-Out ist EIN
          // Board-Ereignis — alle Spalten kollabieren SIMULTAN (Stagger ~0ms,
          // p75 33ms), Dauer ~400ms im Base-Modus. Der alte 50ms-Spaltenversatz
          // las sich mechanisch.
          duration: 0.4 * speed, ease: 'power2.in',
          delay: 0.015 * speed * (rows - row),
        });
      }
    }
    await new Promise<void>(r => { gsap.delayedCall((0.4 + 0.015 * this.grid.visibleRows + 0.08) * speed, () => r()); });
  }

  /** DROP-IN (cluster construct): fresh symbols rain in from above the mask,
   *  column by column left→right. TEASE (Noski): once 2+ scatters stand in
   *  the already-landed columns, every remaining column drops SLOW, symbol
   *  by symbol. Cells normalise to `board` (+ gift tier art) at the end. */
  async playFruitDropIn(
    board: number[][],
    crates: { cell: [number, number]; value: number }[],
    opts: { isLive: () => boolean; turbo?: boolean },
  ): Promise<void> {
    const speed = opts.turbo ? 0.5 : 1;
    const rows = this.grid.visibleRows;
    const reels = this.grid.reelCount;
    const theme = this.config.theme as { userAssetTextures?: Map<number, Texture> };
    const crateAt = new Map(crates.map(c => [c.cell[0] * reels + c.cell[1], c.value]));
    // park the real cells invisible until their column lands
    for (let reel = 0; reel < reels; reel++) {
      for (let row = 0; row < rows; row++) {
        const cell = this.reels[reel]?.getVisibleCell(row);
        if (!cell) continue;
        const inner = cell.objectLayer;
        gsap.killTweensOf(inner);
        inner.alpha = 0;
      }
    }
    // ALL TOGETHER, reel 1 lands a BREATH before reel 2 (Noski). The REAL
    // cell art falls (setSymbol first, inner offset above the mask, tween
    // down) — no temp sprites, so there is NO hand-off and NO size jump
    // ("Vergrößern beim ersten Drop" was the temps swapping to the real
    // art at a different size). Landing = downward squash, bottom planted.
    // WINNA-MESSUNG (frame-diff 2026-07-22): Refill-Fall 442ms (unsere 260ms
    // lasen sich als Teleport — Fallzeit = Gewicht). Ankunft NICHT uniform:
    // Spalten 1-3 fast zusammen, nach rechts aufweitend (Gesamt-Spread
    // 200-400ms) — der gleichmäßige 70ms-Versatz wirkte roboterhaft.
    const dur = 0.44 * speed;
    const COL_DELAYS = [0, 0.01, 0.03, 0.1, 0.19, 0.3];
    const rowStagger = 0.035 * speed;
    for (let reel = 0; reel < reels; reel++) {
      for (let row = 0; row < rows; row++) {
        const cell = this.reels[reel]?.getVisibleCell(row);
        if (!cell) continue;
        const sym = board[row][reel];
        const crateVal = crateAt.get(row * reels + reel);
        cell.clearState();
        cell.setSymbol((crateVal !== undefined ? fruitGiftTierId(crateVal) : sym) as SymbolIdType);
        const inner = cell.objectLayer;
        gsap.killTweensOf(inner); gsap.killTweensOf(inner.scale);
        inner.scale.set(1);
        inner.alpha = 1;
        const baseY = SYMBOL_HEIGHT / 2;
        inner.y = baseY - (row + 1.4) * CELL_HEIGHT; // above the grid mask
        const sink = SYMBOL_HEIGHT * 0.069; // first drop: 25% more intensity (Noski)
        gsap.timeline({ delay: (COL_DELAYS[reel] ?? 0.3) * speed + rowStagger * (rows - 1 - row) })
          .to(inner, { y: baseY, duration: dur, ease: 'power2.in' }, 0)
          .to(inner.scale, { y: 0.8, x: 1.075, duration: 0.08 * speed, ease: 'power1.out' }, dur)
          .to(inner, { y: baseY + sink, duration: 0.08 * speed, ease: 'power1.out' }, dur)
          .to(inner.scale, { y: 1, x: 1, duration: 0.2 * speed, ease: 'back.out(2.2)' }, dur + 0.08 * speed)
          .to(inner, { y: baseY, duration: 0.2 * speed, ease: 'back.out(2.2)' }, dur + 0.08 * speed);
      }
    }
    await new Promise<void>(r => { gsap.delayedCall(dur + 0.3 * speed + rowStagger * rows + 0.05 * speed, () => r()); });
    this.audioHooks.onReelStopped?.(0); // one soft land beat for the board
    this.restoreClipMargin(); // Scatter-Overflow wieder frei (Board ruht)
    this.elevateScatterCells(); // BONUS in front of everything (Noski)
    this.applyBufferCellVisibility(); // buffers stay hidden with the open clip
  }

  showFruitPlaque(initial = ''): void {
    if (!this.fruitPlaque) {
      const c = new Container();
      c.eventMode = 'none';
      if (this.fruitPlaqueTex) {
        const s = new Sprite(this.fruitPlaqueTex);
        s.anchor.set(0.5);
        s.scale.set(268 / this.fruitPlaqueTex.width);
        c.addChild(s);
      }
      const t = new Text({
        text: '',
        style: new TextStyle({
          fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
          fontSize: 33, fontWeight: '800', fontStyle: 'italic', letterSpacing: 0.5,
          fill: 0xffe698, stroke: { color: 0x2a1403, width: 5, join: 'round' }, align: 'center',
        }),
      });
      t.anchor.set(0.5);
      c.addChild(t);
      c.x = this.totalWidth / 2;
      c.y = -58; // rides above the grid, overlapping the frame top (reference)
      this.container.addChild(c);
      this.fruitPlaque = c;
      this.fruitPlaqueText = t;
    }
    this.fruitPlaque.visible = true;
    this.fruitPlaque.alpha = 1;
    this.setFruitPlaqueText(initial);
  }

  setFruitPlaqueText(text: string, pop = false): void {
    if (!this.fruitPlaqueText || !this.fruitPlaque) return;
    this.fruitPlaqueText.text = text;
    // keep the amount inside the plate art
    const maxW = 205;
    this.fruitPlaqueText.scale.set(Math.min(1, maxW / Math.max(1, this.fruitPlaqueText.width / this.fruitPlaqueText.scale.x)));
    if (pop) {
      gsap.killTweensOf(this.fruitPlaque.scale);
      gsap.fromTo(this.fruitPlaque.scale, { x: 1.18, y: 1.18 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2.2)' });
    }
  }

  hideFruitPlaque(): void {
    if (this.fruitPlaque) this.fruitPlaque.visible = false;
  }

  /** IMPACT: a gift's ×N SLAMS into the plate — punch-scale + a short shake.
   *  NO rectangle flash: the old white roundRect washed over the plate as a
   *  visible semi-opaque BOX around the number (Noski: "komischer Kasten"). */
  punchFruitPlaque(): void {
    if (!this.fruitPlaque) return;
    const c = this.fruitPlaque;
    gsap.killTweensOf(c.scale); gsap.killTweensOf(c);
    gsap.timeline()
      .fromTo(c.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.42, ease: 'elastic.out(1, 0.55)' })
      .fromTo(c, { rotation: -0.05 }, { rotation: 0, duration: 0.36, ease: 'elastic.out(1, 0.4)' }, 0)
      .fromTo(c, { y: -52 }, { y: -58, duration: 0.3, ease: 'power2.out' }, 0);
  }

  /** APPLY-MERGE (Noski): die Plaque zeigt "win ×multi" — beim Multiplizieren
   *  SCHIEBEN sich die beiden zusammen (Squeeze), dann steht instant das
   *  Produkt mit Pop + Stern-Burst. */
  async mergeFruitPlaqueTo(text: string): Promise<void> {
    if (!this.fruitPlaque || !this.fruitPlaqueText) return;
    const t = this.fruitPlaqueText;
    await new Promise<void>(res => {
      gsap.to(t.scale, { x: 0.6, duration: 0.18, ease: 'power2.in', onComplete: () => res() });
    });
    this.setFruitPlaqueText(text);
    this.starDustAt(this.fruitPlaque.x, this.fruitPlaque.y, 10, 30);
    this.punchFruitPlaque();
  }

  private fruitPoolTex: Texture | null = null;
  setFruitPoolTexture(tex: Texture | null): void { this.fruitPoolTex = tex; }

  /** WINNA arrival juice: a small gold STAR-DUST burst (no white flash — the
   *  perceived flash in the reference is just particles + the bigger text). */
  private starDustAt(x: number, y: number, n = 8, radius = 30): void {
    for (let d = 0; d < n; d++) {
      const a = (d / n) * Math.PI * 2 + Math.random() * 0.5;
      const dot = new Graphics();
      dot.circle(0, 0, 2.5 + Math.random() * 3);
      dot.fill({ color: [0xffe27a, 0xfff6c0, 0xffb347][d % 3], alpha: 0.95 });
      dot.x = x; dot.y = y; dot.eventMode = 'none';
      this.container.addChild(dot);
      const dist = radius + Math.random() * radius;
      gsap.timeline({ onComplete: () => { try { dot.parent?.removeChild(dot); dot.destroy(); } catch { /* gone */ } } })
        .to(dot, { x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist + 10, duration: 0.4, ease: 'power2.out' })
        .to(dot, { alpha: 0, duration: 0.25, ease: 'power1.in' }, '>-0.18')
        .to(dot.scale, { x: 0.4, y: 0.4, duration: 0.38 }, 0);
    }
  }

  /** FS pool badge (right of the grid, reference construct: the gift with
   *  its ×pool INSIDE the pill under the box). null hides. */
  setFruitPool(value: number | null, pop = false): void {
    if (value === null) {
      if (this.fruitPool) this.fruitPool.visible = false;
      return;
    }
    if (!this.fruitPool) {
      const c = new Container();
      c.eventMode = 'none';
      let textY = 52;
      if (this.fruitPoolTex) {
        const g = new Sprite(this.fruitPoolTex);
        g.anchor.set(0.5);
        // WINNA-vermessen: Badge-Gesamt 193x185 bei Grid 675x560 -> ~1/3 der
        // Grid-Hoehe; unsere Art 380x409 -> Breite 176 trifft das Verhaeltnis.
        const w = 176;
        g.scale.set(w / this.fruitPoolTex.width);
        c.addChild(g);
        // ×N sits INSIDE the art's pill (pool_gift.png measured: blue pill
        // interior y 318..395 of 409 → centre 0.872 height)
        textY = (0.872 - 0.5) * this.fruitPoolTex.height * g.scale.y;
      } else {
        const giftTex = (this.config.theme as { userAssetTextures?: Map<number, Texture> }).userAssetTextures?.get(0);
        if (giftTex) {
          const g = new Sprite(giftTex);
          g.anchor.set(0.5);
          g.scale.set(74 / giftTex.width);
          c.addChild(g);
        }
      }
      this.fruitPoolValueY = textY; // Pillen-Zentrum — der Wert-Node haengt hier
      // Rail-Achse: Counter + Pool-Badge ZENTRIERT untereinander, etwas
      // weiter rechts (Noski 2026-07-24).
      c.x = this.totalWidth + 168;
      c.y = this.totalHeight * 0.55;
      this.container.addChild(c);
      this.fruitPool = c;
    }
    this.fruitPool.visible = true;
    // Harter Zahl-Swap (WINNA): der Wert-Node wird bei Wertwechsel neu gebaut
    // — jetzt mit Noskis gebakter Gold-Art (x2..x500), Text nur als Fallback.
    if (this.fruitPoolShown !== value || !this.fruitPoolValue) {
      if (this.fruitPoolValue) { try { this.fruitPoolValue.destroy({ children: true }); } catch { /* gone */ } }
      const node = this.makeMultiValue(value, -6);
      node.y = this.fruitPoolValueY;
      this.fruitPool.addChild(node);
      this.fruitPoolValue = node;
      this.fruitPoolShown = value;
    }
    if (pop && this.fruitPoolValue) {
      // WINNA-vermessen: NUR DER WERT skaliert von ~1.4x in ~350ms weich
      // zurueck — Pill-Ring und Box bleiben statisch, KEIN Weiss-Flash.
      gsap.killTweensOf(this.fruitPoolValue.scale);
      gsap.fromTo(this.fruitPoolValue.scale, { x: 1.4, y: 1.4 }, { x: 1, y: 1, duration: 0.35, ease: 'power2.out' });
    }
  }

  // ── FS-COUNTER (Noski-Art 2026-07-24): Holz-Plakette "FREE SPINS" mit
  // Zahl-Fenster rechts; die verbleibenden Spins ROLLEN wie ein Rad runter
  // (Spin-Start) bzw. hoch (Retrigger). Sitzt OBEN an der rechten Rail —
  // Pool-Badge steht auf 0.55 der Grid-Höhe, hier 0.14 → keine Kollision. ──
  private fsCounter: Container | null = null;
  private fsCounterWin: Container | null = null;
  private fsCounterNum: Container | null = null;
  private fsCounterShown = -1;
  private fsCounterTex = new Map<string, Texture>();

  setFsCounterBase(base: string | null): void {
    if (!base) return;
    const want = ['frame', ...Array.from({ length: 16 }, (_, i) => `n${i}`)];
    for (const k of want) {
      if (this.fsCounterTex.has(k)) continue;
      Assets.load<Texture>(`${base}${k}.webp`)
        .then(t => { this.fsCounterTex.set(k, t); })
        .catch(() => { /* Text-Fallback */ });
    }
  }

  /** Zahl-Node im Zaehler-Fenster: gebakte Gold-Zahl 0..15, sonst Ballon-Text
   *  (Retrigger kann über 15 treiben). Scale-Relation frame↔Zahl vermessen:
   *  Komposit-„10" = 0.863 der Quell-px, Bake-Faktor 0.45 → ×1.919. */
  private makeFsCounterNumber(value: number, frameScale: number): Container {
    const wrap = new Container();
    wrap.eventMode = 'none';
    const tex = value >= 0 && value <= 15 ? this.fsCounterTex.get(`n${value}`) : undefined;
    if (tex) {
      const spr = new Sprite(tex);
      spr.anchor.set(0.5);
      // Kette der Bake-Faktoren (Komposit-„10" 0.8634 der Quell-px, Frame
      // 480/1569 gebaked, Zahlen 0.45 gebaked) → 0.8634/0.45×480/1569 = 0.587
      spr.scale.set(frameScale * 0.587);
      wrap.addChild(spr);
    } else {
      const t = new Text({ text: String(value), style: this.fruitMultiStyle(4) });
      t.anchor.set(0.5);
      wrap.addChild(t);
    }
    return wrap;
  }

  /** Verbleibende Free Spins anzeigen. roll 'down' = Spin-Start (Rad dreht
   *  runter), 'up' = Retrigger (+Spins), 'none' = hart setzen. null = weg. */
  setFsCounter(value: number | null, roll: 'down' | 'up' | 'none' = 'none'): void {
    if (value === null) {
      if (this.fsCounter) this.fsCounter.visible = false;
      this.fsCounterShown = -1;
      return;
    }
    const FRAME_W = 240; // "kann ruhig etwas größer" (Noski)
    const frameTex = this.fsCounterTex.get('frame');
    const frameScale = frameTex ? FRAME_W / frameTex.width : FRAME_W / 480;
    const frameH = (frameTex ? frameTex.height : 198) * frameScale;
    if (!this.fsCounter) {
      const c = new Container();
      c.eventMode = 'none';
      if (frameTex) {
        const f = new Sprite(frameTex);
        f.anchor.set(0.5);
        f.scale.set(frameScale);
        c.addChild(f);
      }
      // Masken-Fenster = das DUNKLE Zahl-Feld der Plakette (Komposit-Messung:
      // Feld ~0.62 der Höhe) — NICHT höher, sonst rollt die Zahl sichtbar
      // übers Holz statt im Feld zu verschwinden (Noski).
      const win = new Container();
      win.x = FRAME_W * (0.752 - 0.5);
      const m = new Graphics();
      m.rect(-FRAME_W * 0.17, -frameH * 0.31, FRAME_W * 0.34, frameH * 0.62);
      m.fill({ color: 0xffffff });
      win.addChild(m);
      win.mask = m;
      c.addChild(win);
      c.x = this.totalWidth + 168; // gleiche Achse wie das Pool-Badge
      c.y = this.totalHeight * 0.14;
      this.container.addChild(c);
      this.fsCounter = c;
      this.fsCounterWin = win;
    }
    this.fsCounter.visible = true;
    const prevShown = this.fsCounterShown;
    const old = this.fsCounterNum;
    if (roll === 'none' || !old || prevShown === value) {
      if (old) { try { old.destroy({ children: true }); } catch { /* gone */ } }
      const node = this.makeFsCounterNumber(value, frameScale);
      this.fsCounterWin!.addChild(node);
      this.fsCounterNum = node;
      this.fsCounterShown = value;
      return;
    }
    // RAD-ROLL: down = alte Zahl fällt unten raus, neue kommt von oben rein
    const next = this.makeFsCounterNumber(value, frameScale);
    const dist = frameH * 0.72;
    const dir = roll === 'down' ? 1 : -1;
    next.y = -dir * dist;
    this.fsCounterWin!.addChild(next);
    this.fsCounterNum = next;
    this.fsCounterShown = value;
    gsap.to(next, { y: 0, duration: 0.38, ease: 'back.out(1.15)' });
    gsap.to(old, {
      y: dir * dist, duration: 0.38, ease: 'power2.in',
      onComplete: () => { try { old.destroy({ children: true }); } catch { /* gone */ } },
    });
  }

  /** THE reference multi beat: every gift pulses, its ×value detaches and
   *  flies to the plate; `onArrive(runningSum)` fires per arrival so the
   *  caller appends "×sum" to the plate text. */
  /** FS flow (Noski): gift values fly RIGHT into the POOL FIELD. */
  async flyGiftMultisToPool(
    gifts: { cell: [number, number]; value: number }[],
    onArrive: (runningSum: number) => void,
    opts: { isLive: () => boolean; turbo?: boolean },
  ): Promise<void> {
    if (!this.fruitPool || gifts.length === 0) return;
    const speed = opts.turbo ? 0.55 : 1;
    const target = { x: this.fruitPool.x, y: this.fruitPool.y };
    let sum = 0;
    const flights: Promise<void>[] = [];
    for (let i = 0; i < gifts.length; i++) {
      const g = gifts[i];
      const [row, reel] = g.cell;
      const rect = resolveAnchor(cellAnchor(reel, row), this.grid);
      const cell = this.reels[reel]?.getVisibleCell(row);
      if (cell) {
        const inner = cell.objectLayer;
        gsap.killTweensOf(inner.scale);
        gsap.timeline({ delay: 0.22 * speed * i })
          .to(inner.scale, { x: 1.16, y: 1.16, duration: 0.14 * speed, ease: 'power2.out' })
          .to(inner.scale, { x: 1, y: 1, duration: 0.2 * speed, ease: 'back.out(2)' });
      }
      const label = this.makeMultiValue(g.value);
      const pl = this.fruitMultiPlace(rect);
      label.x = pl.x; label.y = pl.y; label.rotation = pl.rot;
      label.eventMode = 'none';
      this.winAmountsContainer.addChild(label);
      flights.push(new Promise<void>(resolve => {
        gsap.timeline({
          delay: 0.22 * speed * i,
          onStart: () => { this.audioHooks.onGiftFly?.(); },
          onComplete: () => {
            try { label.parent?.removeChild(label); label.destroy(); } catch { /* gone */ }
            sum += g.value;
            this.audioHooks.onPlateImpact?.();
            // WINNA: Stern-Burst auf der Pill kaschiert den harten Summen-Swap
            if (this.fruitPool) this.starDustAt(this.fruitPool.x, this.fruitPool.y + 18, 9, 26);
            onArrive(sum);
            resolve();
          },
        })
          // WINNA FS (frame-vermessen): DIREKT diagonal zum Pool-Badge (~300ms,
          // KEIN Hochsteigen), waechst unterwegs riesig (~2.2x), schrumpft in
          // die Pill.
          .to(label.scale, { x: 2.2, y: 2.2, duration: 0.16 * speed, ease: 'power1.out' })
          .to(label, { x: target.x, y: target.y, duration: 0.3 * speed, ease: 'power1.in' }, '<0.02')
          .to(label.scale, { x: 0.45, y: 0.45, duration: 0.14 * speed, ease: 'power2.in' }, '>-0.14');
      }));
    }
    await Promise.all(flights);
  }

  /** ROUND-END flourish: the total pool flies from its field ONTO the win
   *  plate — then the win resolves and the marquee takes over. */
  async flyPoolToPlaque(poolValue: number, opts: { isLive: () => boolean; turbo?: boolean }): Promise<void> {
    if (!this.fruitPool || !this.fruitPlaque || poolValue <= 0) return;
    const speed = opts.turbo ? 0.55 : 1;
    // pool → plaque flight: not on a symbol — baked art (or text fallback)
    const label = this.makeMultiValue(poolValue, 6);
    label.x = this.fruitPool.x;
    label.y = this.fruitPool.y;
    label.eventMode = 'none';
    this.container.addChild(label);
    const tx = this.fruitPlaque.x, ty = this.fruitPlaque.y;
    await new Promise<void>(resolve => {
      gsap.timeline({
        onStart: () => { this.audioHooks.onGiftFly?.(); },
        onComplete: () => {
          try { label.parent?.removeChild(label); label.destroy(); } catch { /* gone */ }
          this.audioHooks.onPlateImpact?.();
          this.starDustAt(tx, ty, 10, 30);
          this.punchFruitPlaque();
          resolve();
        },
      })
        // Pool-Apply (Noski: langsamer, mit Präsenz): CHARGE ~260ms über der
        // Pill, dann sichtbare Reise zur Plaque in ~420ms.
        .to(label.scale, { x: 1.4, y: 1.4, duration: 0.26 * speed, ease: 'power1.out' })
        .to(label, { y: label.y - 30, duration: 0.26 * speed, ease: 'power1.out' }, '<')
        .to(label, { x: tx, y: ty, duration: 0.42 * speed, ease: 'power1.inOut' }, '>')
        .to(label.scale, { x: 0.55, y: 0.55, duration: 0.42 * speed, ease: 'power2.in' }, '<');
    });
  }

  /** SCATTER breathing choreo (Noski): 3/4/5 standing scatters breathe IN
   *  SYNC — stronger per bonus tier. Killed by the next drop-out. */
  breatheScatters(count: number): void {
    const level = count >= 5 ? 1.13 : count >= 4 ? 1.09 : count >= 3 ? 1.055 : 0;
    if (!level) return;
    for (const reel of this.reels) {
      for (let row = 0; row < this.grid.visibleRows; row++) {
        const cell = reel.getVisibleCell(row);
        if (!cell || cell.symbol !== SymbolId.SCATTER) continue;
        const inner = cell.objectLayer;
        gsap.killTweensOf(inner.scale);
        gsap.to(inner.scale, { x: level, y: level, duration: 0.7, ease: 'sine.inOut', repeat: -1, yoyo: true });
      }
    }
  }

  async flyGiftMultisToPlaque(
    gifts: { cell: [number, number]; value: number }[],
    onArrive: (runningSum: number) => void,
    opts: { isLive: () => boolean; turbo?: boolean },
  ): Promise<void> {
    if (!this.fruitPlaque || gifts.length === 0) return;
    const speed = opts.turbo ? 0.55 : 1;
    const target = { x: this.fruitPlaque.x, y: this.fruitPlaque.y };
    let sum = 0;
    const flights: Promise<void>[] = [];
    for (let i = 0; i < gifts.length; i++) {
      const g = gifts[i];
      const [row, reel] = g.cell;
      const rect = resolveAnchor(cellAnchor(reel, row), this.grid);
      // gift pulse (the cell art itself)
      const cell = this.reels[reel]?.getVisibleCell(row);
      if (cell) {
        const inner = cell.objectLayer;
        gsap.killTweensOf(inner.scale);
        gsap.timeline({ delay: 0.16 * speed * i })
          .to(inner.scale, { x: 1.18, y: 1.18, duration: 0.14 * speed, ease: 'power2.out' })
          .to(inner.scale, { x: 1, y: 1, duration: 0.22 * speed, ease: 'back.out(2)' });
      }
      const label = this.makeMultiValue(g.value, 2);
      const pl = this.fruitMultiPlace(rect);
      label.x = pl.x; label.y = pl.y; label.rotation = pl.rot;
      label.eventMode = 'none';
      this.winAmountsContainer.addChild(label);
      flights.push(new Promise<void>(resolve => {
        gsap.timeline({
          delay: 0.28 * speed * i,
          onStart: () => { this.audioHooks.onGiftFly?.(); },
          onComplete: () => {
            try { label.parent?.removeChild(label); label.destroy(); } catch { /* gone */ }
            sum += g.value;
            this.audioHooks.onPlateImpact?.();
            // WINNA: Gold-Stern-Splash am Dockpunkt (kein Weiss-Flash)
            this.starDustAt(target.x, target.y, 8, 24);
            onArrive(sum);
            resolve();
          },
        })
          // GERADER STRICH (Noski: "die fliegen komisch hoch"): EIN direkter
          // Flug von der Gift-Position zur Plaque, keine Steig-Kurve mehr.
          // Groesse: Peak ~1.5x in der Flugmitte, klein andocken.
          .fromTo(label.scale, { x: 0.7, y: 0.7 }, { x: 1.5, y: 1.5, duration: 0.22 * speed, ease: 'power1.out' })
          .to(label, { x: target.x, y: target.y, duration: 0.45 * speed, ease: 'power1.in' }, '<')
          .to(label.scale, { x: 0.55, y: 0.55, duration: 0.23 * speed, ease: 'power2.in' }, '>-0.23');
      }));
    }
    await Promise.all(flights);
    if (!opts.isLive()) return;
  }

  /** One tumble step: pop the winning cells, drop the survivors, refill from
   *  the top, then normalise every cell to `boardAfter`. */
  async playTumbleStep(
    step: {
      wins: { symbolId: number; cells: [number, number][]; amount: bigint }[];
      removed: [number, number][];
      refills: number[][];
      boardAfter: number[][];
      cratesAfter?: { cell: [number, number]; value: number }[];
    },
    amountTexts: string[],
    opts: { isLive: () => boolean; turbo?: boolean; teaseSlow?: boolean },
  ): Promise<void> {
    const speed = opts.turbo ? 0.5 : 1;
    const rows = this.grid.visibleRows;
    const reels = this.grid.reelCount;

    // 1. AUFPLATZEN (Noski v2, ersetzt den Ninja-Cut): winners CHARGE with a
    //    slow swell, then BURST — juice droplets spray, the art pops away.
    //    Each win floats its +amount, gliding away from the cluster.
    const themeTex = (this.config.theme as { userAssetTextures?: Map<number, Texture> }).userAssetTextures;
    for (let w = 0; w < step.wins.length; w++) {
      const win = step.wins[w];
      let cx = 0, cy = 0;
      for (const [row, reel] of win.cells) {
        const cell = this.reels[reel]?.getVisibleCell(row);
        const rect = resolveAnchor(cellAnchor(reel, row), this.grid);
        const ccx = rect.x + rect.w / 2, ccy = rect.y + rect.h / 2;
        cx += ccx; cy += ccy;
        if (!cell) continue;
        cell.clearState();
        const inner = cell.objectLayer;
        gsap.killTweensOf(inner); gsap.killTweensOf(inner.scale);
        const tex = themeTex?.get(win.symbolId);
        const theta = Math.random() * Math.PI; // burst orientation
        if (tex) {
          // AUFPLATZEN (Noski): a slow CHARGE swell, then the fruit POPS —
          // juice droplets spray out, the art bursts away. No hard cuts.
          const inner2 = inner;
          gsap.timeline()
            // WINNA: Collapse gesamt ~333ms (Pop -> leer) — der alte 220ms-
            // Charge-Swell streckte den Rhythmus zäh. Kurzer 100ms-Swell.
            .to(inner2.scale, { x: 1.16, y: 1.16, duration: 0.1 * speed, ease: 'power1.inOut' })
            .to(inner2.scale, { x: 1.34, y: 1.34, duration: 0.09 * speed, ease: 'power2.in' }, '>')
            .to(inner2.scale, { x: 0.4, y: 0.4, duration: 0.16 * speed, ease: 'power2.out' }, '>')
            .to(inner2, { alpha: 0, duration: 0.16 * speed, ease: 'power1.out' }, '<');
          // juice droplets: warm splash ring flying out with a soft gravity arc
          const N_DROPS = 7;
          for (let d = 0; d < N_DROPS; d++) {
            const a = theta + (d / N_DROPS) * Math.PI * 2;
            const dot = new Graphics();
            const rr = 3 + Math.random() * 3.5;
            dot.circle(0, 0, rr);
            dot.fill({ color: [0xffd75e, 0xfff2b0, 0xff9d4d][d % 3], alpha: 0.95 });
            dot.x = ccx; dot.y = ccy;
            dot.eventMode = 'none';
            this.clipContainer.addChild(dot);
            const dist = 34 + Math.random() * 26;
            gsap.timeline({ delay: 0.28 * speed, onComplete: () => { try { dot.parent?.removeChild(dot); dot.destroy(); } catch { /* gone */ } } })
              .to(dot, { x: ccx + Math.cos(a) * dist, y: ccy + Math.sin(a) * dist + 16, duration: 0.5 * speed, ease: 'power2.out' })
              .to(dot, { alpha: 0, duration: 0.28 * speed, ease: 'power1.in' }, '>-0.2')
              .to(dot.scale, { x: 0.4, y: 0.4, duration: 0.4 * speed }, 0);
          }
        } else {
          // no texture (placeholder build) — the plain pop
          gsap.timeline()
            .to(inner.scale, { x: 1.24, y: 1.24, duration: 0.12 * speed, ease: 'back.out(1.8)' })
            .to(inner.scale, { x: 0, y: 0, duration: 0.16 * speed, ease: 'power2.in' }, '>')
            .to(inner, { alpha: 0, duration: 0.14 * speed, ease: 'power2.in' }, '<');
        }
      }
      cx /= win.cells.length; cy /= win.cells.length;
      const label = new Text({
        text: amountTexts[w] ?? '',
        style: new TextStyle({
          fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
          fontSize: 38, fontWeight: '800', fontStyle: 'italic', letterSpacing: 1,
          fill: 0xfff6d8, stroke: { color: 0x1c1206, width: 6, join: 'round' },
          dropShadow: { color: 0x000000, blur: 8, distance: 0, alpha: 0.45, angle: 0 },
          align: 'center',
        }),
      });
      label.anchor.set(0.5); label.x = cx; label.y = cy; label.eventMode = 'none';
      this.winAmountsContainer.addChild(label);
      // WINNA (frame-vermessen): der Betrag erscheint quasi INSTANT in voller
      // Groesse (~100ms nach Pop-Start), steht FIX am Cluster-Schwerpunkt
      // (kein Gleiten — er ueberlebt Collapse+Refill drunter) und fadet dann
      // in ~270ms an Ort und Stelle aus.
      gsap.timeline({ delay: 0.1 * speed, onComplete: () => { try { label.parent?.removeChild(label); label.destroy(); } catch { /* gone */ } } })
        .fromTo(label, { alpha: 0 }, { alpha: 1, duration: 0.1 * speed, ease: 'power1.out' }, 0)
        .to(label, { alpha: 0, duration: 0.27 * speed, ease: 'power1.in' }, 0.1 + 1.13 * speed);
    }
    await new Promise<void>(r => { gsap.delayedCall(0.5 * speed, () => r()); });
    if (!opts.isLive()) return;

    // 2. GRAVITY-FALL + REFILL (no bounce — clean drop, subtle knick after).
    const removedByReel = new Map<number, number[]>();
    for (const [row, reel] of step.removed) {
      let arr = removedByReel.get(reel);
      if (!arr) removedByReel.set(reel, arr = []);
      arr.push(row);
    }
    // WINNA: Tumble-Refill 500ms (unsere 300ms zu hastig).
    const fallDur = 0.44 * speed;
    const temps: Sprite[] = [];
    const theme = this.config.theme as { userAssetTextures?: Map<number, Texture> };
    // gift tier art by CURRENT position (cratesAfter rode the gravity)
    const crateAt = new Map((step.cratesAfter ?? []).map(cc => [cc.cell[0] * reels + cc.cell[1], cc.value]));
    // SCATTER-TEASE (Noski): with 2+ scatters STANDING, the refills crawl in
    // column by column — the slow "Walzen" moment lives HERE, in the
    // NACHDROPPEN, never in the normal spin drop.
    const teaseCols = opts.teaseSlow ? [...removedByReel.keys()].sort((a, b) => a - b) : [];
    const teaseDelay = (reel: number) => opts.teaseSlow ? teaseCols.indexOf(reel) * 0.5 * speed : 0;
    const teaseMul = opts.teaseSlow ? 2.1 : 1;
    for (let reel = 0; reel < reels; reel++) {
      const removedRows = removedByReel.get(reel) ?? [];
      if (removedRows.length === 0) continue;
      // survivors above a removed cell slide down by the count below them
      for (let row = rows - 1; row >= 0; row--) {
        if (removedRows.includes(row)) continue;
        const below = removedRows.filter(rr => rr > row).length;
        if (below === 0) continue;
        const cell = this.reels[reel]?.getVisibleCell(row);
        if (!cell) continue;
        const inner = cell.objectLayer;
        gsap.killTweensOf(inner);
        gsap.to(inner, { y: SYMBOL_HEIGHT / 2 + below * CELL_HEIGHT, duration: fallDur * teaseMul, ease: 'power2.in', delay: teaseDelay(reel) });
      }
      // fresh symbols fall in from above the mask (temp sprites; the real
      // cells take over at normalise)
      const fresh = step.refills[reel] ?? [];
      for (let i = 0; i < fresh.length; i++) {
        // a gift refill falls WITH its tier art (id 0 raw = the gold base
        // gift Noski never wants to see) + EXACT real-cell sizing.
        const freshCrate = crateAt.get(i * reels + reel);
        const dispId = fresh[i] === 0 && freshCrate !== undefined ? fruitGiftTierId(freshCrate) : (fresh[i] === 0 ? fruitGiftTierId(2) : fresh[i]);
        const tex = theme.userAssetTextures?.get(dispId);
        if (!tex) continue;
        const rect = resolveAnchor(cellAnchor(reel, i), this.grid);
        const spr = new Sprite(tex);
        spr.anchor.set(0.5);
        const mul = SYMBOL_SIZE_MULS.get(dispId) ?? (dispId === SymbolId.SCATTER ? 1.2 : 1);
        const target = Math.round(Math.min(SYMBOL_WIDTH, SYMBOL_HEIGHT) * 0.88 * symbolSizing.objectScale * mul);
        spr.width = target;
        // A refill GIFT lands WITH its ×N attached (Winna: the value never
        // leaves the crate — Noski saw naked crates until the step ended).
        // The badge is a CHILD of the scaled sprite, so it lives in TEXTURE
        // space: position/size are expressed in texture px and counter-scaled
        // by 1/s so it renders exactly like the settled grid badges (the old
        // target-px values shrank with the sprite → mini badge).
        if (freshCrate !== undefined) {
          const badge = this.makeMultiValue(freshCrate);
          const s = target / tex.height;
          badge.scale.set(1 / s);
          const [fx, fy] = FRUIT_MULTI_POS[fruitMultiConfig.pos] ?? FRUIT_MULTI_POS['unten'];
          badge.x = (fx - 0.5) * tex.width;
          badge.y = (fy - 0.5) * tex.height;
          badge.rotation = (fruitMultiConfig.angleDeg * Math.PI) / 180;
          badge.eventMode = 'none';
          spr.addChild(badge);
        }
        spr.height = target;
        spr.x = rect.x + rect.w / 2;
        spr.y = rect.y + rect.h / 2 - fresh.length * CELL_HEIGHT;
        spr.eventMode = 'none';
        this.clipContainer.addChild(spr); // masked at the grid top
        temps.push(spr);
        gsap.to(spr, { y: rect.y + rect.h / 2, duration: fallDur * teaseMul, ease: 'power2.in', delay: teaseDelay(reel) + 0.03 * speed * i });
      }
    }
    const teaseTail = opts.teaseSlow ? teaseCols.length * 0.5 * speed + fallDur * (teaseMul - 1) : 0;
    await new Promise<void>(r => { gsap.delayedCall(fallDur + 0.12 * speed + teaseTail, () => r()); });

    // 3. NORMALISE: every cell snaps to its canonical spot showing boardAfter
    //    (same-frame swap with the settled visuals — seamless), temps die.
    //    Gifts keep their TIER art (crateAt built before the fall).
    for (const t of temps) { try { t.parent?.removeChild(t); t.destroy(); } catch { /* gone */ } }
    for (let reel = 0; reel < reels; reel++) {
      const moved = removedByReel.has(reel);
      for (let row = 0; row < rows; row++) {
        const cell = this.reels[reel]?.getVisibleCell(row);
        if (!cell) continue;
        const inner = cell.objectLayer;
        gsap.killTweensOf(inner); gsap.killTweensOf(inner.scale);
        inner.y = SYMBOL_HEIGHT / 2;
        inner.scale.set(1);
        inner.alpha = 1;
        const crateVal = crateAt.get(row * reels + reel);
        cell.setSymbol((crateVal !== undefined
          ? fruitGiftTierId(crateVal)
          : step.boardAfter[row][reel]) as SymbolIdType);
        // downward squash on the cells that actually moved — the impact
        // bounce STRETCHED the art taller ("Vergrößern", Noski) and is gone.
        if (moved && !opts.turbo) this.squashLand(cell);
      }
    }
    this.elevateScatterCells(); // BONUS in front of everything (Noski)
  }

}
