// PixiJS Application — initialises the WebGL canvas and manages the game scene.
// Lifecycle is owned by the GameCanvas React component via useEffect.

import { Application, Assets, BlurFilter, Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture, Ticker } from 'pixi.js';
import { gsap } from 'gsap';
import { ReelSet, type ReelSetAudioHooks } from './ReelSet';
import { setActiveGrid, type GridConfig } from '@/config/gridConfig';
import { WIN_LINE_PRESETS, WIN_COIN_PRESETS, ACCENT_PRESETS } from '@/config/adjustableParams';
import { waysLightConfig, WAYS_LIGHT_PRESETS, WAYS_LIGHT_SPEED_MS, WAYS_LIGHT_WIDTH_PX } from './effects/WaysLightComet';
import { stickyWildConfig, STICKY_WILD_PRESETS, STICKY_WILD_SPEED_MS } from './effects/StickyWildShine';
import { SYMBOL_WIN_SHEETS, AnimatedSymbol } from './AnimatedSymbol';
import { symbolSizing, SYMBOL_SIZE_PRESETS } from '@/config/symbolSizing';
import { hslToNum, numToHsl, hexToNum } from '@/config/color';
import { CANVAS_THEME } from '@/config/canvasTheme';
import { deriveStopsFromRandomness, type SpinOutcome } from '@/engine/SlotEngine';
import { buildBoard } from '@/config/reels';
import { evaluateWins, type WinResult } from '@/engine/WinEvaluator';
import { DEFAULT_GAME_CONFIG, type GameConfig, type GameTheme } from '@/engine/GameConfig';
import { playDeterministicHoldAndWin, HW_TRIGGER_MIN } from '@/engine/holdAndWin';
import { loadSymbolAtlases, type SymbolAtlasMap } from './SymbolAtlasLoader';
import {
  preloadLucideTextures,
  createLucideTextureCache,
  disposeLucideTextureCache,
  type LucideTextureCache,
} from './lucideIcon';
import { WinCelebration, WIN_CELEBRATION_CONFIG, type WinTierImageUrls } from './WinCelebration';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Linear blend between two 0xRRGGBB colours (t: 0 = a, 1 = b). */
function blendHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF;
  const br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF;
  return (Math.round(ar + (br - ar) * t) << 16)
    | (Math.round(ag + (bg - ag) * t) << 8)
    | Math.round(ab + (bb - ab) * t);
}


const FRAME_PAD = 28;
const HEADER_H = 52;
const FOOTER_H = 20;
const SCENE_MARGIN = 40;

type Theme = 'dark' | 'light';

const THEMES = CANVAS_THEME.modes;

/** Clone a GameTheme so per-instance Texture maps (iconTextures,
 *  userAssetTextures) live on a private object instead of being mutated
 *  onto a module-level theme singleton (themes.ts exports FANTASY,
 *  CYBERPUNK etc. as shared instances). Without this clone, two PixiApps
 *  share textures from each other's destroyed GL contexts. */
function cloneTheme(theme: GameTheme): GameTheme {
  return {
    ...theme,
    // Force fresh texture maps — never inherit from the source.
    iconTextures: undefined,
    userAssetTextures: undefined,
  };
}

export class PixiApp {
  private app: Application;
  private reelSet!: ReelSet;
  private sceneRoot: Container;
  private gameContainer: Container;
  private winBanner: Container;
  private transitionCard: Container | null = null;
  private transitionCardTl: ReturnType<typeof gsap.timeline> | null = null;
  // Looney-Tunes iris-wipe (free-spins entry): screen-space overlay on app.stage.
  private irisOverlay: Container | null = null;
  private irisTl: ReturnType<typeof gsap.timeline> | null = null;
  private irisState: { r: number; tint: number } | null = null;
  // Resolver for the in-flight iris Promise — invoked by destroy() too, since a
  // killed GSAP timeline never fires onComplete (else the awaited spin hangs).
  private irisResolve: (() => void) | null = null;
  // Optional custom free-spins INTRO SCREEN art (e.g. the Vice "BONUS" board),
  // shown when the iris opens. Falls back to the plain placeholder if unset.
  private fsIntroTexture: Texture | null = null;
  // Free-spins-ONLY background: swapped in under the closed iris (never
  // visibly), swapped back when the round ends.
  private fsBgTexture: Texture | null = null;
  /** ANIMATED free-spins background (spritesheet frames); while the FS round
   *  runs the bg ticker cycles these instead of the base loop. */
  private fsAnimSheets: Texture[] | null = null;
  private fsAnimFrames: Texture[] | null = null;
  private fsAnimFps = 12;
  private fsBgAnimActive = false;
  /** FS counter overlay currently on screen (swept by the next resolve if a
   *  cancelled run skipped its closing iris). */
  private fsOverlayOpen: { container: Container; counter: Text } | null = null;
  private fsBgSavedBase: Texture | null = null;
  private fsBgActive = false;
  private ambientLayer: Container | null = null;
  private ambientTweens: ReturnType<typeof gsap.timeline>[] = [];
  /** Celebration coin tints (base, deep, highlight) — live-adjustable via the
   *  chat-config `winCoinColor` param. */
  private winCoinColors: number[] = [0xFFD23F, 0xFFC107, 0xFFE082];
  /** AAA win celebration (owns its own app.stage overlay). */
  private winCelebration: WinCelebration | null = null;
  /** Big central win-amount number that counts up over the grid (coin-win
   *  ceremony) — the focal point, separate from the sidebar WIN box. */
  private winNumberText!: Text;
  // Per-win celebration FX (sparks, coin shower, glow, dim overlay).
  // Replaced fresh on every win — children destroyed when the banner exits.
  private celebrationFx!: Container;
  // Standalone tween targets that are NOT celebrationFx children (e.g. the
  // ballistic `state` proxies driving spark motion). killTweensOf(children)
  // can't reach these, so we track them explicitly and kill them on
  // clearCelebrationFx()/destroy() — otherwise they keep ticking and write
  // into Graphics that have already been destroyed.
  private fxStateTargets: object[] = [];
  private _ready = false;
  private _initialized = false;
  /** Set when destroy() runs. init()'s async continuation checks this
   *  after every await to abort cleanly if React unmounted us mid-flight
   *  (StrictMode or fast nav). */
  private _aborted = false;
  turbo = false;

  // Reel-window tint (chat-config reelBg* params): a colour + opacity overlay
  // on the reel area. Defaults ≈ the original dark backdrop (near-black @ 62%).
  private reelTint: Graphics | null = null;
  private reelBgHue = 220;
  private reelBgSat = 0;
  private reelBgLight = 4;
  private reelBgOpacity = 62;
  // Frame bezel colour (chat-config frame* params) — universal neutral grey by
  // default; a clean layered rounded-rect bezel (Hacksaw-base style).
  private frameHue = 0;
  private frameSat = 0;
  private frameLight = 26;
  private frameOpacity = 100;
  /** Band thickness in px — how far the frame extends OUT from the reel grid. */
  private frameWidth = 22;
  /** Rising ambient "dust" motes over the reels — OFF by default. */
  private motesEnabled = false;

  // Theme-sensitive Graphics — redrawn by setTheme()
  private backdropGraphic!: Graphics;
  private ambientGraphic!: Graphics;
  private ambient2Graphic!: Graphics;
  private frameGraphic!: Graphics;
  private borderOuterGraphic!: Graphics;
  private borderInnerGraphic!: Graphics;
  private sheenGraphic!: Graphics;
  // Preview-only frame-image overlay (the generator renders the frame
  // procedurally; this lets the studio drop a custom frame PNG over it).
  private frameImageSprite: Sprite | null = null;
  private frameTexture: Texture | null = null;
  private frameW = 0;
  private frameH = 0;
  private frameToken = 0;
  private titleText!: Text;
  /** Optional logo image replacing the text title (see setTitleImage). */
  private titleSprite: Sprite | null = null;
  private titleTexture: Texture | null = null;
  /** Bottom band reserved for the DOM control-bar overlay, as a fraction of
   *  the canvas WIDTH (the bar strip is 150/1200 of the design width). 0 = off. */
  public bottomHudFraction = 0;
  private currentTheme: Theme = 'dark';
  /** Ambient glow + spotlight intensity multiplier (chat-config 'backgroundMood'). */
  private ambientScale = 1;
  /** Title foil colour override (chat-config 'titleColor'); undefined = default. */
  private titleColorOverride?: number;
  /** Win-banner accent colour override (chat-config 'winBannerColor'). */
  private winBannerColorOverride?: number;

  private atlases: SymbolAtlasMap = {};
  /** Per-game config — passed through to ReelSet. Theme tokens (accent, title,
   *  win-banner colour) drive PixiApp's own ambient glow + title rendering.
   *  Theme is cloned in the constructor so per-instance texture maps don't
   *  leak into the singleton. */
  private readonly config: GameConfig;
  /** Per-instance grid shape (5×3 or 5×5). Defaults to the active singleton
   *  at construction time so existing call sites get V1 behaviour for free.
   *  The wizard preview passes an explicit grid when launching 5×5 games. */
  private readonly grid: GridConfig;

  /** Audio hooks set before init() completed; applied once reelSet exists. */
  private _pendingAudioHooks: ReelSetAudioHooks | null = null;

  /** Instance-level lucide texture cache. Destroyed on app teardown so
   *  textures from past PixiApps never live on a different GL context. */
  private lucideCache: LucideTextureCache = createLucideTextureCache();

  /** Monotonic counter for setUserAssetTextures calls. Only the commit
   *  whose token matches `userAssetToken` at completion is allowed to
   *  publish — protects against out-of-order Promise resolution when the
   *  user re-uploads quickly. */
  private userAssetToken = 0;

  // Animated (spritesheet) background: cycles frames on bgSprite via the ticker.
  private bgAnimSheets: Texture[] | null = null;
  private bgAnimFrames: Texture[] | null = null;
  /** Cross-fade overlay: carries frame N+1 at alpha = progress through frame N,
   *  so a modest sheet fps reads as continuous motion instead of stepping. */
  private bgSpriteB: Sprite | null = null;
  private bgAnimCb: ((t: Ticker) => void) | null = null;
  private bgAnimIdx = 0;
  private bgAnimAccum = 0;
  private bgAnimFps = 12;
  private bgAnimPaused = false;

  /** Optional full-canvas background image (uploaded via the asset-swap UI).
   *  Sits behind the machine scene; cover-fit to the renderer and re-fit on
   *  resize. Token guards rapid swaps the same way userAssetTextures does. */
  private bgSprite: Sprite | null = null;
  private bgTexture: Texture | null = null;
  private bgToken = 0;
  /** Reel backdrop: a static vignette (depth, always shown) + an optional
   *  frosted blurred copy of the background (when a bg image is set), both
   *  clipped to the reel window and sitting just behind the symbols. */
  private reelBackdropContainer: Container | null = null;
  private reelVignette: Graphics | null = null;
  private reelFrosted: Sprite | null = null;

  constructor(config: GameConfig = DEFAULT_GAME_CONFIG, grid: GridConfig = config.gridConfig) {
    this.config = { ...config, theme: cloneTheme(config.theme) };
    this.grid = grid;
    // Sync the active-grid singleton so any fallback consumer (anchors / a Reel
    // built without an explicit visibleRows) matches this game's grid. Without
    // this, `new PixiApp()` for a 5×5 build left the singleton at 5×3.
    setActiveGrid(grid);
    this.app = new Application();
    this.sceneRoot = new Container();
    this.gameContainer = new Container();
    this.winBanner = new Container();
    // Placeholder so destroy()/onResize() (which can run before buildScene on a
    // StrictMode mount→cleanup→mount) never touch an undefined winNumberText.
    this.winNumberText = new Text({ text: '', style: new TextStyle({ fontSize: 1 }) });
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    // Yield one microtask before claiming the canvas. React StrictMode
    // (dev) runs effects as mount → cleanup → mount synchronously, so an
    // immediate-remount sequence calls destroy() between the two mounts.
    // Without this yield, the first PixiApp synchronously hits
    // `this.app.init({ canvas })` and claims the canvas before cleanup
    // gets a chance to flip `_aborted`. With this yield, the abort check
    // below runs before the renderer touches the DOM, and the canvas is
    // free for the surviving second PixiApp.
    await Promise.resolve();
    if (this._aborted) return;

    // Load symbol atlases AND rasterise themed Lucide icons in parallel with
    // Pixi's renderer init. Atlases take precedence (real art); Lucide icons
    // are the placeholder upgrade for themed games.
    const themeIcons = this.config.theme.iconComponents;
    const iconEntries = themeIcons
      ? Object.entries(themeIcons).map(([id, icon]) => ({
          id: Number(id),
          icon: icon as NonNullable<typeof icon>,
          // Render every Lucide as solid white — high contrast on every tile
          // colour. Reading better than tinted icons that fight the tile bg.
          color: 0xFFFFFF,
        }))
      : [];

    const [, atlases, iconTextures] = await Promise.all([
      this.app.init({
        canvas,
        resizeTo: canvas.parentElement ?? canvas,
        background: CANVAS_THEME.modes.dark.rendererBg,
        antialias: true,
        resolution: window.devicePixelRatio ?? 1,
        autoDensity: true,
      }),
      loadSymbolAtlases(),
      iconEntries.length > 0
        ? preloadLucideTextures(iconEntries, this.lucideCache, 96)
        : Promise.resolve(new Map<number, Texture>()),
    ]);

    // If destroy() ran while these resources were loading, drop everything
    // and exit cleanly. The renderer was successfully attached to the
    // canvas during Promise.all — tear it down so a re-mount can claim it.
    if (this._aborted) {
      try {
        this.app.destroy({ removeView: false }, { children: true });
      } catch {
        /* renderer may have failed to fully attach */
      }
      this.releaseLoadedResources(atlases, iconTextures);
      return;
    }

    this.atlases = atlases;
    if (iconTextures.size > 0) {
      this.config.theme.iconTextures = iconTextures;
    }
    // Load brand fonts (Poppins/Rubik) before any canvas Text is created — Pixi
    // rasterizes text once and won't re-render if the web font arrives later.
    await this.ensureFontsLoaded();
    if (this._aborted) return;
    this.reelSet = new ReelSet(this.atlases, this.config, this.grid);
    this._initialized = true;
    this.buildScene();
    this.winCelebration = new WinCelebration(this.app, {
      accent: this.config.theme.accent,
      coinColors: this.winCoinColors,
      fontFamily: "'Poppins', ui-sans-serif, sans-serif",
    });
    this._ready = true;
    // Apply any theme/audio hooks set before init completed
    this.setTheme(this.currentTheme);
    if (this._pendingAudioHooks) {
      this.reelSet.audioHooks = this._pendingAudioHooks;
      this._pendingAudioHooks = null;
    }
  }

  /** Release textures + spritesheets loaded by an aborted init() so they
   *  don't leak when the parent unmounted before scene construction. */
  private releaseLoadedResources(
    atlases: SymbolAtlasMap,
    iconTextures: Map<number, Texture>,
  ): void {
    for (const tex of iconTextures.values()) {
      try {
        tex.destroy(true);
      } catch {
        /* texture may already be partially destroyed */
      }
    }
    iconTextures.clear();
    for (const sheet of Object.values(atlases)) {
      try {
        sheet?.destroy?.(true);
      } catch {
        /* atlas may already be partially destroyed */
      }
    }
    void disposeLucideTextureCache(this.lucideCache);
  }

  get ready(): boolean {
    return this._ready;
  }

  /** Best-effort preload of the brand fonts (Poppins/Rubik) so canvas text is
   *  rasterized in the correct face, not a fallback. Resolves fast once cached. */
  private async ensureFontsLoaded(): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts?.load) return;
    try {
      await Promise.all([
        document.fonts.load("800 italic 40px 'Poppins'"),
        document.fonts.load("700 16px 'Poppins'"),
        document.fonts.load("400 16px 'Rubik'"),
        document.fonts.load("700 16px 'Rubik'"),
      ]);
    } catch {
      /* best-effort — fall back to system fonts if loading fails */
    }
  }

  private buildScene() {
    const stage = this.app.stage;
    stage.addChild(this.sceneRoot);

    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    const rh = this.reelSet.totalHeight + FRAME_PAD * 2;
    const totalH = HEADER_H + rh + FOOTER_H;

    // ── Ambient background: gradient "stage" + soft radial glows ─────────
    // (replaces two flat hard-edged ellipses that read as a near-black void).
    this.backdropGraphic = new Graphics();
    this.sceneRoot.addChild(this.backdropGraphic);
    this.ambientGraphic = new Graphics();
    this.sceneRoot.addChild(this.ambientGraphic);
    this.ambient2Graphic = new Graphics();
    this.sceneRoot.addChild(this.ambient2Graphic);
    this.redrawAmbient(
      rw, totalH,
      CANVAS_THEME.modes.dark.ambientAlpha1,
      CANVAS_THEME.modes.dark.ambientAlpha2,
      CANVAS_THEME.modes.dark.rendererBg,
    );

    // (scene vignette removed — it smeared a dark blur over light custom
    // backgrounds; the clean flat-band frame needs no stage darkening)

    // ── Game title — logo-style wordmark (foil fill + outline + accent glow) ──
    this.titleText = new Text({ text: this.config.theme.title, style: new TextStyle({}) });
    this.titleText.anchor.set(0.5, 0);
    this.titleText.x = rw / 2;
    this.titleText.y = 0;
    this.styleTitle();
    this.sceneRoot.addChild(this.titleText);

    // ── Reel frame assembly ──────────────────────────────────────────────
    this.gameContainer.y = HEADER_H;
    this.sceneRoot.addChild(this.gameContainer);

    // (outer glow rings removed — they read as a light halo hugging the band)

    // Flat band frame (replica look) — UNIVERSAL neutral grey by default,
    // driven entirely by the frame* params (redrawFrame). No themed hardware.
    this.frameGraphic = new Graphics();
    this.gameContainer.addChild(this.frameGraphic);
    this.frameW = rw;
    this.frameH = rh;
    this.borderOuterGraphic = new Graphics();
    this.gameContainer.addChild(this.borderOuterGraphic);
    this.borderInnerGraphic = new Graphics();
    this.gameContainer.addChild(this.borderInnerGraphic);
    this.sheenGraphic = new Graphics();
    this.gameContainer.addChild(this.sheenGraphic);
    this.redrawFrame();

    // Reel backdrop: a static vignette (depth, always) + a frosted blurred copy
    // of the background (added by updateReelBackdrop when a bg image is set).
    // Clipped to the reel window, sits just behind the reels.
    const bdW = this.reelSet.totalWidth;
    const bdH = this.reelSet.totalHeight;
    this.reelBackdropContainer = new Container();
    const bdMask = new Graphics();
    bdMask.roundRect(FRAME_PAD, FRAME_PAD, bdW, bdH, 10).fill(0xffffff);
    this.reelBackdropContainer.addChild(bdMask);
    this.reelBackdropContainer.mask = bdMask;
    this.gameContainer.addChild(this.reelBackdropContainer);

    // Colour + opacity tint over the whole reel window (chat-config reelBg*):
    // sits ABOVE the frosted bg copy (added at index 1 by updateReelBackdrop),
    // so it tints/darkens it. Defaults ≈ the original near-black @ 62%.
    this.reelTint = new Graphics();
    this.reelBackdropContainer.addChild(this.reelTint);
    this.applyReelTint();

    // Vignette / inner shadow — a thick dark stroke on the window edge, blurred
    // inward; the container mask clips its outer half. Gives the reel area depth
    // even with NO background image.
    this.reelVignette = new Graphics();
    this.reelVignette.roundRect(FRAME_PAD, FRAME_PAD, bdW, bdH, 10);
    this.reelVignette.stroke({ color: 0x000000, width: 56, alpha: 0.65 });
    this.reelVignette.filters = [new BlurFilter({ strength: 18, quality: 3 })];
    this.reelBackdropContainer.addChild(this.reelVignette);

    // Reel set
    this.reelSet.container.x = FRAME_PAD;
    this.reelSet.container.y = FRAME_PAD;
    this.gameContainer.addChild(this.reelSet.container);
    this.spawnAmbientMotes();

    // (row indicator dots removed — the flat band frame has no side hardware)

    // ── Win Banner container (kept as a z-marker for celebration FX) ──
    this.winBanner.visible = false;
    this.winBanner.alpha = 0;

    // FX layer sits just below the banner so sparks, glow, and dim render
    // behind it while coin sprites can sit on the same plane (added per win).
    this.celebrationFx = new Container();
    this.sceneRoot.addChild(this.celebrationFx);
    this.sceneRoot.addChild(this.winBanner);

    // Central win-amount number (coin-win ceremony) — bold gold with a dark
    // edge + glow, multi-line (optional tier label above the amount). On top so
    // it stays readable over the dim + flying coins.
    this.winNumberText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
        fontSize: 40,
        fontWeight: '800',
        fontStyle: 'italic',
        align: 'center',
        fill: 0xFFD24A,
        stroke: { color: 0x3A1500, width: 6 },
        dropShadow: { color: 0x000000, blur: 9, distance: 3, alpha: 0.6 },
      }),
    });
    this.winNumberText.anchor.set(0.5, 0.5);
    this.winNumberText.alpha = 0;
    this.sceneRoot.addChild(this.winNumberText);

    this.onResize();
    this.app.renderer.on('resize', () => this.onResize());
  }

  private onResize() {
    // app.screen returns logical CSS-pixel dimensions, regardless of devicePixelRatio.
    // app.renderer.width/height returns PHYSICAL pixels and breaks layout on HiDPI.
    const { width, height } = this.app.screen;

    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    const rh = this.reelSet.totalHeight + FRAME_PAD * 2;
    const totalH = HEADER_H + rh + FOOTER_H;
    const totalW = rw;

    // The DOM control bar overlays the canvas bottom (strip = width × 150/1200
    // design-px). The grid keeps its ORIGINAL size (scale computed against the
    // full box) and only re-centres in the area ABOVE the bar; a clamp shrinks
    // it solely when it genuinely wouldn't fit over the bar.
    const hud = width * this.bottomHudFraction;

    // Scale scene to fit viewport with margin
    const availW = width - SCENE_MARGIN * 2;
    const availH = height - SCENE_MARGIN * 2;
    const scaleX = availW / totalW;
    const scaleY = availH / totalH;
    // ×0.85 — grid sits 15% smaller in the bounded box (still centred below),
    // giving the animated background more breathing room around the reels.
    let scale = Math.min(scaleX, scaleY, 1.3) * 0.85;
    // Only-if-needed clamp: never let the grid extend into the bar band.
    if (hud > 0 && totalH * scale > height - hud - 8) {
      scale = (height - hud - 8) / totalH;
    }

    this.sceneRoot.scale.set(scale);
    this.sceneRoot.x = Math.round((width - totalW * scale) / 2);
    this.sceneRoot.y = Math.round((height - hud - totalH * scale) / 2);

    // Centre win banner over reels
    this.winBanner.x = rw / 2;
    this.winBanner.y = HEADER_H + rh / 2;
    this.winNumberText.x = rw / 2;
    this.winNumberText.y = HEADER_H + rh / 2;

    // Re-fit the optional background image to the new renderer size.
    this.fitBackground();
  }

  /** Full-scene vertical gradient "stage" (themed tint up top → deep base),
   *  drawn as stacked full-width bands so corners stay clean (no rounding). */
  private drawBackdrop(g: Graphics, w: number, h: number, top: number, bottom: number): void {
    g.clear();
    const bands = 26;
    const x = -w * 0.25, bw = w * 1.5;   // overscan sides
    const y0 = -h * 0.2, bh = h * 1.4;   // overscan top/bottom
    const step = bh / bands;
    for (let i = 0; i < bands; i++) {
      g.rect(x, y0 + step * i, bw, step + 1.5);
      g.fill({ color: blendHex(top, bottom, i / (bands - 1)) });
    }
  }

  /** Soft radial glow: stacked concentric ellipses (bright centre → faint
   *  edge) — a real falloff, unlike a single flat-alpha ellipse. */
  private drawSoftGlow(
    g: Graphics, cx: number, cy: number, rx: number, ry: number, color: number, peakAlpha: number,
  ): void {
    const steps = 10;
    for (let i = steps; i >= 1; i--) {
      const f = i / steps; // 1 (outer) … 0.1 (inner)
      g.ellipse(cx, cy, rx * f, ry * f);
      g.fill({ color, alpha: peakAlpha / steps });
    }
  }

  /** Redraw the background stage + both ambient glows for the current theme. */
  private redrawAmbient(rw: number, totalH: number, a1: number, a2: number, baseBg: number): void {
    const accent = this.config.theme.accent;
    const accent2 = this.config.theme.accent2;
    const top = blendHex(blendHex(baseBg, accent, 0.20), 0xffffff, 0.06);
    const bottom = blendHex(baseBg, 0x000000, 0.40);
    const s = this.ambientScale; // 'backgroundMood' intensity multiplier
    this.drawBackdrop(this.backdropGraphic, rw, totalH, top, bottom);
    this.ambientGraphic.clear();
    this.drawSoftGlow(this.ambientGraphic, rw / 2, totalH * 0.40, rw * 0.82, totalH * 0.66, accent, a1 * 3.2 * s);
    this.ambient2Graphic.clear();
    this.drawSoftGlow(this.ambient2Graphic, rw / 2, totalH * 0.46, rw * 0.52, totalH * 0.42, accent2, a2 * 3.5 * s);
    // Tight, brighter central spotlight → lifts the reel frame off the stage.
    this.drawSoftGlow(this.ambient2Graphic, rw / 2, totalH * 0.43, rw * 0.34, totalH * 0.30, blendHex(accent, 0xffffff, 0.30), a2 * 4.0 * s);
  }

  /** Live intensity multiplier for the ambient glow + spotlight (chat-config
   *  'backgroundMood'). Re-renders the glow layers at the current theme. */
  public setAmbientIntensity(scale: number): void {
    this.ambientScale = Math.max(0.1, scale);
    if (!this._ready) return;
    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    const rh = this.reelSet.totalHeight + FRAME_PAD * 2;
    const totalH = HEADER_H + rh + FOOTER_H;
    const t = THEMES[this.currentTheme];
    this.redrawAmbient(rw, totalH, t.ambientAlpha1, t.ambientAlpha2, t.rendererBg);
  }

  /** Replace the text title with a LOGO IMAGE above the grid. Sized to the
   *  grid: height-capped so it stays inside the box's top padding, width-capped
   *  at 60% of the reel width; bottom-anchored just above the frame. Pass null
   *  to restore the text title. */
  async setTitleImage(url: string | null): Promise<void> {
    if (!this._initialized || this._aborted) return;
    if (this.titleSprite) {
      this.titleSprite.parent?.removeChild(this.titleSprite);
      try { this.titleSprite.destroy(); } catch { /* torn down */ }
      this.titleSprite = null;
    }
    if (this.titleTexture) {
      try { this.titleTexture.destroy(true); } catch { /* torn down */ }
      this.titleTexture = null;
    }
    if (!url) { this.titleText.visible = true; return; }

    let tex: Texture;
    try { tex = await Assets.load<Texture>(url); }
    catch (err) { console.warn('[PixiApp] failed to load title image:', err); return; }
    if (this._aborted) { try { tex.destroy(true); } catch { /* torn down */ } return; }

    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    // Fit: ≤60% of grid width AND ≤150 scene-px tall (clears the box top even
    // after the 60vh height cap), preserving the logo's aspect ratio.
    const s = Math.min((rw * 0.6) / tex.width, 150 / tex.height);
    this.titleSprite = new Sprite(tex);
    this.titleSprite.anchor.set(0.5, 1);
    this.titleSprite.scale.set(s);
    this.titleSprite.x = rw / 2;
    this.titleSprite.y = HEADER_H - 2; // bottom edge sits just above the frame
    this.titleTexture = tex;
    this.titleText.visible = false;
    this.sceneRoot.addChild(this.titleSprite);
  }

  /** Logo-style title: warm foil fill, dark outline for legibility on any
   *  background, and a soft accent glow — reads as a wordmark, not caption text. */
  private styleTitle(): void {
    this.titleText.style = new TextStyle({
      fontFamily: "'Poppins', ui-sans-serif, system-ui, sans-serif",
      fontSize: 27,
      fontWeight: '800',
      fontStyle: 'italic',
      fill: this.titleColorOverride ?? 0xFFF4D6,
      letterSpacing: 3,
      stroke: { color: 0x140B22, width: 4.5, join: 'round' },
      dropShadow: { color: this.config.theme.accent, blur: 18, distance: 0, alpha: 0.6, angle: 0 },
    });
  }

  setTheme(theme: Theme) {
    this.currentTheme = theme;
    if (!this._ready) return;

    const t = THEMES[theme];
    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    const rh = this.reelSet.totalHeight + FRAME_PAD * 2;
    const totalH = HEADER_H + rh + FOOTER_H;

    this.app.renderer.background.color = t.rendererBg;

    this.redrawAmbient(rw, totalH, t.ambientAlpha1, t.ambientAlpha2, t.rendererBg);

    // The frame is theme-independent now: a flat band driven by the frame*
    // params (universal grey by default) — never redrawn from theme colours.
    this.redrawFrame();

    this.styleTitle();

    this.reelSet.setTheme(theme);
  }

  /**
   * Replace the user-uploaded PNG override map. Pass a map keyed by numeric
   * SymbolId → data URL. Each entry is asynchronously decoded into a Pixi
   * Texture; once all are ready (and the call hasn't been superseded by a
   * later one), the theme's userAssetTextures are updated and visible reel
   * cells are repainted in place. Pass an empty map to clear all overrides.
   *
   * Race-safe: a monotonically increasing token guards against out-of-order
   * resolution — a slow-resolving early upload cannot clobber a fast-resolving
   * later one. Leak-safe: textures replaced or removed are explicitly
   * destroyed.
   */
  async setUserAssetTextures(byId: Map<number, string>): Promise<void> {
    if (!this._ready || this._aborted) return;
    const myToken = ++this.userAssetToken;

    const next = new Map<number, Texture>();
    await Promise.all(
      Array.from(byId.entries()).map(async ([id, dataUrl]) => {
        try {
          // Downscale large images to prevent GPU memory exhaustion / GL context loss.
          const safeUrl = await constrainImageSize(dataUrl, 512);
          const tex = await Assets.load<Texture>(safeUrl);
          next.set(id, tex);
        } catch (err) {
          console.warn('[PixiApp] failed to load user asset for symbol', id, err);
        }
      }),
    );

    // If a newer call has started (or destroy ran) while we were loading,
    // abandon this batch. Destroy any textures we loaded — but NOT ones that
    // are the same instance as a currently-committed texture: pixi's Assets
    // cache returns the SAME Texture for an identical (URL/dataURL) key, so a
    // cache hit would otherwise destroy a live, in-use texture.
    if (myToken !== this.userAssetToken || this._aborted) {
      const live = this.config.theme.userAssetTextures;
      const liveSet = live ? new Set(live.values()) : null;
      for (const tex of next.values()) {
        if (liveSet?.has(tex)) continue; // shared with the live map — keep it
        try {
          tex.destroy(true);
        } catch {
          /* already torn down */
        }
      }
      return;
    }

    // Destroy outgoing textures (replaced or removed) before swapping in the
    // new map. CAUTION: Assets.load is cache-keyed by dataURL, and
    // constrainImageSize returns the original URL unchanged for small images,
    // so re-uploading the same PNG yields the SAME Texture instance in both
    // prev and next. Only destroy an outgoing texture if it is NOT reused in
    // the new map — otherwise we'd destroy the texture we're about to display.
    const prev = this.config.theme.userAssetTextures;
    if (prev) {
      const nextSet = new Set(next.values());
      for (const oldTex of prev.values()) {
        if (nextSet.has(oldTex)) continue; // reused (cache hit) — keep alive
        try {
          oldTex.destroy(true);
        } catch {
          /* already torn down */
        }
      }
    }

    this.config.theme.userAssetTextures = next.size > 0 ? next : undefined;
    this.reelSet.refreshAllTiles();
  }

  /**
   * Set (or clear, with null) a full-canvas background image behind the
   * machine. Cover-fits the renderer and re-fits on resize. Race-safe via a
   * monotonic token; leak-safe — the previous texture is destroyed on swap.
   */
  /** Preview-only: overlay a custom frame PNG over the procedural reel frame.
   *  Use a frame image with a transparent centre window so the reels show
   *  through. Sized to the frame bounds; scales with the scene. `null` clears. */
  async setFrameImage(dataUrl: string | null): Promise<void> {
    if (!this._initialized || this._aborted) return;
    const myToken = ++this.frameToken;
    if (!dataUrl) {
      this.clearFrameImage();
      return;
    }
    let tex: Texture;
    try {
      tex = await Assets.load<Texture>(dataUrl);
    } catch (err) {
      console.warn('[PixiApp] failed to load frame image:', err);
      return;
    }
    if (myToken !== this.frameToken || this._aborted) {
      try { tex.destroy(true); } catch { /* torn down */ }
      return;
    }
    this.clearFrameImage();
    this.frameTexture = tex;
    const sp = new Sprite(tex);
    sp.width = this.frameW;
    sp.height = this.frameH;
    this.frameImageSprite = sp;
    this.gameContainer.addChild(sp); // topmost child → border sits over the reels
  }

  private clearFrameImage(): void {
    if (this.frameImageSprite) {
      this.frameImageSprite.parent?.removeChild(this.frameImageSprite);
      try { this.frameImageSprite.destroy(); } catch { /* torn down */ }
      this.frameImageSprite = null;
    }
    if (this.frameTexture) {
      try { this.frameTexture.destroy(true); } catch { /* torn down */ }
      this.frameTexture = null;
    }
  }

  async setBackgroundImage(dataUrl: string | null): Promise<void> {
    if (!this._initialized || this._aborted) return;
    const myToken = ++this.bgToken;

    if (!dataUrl) {
      this.clearBackgroundImage();
      return;
    }

    let tex: Texture;
    try {
      tex = await Assets.load<Texture>(dataUrl);
    } catch (err) {
      console.warn('[PixiApp] failed to load background image:', err);
      return;
    }

    // A newer call (or destroy) started while we were loading — abandon.
    if (myToken !== this.bgToken || this._aborted) {
      if (tex !== this.bgTexture) {
        try { tex.destroy(true); } catch { /* already torn down */ }
      }
      return;
    }

    this.clearBackgroundImage();
    this.bgTexture = tex;
    this.bgSprite = new Sprite(tex);
    this.bgSprite.anchor.set(0.5);
    // Behind sceneRoot (added first in buildScene → currently at index 0).
    this.app.stage.addChildAt(this.bgSprite, 0);
    // The gradient "stage" backdrop is opaque and lives in sceneRoot (above
    // bgSprite), so it would hide the user's background. The user bg and the
    // gradient stage are mutually-exclusive background layers — hide the
    // gradient while a bg image is shown (restored in clearBackgroundImage).
    if (this.backdropGraphic) this.backdropGraphic.visible = false;
    this.fitBackground();
    this.updateReelBackdrop();
  }

  /** Animated background from one or more SPRITESHEETS (grid of frames,
   *  row-major; multiple sheets are consumed in order so total frame count can
   *  exceed the single-texture GPU limit). Slices into `count` sub-textures and
   *  cycles them on the background sprite at `fps`. Reuses the static bg
   *  pipeline (cover-fit + frosted reel backdrop). Pass null to clear. */
  async setBackgroundSpritesheet(
    url: string | string[] | null, cols: number, rows: number, count?: number, fps = 12,
  ): Promise<void> {
    if (!this._initialized || this._aborted) return;
    const myToken = ++this.bgToken;
    this.clearBackgroundImage(); // tears down any static bg AND stops any anim
    if (!url || (Array.isArray(url) && url.length === 0)) return;

    const urls = Array.isArray(url) ? url : [url];
    const sheets: Texture[] = [];
    try { for (const u of urls) sheets.push(await Assets.load<Texture>(u)); }
    catch (err) {
      console.warn('[PixiApp] failed to load bg spritesheet:', err);
      for (const s of sheets) { try { s.destroy(true); } catch { /* torn down */ } }
      return;
    }
    if (myToken !== this.bgToken || this._aborted) {
      for (const s of sheets) { try { s.destroy(true); } catch { /* torn down */ } }
      return;
    }

    const fw = sheets[0].width / cols, fh = sheets[0].height / rows;
    const perSheet = cols * rows;
    const n = Math.max(1, count ?? perSheet * sheets.length);
    const frames: Texture[] = [];
    for (let i = 0; i < n; i++) {
      const sheet = sheets[Math.floor(i / perSheet)];
      if (!sheet) break; // count exceeds supplied sheets — use what we have
      const local = i % perSheet;
      const cx = (local % cols) * fw, cy = Math.floor(local / cols) * fh;
      frames.push(new Texture({ source: sheet.source, frame: new Rectangle(cx, cy, fw, fh) }));
    }
    this.bgAnimSheets = sheets;
    this.bgAnimFrames = frames;
    this.bgAnimFps = Math.max(1, fps);
    this.bgAnimIdx = 0; this.bgAnimAccum = 0; this.bgAnimPaused = false;

    // bgTexture = frame 0 so cover-fit + FS-swap see a stable frame-sized tex.
    this.bgTexture = frames[0];
    this.bgSprite = new Sprite(frames[0]);
    this.bgSprite.anchor.set(0.5);
    this.app.stage.addChildAt(this.bgSprite, 0);
    // Cross-fade overlay directly above the base bg (still behind sceneRoot).
    if (frames.length > 1) {
      this.bgSpriteB = new Sprite(frames[1]);
      this.bgSpriteB.anchor.set(0.5);
      this.bgSpriteB.alpha = 0;
      this.app.stage.addChildAt(this.bgSpriteB, 1);
    }
    if (this.backdropGraphic) this.backdropGraphic.visible = false;
    this.fitBackground();
    this.updateReelBackdrop();

    this.bgAnimCb = () => {
      if (this.bgAnimPaused || !this.bgSprite) return;
      // During the FS round the ticker cycles the FS frames instead.
      const frames = this.fsBgAnimActive && this.fsAnimFrames ? this.fsAnimFrames : this.bgAnimFrames;
      const fps = this.fsBgAnimActive && this.fsAnimFrames ? this.fsAnimFps : this.bgAnimFps;
      if (!frames || frames.length === 0) return;
      const total = frames.length;
      this.bgAnimAccum += this.app.ticker.deltaMS / 1000;
      const spf = 1 / fps;
      while (this.bgAnimAccum >= spf) { this.bgAnimIdx = (this.bgAnimIdx + 1) % total; this.bgAnimAccum -= spf; }
      const idx = this.bgAnimIdx % total;
      this.bgSprite.texture = frames[idx];
      if (this.bgSpriteB) {
        this.bgSpriteB.texture = frames[(idx + 1) % total];
        this.bgSpriteB.alpha = Math.min(1, this.bgAnimAccum / spf);
      }
    };
    this.app.ticker.add(this.bgAnimCb);
  }

  /** Stop + free the animated background (frames + sheet). Nulls bgTexture when
   *  it points at a frame so clearBackgroundImage never destroy(true)s the
   *  shared sheet source twice. */
  private stopBgAnim(): void {
    if (this.bgAnimCb) { this.app.ticker.remove(this.bgAnimCb); this.bgAnimCb = null; }
    if (this.bgSpriteB) {
      this.bgSpriteB.parent?.removeChild(this.bgSpriteB);
      try { this.bgSpriteB.destroy(); } catch { /* torn down */ }
      this.bgSpriteB = null;
    }
    if (this.bgTexture && (this.bgAnimFrames?.includes(this.bgTexture) || this.fsAnimFrames?.includes(this.bgTexture))) this.bgTexture = null;
    if (this.bgAnimFrames) { for (const f of this.bgAnimFrames) { try { f.destroy(false); } catch { /* torn down */ } } this.bgAnimFrames = null; }
    if (this.bgAnimSheets) { for (const s of this.bgAnimSheets) { try { s.destroy(true); } catch { /* torn down */ } } this.bgAnimSheets = null; }
    this.bgAnimPaused = false;
  }

  /** Load the six layered win-marquee images (big/mega/epic/max + WIN + plate).
   *  Pass null to clear (celebration falls back to baked text). */
  async setWinTierImages(urls: WinTierImageUrls | null): Promise<void> {
    await this.winCelebration?.setTierImages(urls);
  }

  /** Load the coin-rain spritesheets (chroma-keyed alpha webp) played BEHIND
   *  the win marquee during celebrations. Pass null to clear. */
  async setWinCoinRain(urls: string[] | null, cols: number, rows: number, count: number, fps = 30): Promise<void> {
    await this.winCelebration?.setCoinRain(urls, cols, rows, count, fps);
  }

  /** Per-symbol WIN animation spritesheet: while that symbol's cell is in the
   *  'win' state (part of a connection) the sheet loops in place of the static
   *  art. Pass url=null to clear the symbol's sheet. */
  async setSymbolWinSheet(symbolId: number, url: string | null, cols: number, rows: number, count: number, fps = 12): Promise<void> {
    const old = SYMBOL_WIN_SHEETS.get(symbolId);
    SYMBOL_WIN_SHEETS.delete(symbolId);
    if (old) for (const f of old.frames) { try { f.destroy(false); } catch { /* torn down */ } }
    if (!url) return;
    try {
      const sheet = await Assets.load<Texture>(url);
      const fw = sheet.width / cols, fh = sheet.height / rows;
      const frames: Texture[] = [];
      for (let i = 0; i < count; i++) {
        frames.push(new Texture({ source: sheet.source, frame: new Rectangle((i % cols) * fw, Math.floor(i / cols) * fh, fw, fh) }));
      }
      SYMBOL_WIN_SHEETS.set(symbolId, { frames, fps });
    } catch (err) {
      console.warn('[PixiApp] failed to load symbol win sheet:', err);
    }
  }

  /** Load a custom free-spins INTRO SCREEN image (shown when the iris opens).
   *  Pass null to clear (falls back to the plain placeholder). */
  async setFreeSpinsIntroImage(url: string | null): Promise<void> {
    if (this._aborted) return;
    if (!url) { this.fsIntroTexture = null; return; }
    try {
      this.fsIntroTexture = await Assets.load<Texture>(url);
    } catch (err) {
      console.warn('[PixiApp] failed to load free-spins intro image:', err);
    }
  }

  /** Free-spins-ONLY background. Shown while the round runs: swapped in at the
   *  iris's full-black beat (never visibly), swapped back when the round ends.
   *  Pass null to clear (round then keeps the base background). */
  async setFreeSpinsBackgroundImage(url: string | null): Promise<void> {
    if (this._aborted) return;
    const old = this.fsBgTexture;
    this.fsBgTexture = null;
    if (url) {
      try { this.fsBgTexture = await Assets.load<Texture>(url); }
      catch (err) { console.warn('[PixiApp] failed to load free-spins background:', err); }
    }
    // Mid-round change: reflect it right away.
    if (this.fsBgActive) {
      if (this.fsBgTexture) this.presentBgTexture(this.fsBgTexture);
      else this.exitFsBackground();
    }
    if (old && old !== this.fsBgTexture) { try { old.destroy(true); } catch { /* torn down */ } }
  }

  /** ANIMATED free-spins background from spritesheet(s) — same slicing rules
   *  as setBackgroundSpritesheet. While the FS round runs, the background
   *  ticker cycles THESE frames (cross-fade included) instead of the base
   *  loop; the base loop resumes when the round ends. A static upload via
   *  setFreeSpinsBackgroundImage takes priority when both are set. */
  async setFreeSpinsBackgroundSpritesheet(
    url: string | string[] | null, cols: number, rows: number, count?: number, fps = 12,
  ): Promise<void> {
    if (this._aborted) return;
    const oldFrames = this.fsAnimFrames, oldSheets = this.fsAnimSheets;
    this.fsAnimFrames = null; this.fsAnimSheets = null;
    if (url && !(Array.isArray(url) && url.length === 0)) {
      const urls = Array.isArray(url) ? url : [url];
      const sheets: Texture[] = [];
      try {
        for (const u of urls) sheets.push(await Assets.load<Texture>(u));
        const fw = sheets[0].width / cols, fh = sheets[0].height / rows;
        const perSheet = cols * rows;
        const n = Math.max(1, count ?? perSheet * sheets.length);
        const frames: Texture[] = [];
        for (let i = 0; i < n; i++) {
          const sheet = sheets[Math.floor(i / perSheet)];
          if (!sheet) break;
          const local = i % perSheet;
          frames.push(new Texture({ source: sheet.source, frame: new Rectangle((local % cols) * fw, Math.floor(local / cols) * fh, fw, fh) }));
        }
        this.fsAnimSheets = sheets;
        this.fsAnimFrames = frames;
        this.fsAnimFps = Math.max(1, fps);
      } catch (err) {
        console.warn('[PixiApp] failed to load FS bg spritesheet:', err);
        for (const s of sheets) { try { s.destroy(true); } catch { /* torn down */ } }
      }
    }
    if (oldFrames) for (const f of oldFrames) { try { f.destroy(false); } catch { /* torn down */ } }
    if (oldSheets) for (const s of oldSheets) { try { s.destroy(true); } catch { /* torn down */ } }
  }

  /** Point the background layer at `tex` WITHOUT destroying the current base
   *  texture (the FS swap must be reversible). Same pipeline as
   *  setBackgroundImage: cover-fit sprite + frosted reel backdrop. */
  private presentBgTexture(tex: Texture): void {
    if (!this._initialized || this._aborted) return;
    this.teardownReelBackdrop();
    if (this.bgSprite) {
      this.bgSprite.texture = tex;
    } else {
      this.bgSprite = new Sprite(tex);
      this.bgSprite.anchor.set(0.5);
      this.app.stage.addChildAt(this.bgSprite, 0);
    }
    this.bgTexture = tex;
    if (this.backdropGraphic) this.backdropGraphic.visible = false;
    this.fitBackground();
    this.updateReelBackdrop();
  }

  /** Swap to the FS background (no-op without one). Called at the iris's
   *  full-black beat so the change is never visible. */
  private enterFsBackground(): void {
    if ((!this.fsBgTexture && !this.fsAnimFrames?.length) || this.fsBgActive || !this.isLive) return;
    this.fsBgSavedBase = this.bgTexture;
    this.fsBgActive = true;
    if (!this.fsBgTexture && this.fsAnimFrames?.length && this.bgAnimCb) {
      // ANIMATED FS bg — keep the ticker running, pointed at the FS frames.
      this.fsBgAnimActive = true;
      this.bgAnimIdx = 0; this.bgAnimAccum = 0;
      this.presentBgTexture(this.fsAnimFrames[0]);
      return;
    }
    this.bgAnimPaused = true; // freeze any animated bg while the static FS bg shows
    if (this.bgSpriteB) this.bgSpriteB.visible = false; // overlay must not sit above the FS bg
    this.presentBgTexture(this.fsBgTexture ?? this.fsAnimFrames![0]);
  }

  /** Restore the base-game background when the free-spins round ends. */
  private exitFsBackground(): void {
    if (!this.fsBgActive) return;
    this.fsBgActive = false;
    const base = this.fsBgSavedBase;
    this.fsBgSavedBase = null;
    this.fsBgAnimActive = false; // ticker points back at the base loop
    this.bgAnimIdx = 0; this.bgAnimAccum = 0;
    this.bgAnimPaused = false; // resume the animated bg (if any)
    if (this.bgSpriteB) this.bgSpriteB.visible = true;
    if (!this.isLive) return;
    if (base) {
      this.presentBgTexture(base);
    } else {
      // No base image was set: drop the sprite (keep the FS texture for the
      // next round) and restore the gradient stage.
      this.teardownReelBackdrop();
      if (this.bgSprite) {
        this.bgSprite.parent?.removeChild(this.bgSprite);
        try { this.bgSprite.destroy(); } catch { /* torn down */ }
        this.bgSprite = null;
      }
      this.bgTexture = null;
      if (this.backdropGraphic) this.backdropGraphic.visible = true;
    }
  }

  private clearBackgroundImage(): void {
    // Stop + free any animated background first (nulls bgTexture if it's a frame).
    this.stopBgAnim();
    // Tear down the frosted backdrop first — it references bgTexture.
    this.teardownReelBackdrop();
    if (this.bgSprite) {
      this.bgSprite.parent?.removeChild(this.bgSprite);
      try { this.bgSprite.destroy(); } catch { /* already torn down */ }
      this.bgSprite = null;
    }
    if (this.bgTexture) {
      try { this.bgTexture.destroy(true); } catch { /* already torn down */ }
      this.bgTexture = null;
    }
    // Restore the gradient "stage" backdrop now that the user bg is gone.
    if (this.backdropGraphic) this.backdropGraphic.visible = true;
  }

  /** Cover-fit the background sprite to the current renderer size. */
  private fitBackground(): void {
    if (!this.bgSprite || !this.bgTexture) return;
    const { width, height } = this.app.screen;
    this.bgSprite.position.set(width / 2, height / 2);
    const tw = this.bgTexture.width || 1;
    const th = this.bgTexture.height || 1;
    const scale = Math.max(width / tw, height / th);
    this.bgSprite.scale.set(scale);
    if (this.bgSpriteB) {
      // All anim frames share the sheet's frame size → same fit as the base.
      this.bgSpriteB.position.set(width / 2, height / 2);
      this.bgSpriteB.scale.set(scale);
    }
  }

  private teardownReelBackdrop(): void {
    // Only the frosted layer references bgTexture; the vignette + container are
    // static and persist for the life of the scene.
    if (this.reelFrosted) {
      this.reelFrosted.parent?.removeChild(this.reelFrosted);
      try { this.reelFrosted.destroy(); } catch { /* already torn down */ }
      this.reelFrosted = null;
    }
  }

  /** Redraw the frame: a FLAT band around the reel grid (Hacksaw-replica look).
   *  Inner edge = the reel window; the band extends frameWidth px OUTWARD.
   *  One colour + opacity + thickness — no bevels, no sheen. Hairline edges are
   *  filled rings (strokes flicker at non-integer scale). */
  private redrawFrame(): void {
    const rw = this.frameW, rh = this.frameH;
    if (!rw || !rh || !this.frameGraphic) return;
    const winX = FRAME_PAD, winY = FRAME_PAD;
    const winW = rw - FRAME_PAD * 2, winH = rh - FRAME_PAD * 2;
    const t = Math.max(0, this.frameWidth);
    const a = Math.max(0, Math.min(100, this.frameOpacity)) / 100;
    const base = hslToNum(this.frameHue, this.frameSat, this.frameLight);
    const edge = blendHex(base, 0x000000, 0.35);
    this.frameGraphic.clear();
    this.borderOuterGraphic.clear();
    this.borderInnerGraphic.clear();
    this.sheenGraphic.clear();
    if (t <= 0 || a <= 0) return;
    const oX = winX - t, oY = winY - t, oW = winW + t * 2, oH = winH + t * 2;
    // the band itself (hole-punched over the reel window)
    this.frameGraphic.roundRect(oX, oY, oW, oH, 12).fill({ color: base, alpha: a });
    this.frameGraphic.roundRect(winX, winY, winW, winH, 10).cut();
    // hairline definition: outer edge + inner (grid) edge
    this.borderOuterGraphic.roundRect(oX, oY, oW, oH, 12).fill({ color: edge, alpha: a });
    this.borderOuterGraphic.roundRect(oX + 1.5, oY + 1.5, oW - 3, oH - 3, 11).cut();
    this.borderInnerGraphic.roundRect(winX - 1.5, winY - 1.5, winW + 3, winH + 3, 11).fill({ color: edge, alpha: a });
    this.borderInnerGraphic.roundRect(winX, winY, winW, winH, 10).cut();
  }

  /** Redraw the reel-window tint from the current hue/sat/lightness/opacity.
   *  Cheap (one roundRect fill); called live from applyVisualParam. */
  private applyReelTint(): void {
    if (!this.reelTint || !this.reelSet) return;
    const color = hslToNum(this.reelBgHue, this.reelBgSat, this.reelBgLight);
    this.reelTint.clear();
    this.reelTint.roundRect(FRAME_PAD, FRAME_PAD, this.reelSet.totalWidth, this.reelSet.totalHeight, 10);
    this.reelTint.fill({ color, alpha: this.reelBgOpacity / 100 });
  }

  /** Build the frosted reel backdrop from the current background texture: a
   *  blurred + darkened copy cover-fit to the reel window, placed below the
   *  static vignette (so the vignette darkens its edges). No bg image → only
   *  the vignette shows over the dark frame fill. Geometry is fixed, so it
   *  scales with the scene and needs no resize rebuild. */
  private updateReelBackdrop(): void {
    this.teardownReelBackdrop();
    if (!this.bgTexture || !this.reelSet || this._aborted || !this.reelBackdropContainer) return;

    const innerW = this.reelSet.totalWidth;
    const innerH = this.reelSet.totalHeight;
    const tw = this.bgTexture.width || 1;
    const th = this.bgTexture.height || 1;

    const sprite = new Sprite(this.bgTexture);
    sprite.anchor.set(0.5);
    sprite.position.set(FRAME_PAD + innerW / 2, FRAME_PAD + innerH / 2);
    // Cover-fit the reel window, slightly overscanned so the blur doesn't pull
    // transparent edges into view.
    sprite.scale.set(Math.max(innerW / tw, innerH / th) * 1.18);
    // Darken via multiply tint so the symbols pop against it.
    sprite.tint = 0x40434f;
    sprite.filters = [new BlurFilter({ strength: 16, quality: 3 })];

    // Index 1 = just above the mask (0) and below the vignette — clipped by the
    // container's mask.
    this.reelBackdropContainer.addChildAt(sprite, 1);
    this.reelFrosted = sprite;
  }

  /**
   * Set audio callbacks fired by the reel layer (per-reel stop, scatter visible).
   * The React layer owns the SoundManager and wires it through here so the
   * Pixi layer stays I/O-free.
   */
  setAudioHooks(hooks: ReelSetAudioHooks): void {
    if (!this.reelSet) {
      // Init not finished yet; defer.
      this._pendingAudioHooks = hooks;
      return;
    }
    this.reelSet.audioHooks = hooks;
  }

  /** True only between init() completion and destroy(). Use as a precondition
   *  for every public method that touches the renderer or reelSet. */
  private get isLive(): boolean {
    return this._ready && !this._aborted && !!this.reelSet;
  }

  /** Bumped on every spin() to abort any in-flight sequential win reveal so it
   *  can't keep drawing frames over the next spin's reels. */
  private _winRevealId = 0;

  spin() {
    // Guard: caller may invoke before init() finishes or after destroy().
    // Silent no-op is the safe answer — the React state machine handles
    // these edges via the disabled-while-!ready button + unmount cleanup.
    if (!this.isLive) return;
    this._winRevealId++; // cancel any in-flight win reveal from the prior spin
    gsap.killTweensOf(this.winBanner);
    gsap.killTweensOf(this.winBanner.scale);
    this.winBanner.visible = false;
    this.winBanner.alpha = 0;
    this.reelSet.clearHighlights();
    this.reelSet.startSpin();
  }

  /**
   * Resolves to the final board state. The returned promise settles as soon as
   * the *reels* have stopped — the win banner then plays asynchronously and is
   * interrupted by the next spin() call. This keeps the state machine free to
   * move to idle the moment the reels are done, instead of waiting ~1.4s for
   * the banner animation to finish.
   *
   * Re-checks `isLive` after every await so a mid-flight destroy() doesn't
   * push the in-flight resolve into a torn-down scene graph.
   */
  async resolve(outcome: SpinOutcome, tokenSymbol: string, decimals: number): Promise<void> {
    if (!this.isLive) return;
    // Sweep any FS overlay a previous resolve left open (the closing iris is
    // skipped when a run gets interrupted mid-round) — never leak the counter.
    if (this.fsOverlayOpen) {
      this.hideFreeSpinOverlay(this.fsOverlayOpen);
      this.fsOverlayOpen = null;
      this.exitFsBackground();
    }
    // Set while a free-spins round is up; closed by the exit iris at the end.
    let fsOverlayToClose: { container: Container; counter: Text } | null = null;
    if (outcome.freeSpinsTriggered && outcome.freeSpinsPlayed > 0 && !this.turbo && !prefersReducedMotion()) {
      // Straight into the iris — NO gold flash / shock-wave "sun" first. The live
      // board is pulled into a shrinking black circle, opens onto the intro
      // screen, then dismisses into the round. Counter shows AFTER the iris.
      await this.playFreeSpinsIris(outcome.freeSpinsPlayed);
      if (!this.isLive) return;
      const fsOverlay = this.showFreeSpinOverlay(outcome.freeSpinsPlayed);

      // Every free spin IS an expanding-wild reveal: money sacks land on 1–3
      // random reels and the towers race out (display-only — the settled
      // total stays outcome.winAmount). This is the round's core showcase.
      for (let i = 0; i < outcome.freeSpinsPlayed; i++) {
        if (!this.isLive) break;
        if (fsOverlay.counter) {
          fsOverlay.counter.text = `FREE SPIN ${i + 1} / ${outcome.freeSpinsPlayed}`;
        }
        await this.reelSet.playExpandingWildReveal({ isLive: () => this.isLive, turbo: this.turbo });
        if (!this.isLive) break;
        await new Promise(r => setTimeout(r, 350));
      }

      // The overlay + FS background stay up for the TOTAL-win ceremony; the
      // closing iris below restores the base screen (like the entry beat).
      fsOverlayToClose = fsOverlay;
      this.fsOverlayOpen = fsOverlay;
    } else {
      await this.reelSet.stopOnStops(outcome.stops, this.turbo);
    }

    if (!this.isLive) return;

    // Sticky-wild AAA treatment on the settled board's wilds (visual feature).
    this.reelSet.applyStickyWilds(outcome.board);

    // Hold & Win bonus — coins lock on the board and respins auto-run, before the
    // win ceremony tallies the payout. The round was derived deterministically
    // from the spin randomness (authoritative win is already in outcome.winAmount).
    if (outcome.holdWinTriggered && outcome.holdWin) {
      await this.reelSet.playHoldAndWin(outcome.holdWin, {
        accent: this.config.theme.accent,
        turbo: this.turbo,
        reduced: prefersReducedMotion(),
        isLive: () => this.isLive,
      });
      if (!this.isLive) return;
    }

    if (outcome.winAmount > 0n) {
      // Awaited: the spin HOLDS until the win ceremony (counting number + coins
      // flying from the winning symbols) finishes, like the reference game.
      await this.playWinSequence(outcome, tokenSymbol, decimals);
    }

    // Closing iris — bookends the free-spins round like the entry: the screen
    // pulls into the black circle, the FS overlay + background swap back
    // underneath, then it opens onto the normal base screen.
    if (this.isLive && fsOverlayToClose) {
      const overlay = fsOverlayToClose;
      await this.playExitIris(() => {
        this.hideFreeSpinOverlay(overlay);
        if (this.fsOverlayOpen === overlay) this.fsOverlayOpen = null;
        this.exitFsBackground();
      });
    }
  }

  /** Win presentation. With MULTIPLE winning patterns, cycle through them one
   *  at a time (alternately — each pattern's symbols + line + sub-amount in
   *  turn), then light all winners and play the grand-total coin ceremony.
   *  Single win / turbo / reduced-motion skip straight to the total. Awaited so
   *  the spin holds until it finishes. */
  private async playWinSequence(
    outcome: SpinOutcome,
    symbol: string,
    decimals: number,
  ): Promise<void> {
    const id = ++this._winRevealId;
    const combos = outcome.winResult.combinations.filter(c => c.winAmount > 0n);
    const multi = combos.length > 1 && !this.turbo && !prefersReducedMotion();
    const ordered = multi
      ? [...combos].sort((a, b) =>
          a.winAmount < b.winAmount ? -1 : a.winAmount > b.winAmount ? 1 : 0,
        )
      : [];

    // 1. Tally: alternate through each winning pattern once, smallest→largest,
    //    floating its sub-amount.
    if (multi) {
      const stepMs = ordered.length > 5 ? 380 : 600;
      for (let i = 0; i < ordered.length; i++) {
        if (id !== this._winRevealId || !this.isLive) return; // aborted by next spin
        this.reelSet.revealCombo(ordered[i], '+' + formatWin(ordered[i].winAmount, decimals));
        this.reelSet.audioHooks.onWinStep?.(i, ordered.length);
        await new Promise(r => setTimeout(r, stepMs));
      }
      if (id !== this._winRevealId || !this.isLive) return;
    }

    // 2. Finale: every winner lit + the grand-total coin ceremony (awaited → the
    //    next spin holds until it finishes).
    this.reelSet.highlightWins(outcome.winResult);
    if (id !== this._winRevealId || !this.isLive) return;
    const origins = this.reelSet.getWinningCellCenters(outcome.winResult);
    await this.playCoinWin(outcome.winAmount, outcome.wager ?? 1n, symbol, decimals, origins);
    if (id !== this._winRevealId || !this.isLive) return;

    // 3. Resting display: keep cycling the patterns one at a time (alternating)
    //    AFTER the total has shown, until the next spin. Fire-and-forget so the
    //    state machine stays free; spin() bumps _winRevealId to stop the loop.
    if (multi) void this.cyclePatternsLoop(ordered, id);
  }

  /** After the grand total is shown, loop the winning patterns one at a time
   *  (the alternating "show each win" continues as the resting display) until a
   *  new spin bumps _winRevealId. No floating amounts — just cycling highlights. */
  private async cyclePatternsLoop(
    ordered: SpinOutcome['winResult']['combinations'],
    id: number,
  ): Promise<void> {
    while (id === this._winRevealId && this.isLive) {
      for (const combo of ordered) {
        if (id !== this._winRevealId || !this.isLive) return;
        this.reelSet.revealCombo(combo); // resting loop: highlight only, no +amount
        await new Promise(r => setTimeout(r, 800));
      }
    }
  }

  /** Free-spins entry: the live board is sucked into a shrinking BLACK circle
   *  (iris close), then the black circle irises back OPEN onto a free-spins
   *  INTRO SCREEN, which holds a beat and dismisses into the round. Kept
   *  deliberately PLAIN — no sparkles/rings/rays; the real intro art is a
   *  separate build ("our own variant"). Screen-space overlay on app.stage
   *  (immune to sceneRoot letterbox scaling). The black hole is punched with the
   *  Pixi-v8 .cut() op (NOT even-odd fill, which unions in v8) against an
   *  OVERSIZED field rect so the cut is always fully contained. Awaited: the
   *  caller holds until the intro is dismissed. */
  private playFreeSpinsIris(count: number): Promise<void> {
    if (!this.isLive) return Promise.resolve();

    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const cx = sw / 2;
    const cy = sh / 2;
    // Half-diagonal covers all four corners on any aspect ratio.
    const rDiag = 0.5 * Math.sqrt(sw * sw + sh * sh);
    // Oversized field so the .cut() circle is ALWAYS fully contained even at
    // r = rDiag (v8 cut() fails if the hole isn't completely inside the shape).
    const outer = rDiag * 2.4;
    const ox = cx - outer / 2;
    const oy = cy - outer / 2;

    // Overlay: LAST child of app.stage => top of draw order, SCREEN pixels.
    const overlay = new Container();
    overlay.zIndex = 10000;
    overlay.eventMode = 'none';
    this.irisOverlay = overlay;

    // ── Free-spins INTRO SCREEN (revealed as the black iris opens). Uses the
    //    custom Vice "BONUS" art if loaded (setFreeSpinsIntroImage), else a plain
    //    placeholder. Sits BELOW the iris field so the opening hole reveals it. ─
    const intro = new Container();
    intro.alpha = 0;
    const introBg = new Graphics();
    introBg.rect(0, 0, sw, sh).fill({ color: 0x050509, alpha: 1 }); // dark screen behind the art
    intro.addChild(introBg);

    const introContent = new Container();
    introContent.position.set(cx, cy);
    let introArt: Sprite | null = null;
    if (this.fsIntroTexture) {
      const tex = this.fsIntroTexture;
      const k = Math.min(sw / tex.width, sh / tex.height) * 0.98; // contain-fit
      introArt = new Sprite(tex);
      introArt.anchor.set(0.5);
      introArt.scale.set(k);
      introContent.addChild(introArt);
      const u = Math.min(sw, sh);
      // "FREE SPINS / N SPINS" over the empty purple panel (image-fraction).
      const px = (0.485 - 0.5) * tex.width * k;
      const py = (0.685 - 0.5) * tex.height * k;
      const t1 = new Text({ text: 'FREE SPINS', style: new TextStyle({
        fontFamily: "'Poppins', ui-sans-serif, sans-serif", fontSize: Math.round(u * 0.05), fontWeight: '800',
        fontStyle: 'italic', fill: 0xffffff, letterSpacing: 3,
        dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.6 },
      }) });
      t1.anchor.set(0.5); t1.position.set(px, py - u * 0.03);
      const t2 = new Text({ text: `${count} SPINS`, style: new TextStyle({
        fontFamily: "'Rubik', ui-sans-serif, sans-serif", fontSize: Math.round(u * 0.045), fontWeight: '800',
        fill: 0xffffff, letterSpacing: 2,
        dropShadow: { color: 0x000000, blur: 4, distance: 2, alpha: 0.6 },
      }) });
      t2.anchor.set(0.5); t2.position.set(px, py + u * 0.03);
      introContent.addChild(t1, t2);
    } else {
      const fsTitle = new Text({ text: 'FREE SPINS', style: new TextStyle({
        fontFamily: "'Poppins', ui-sans-serif, sans-serif", fontSize: 54, fontWeight: '800',
        fontStyle: 'italic', fill: 0xffffff, letterSpacing: 4,
      }) });
      fsTitle.anchor.set(0.5); fsTitle.y = -20;
      const fsCount = new Text({ text: `${count} FREE SPINS`, style: new TextStyle({
        fontFamily: "'Rubik', ui-sans-serif, sans-serif", fontSize: 24, fontWeight: '700',
        fill: 0xFFD23F, letterSpacing: 2,
      }) });
      fsCount.anchor.set(0.5); fsCount.y = 30;
      introContent.addChild(fsTitle, fsCount);
    }
    introContent.scale.set(0.9);
    intro.addChild(introContent);
    overlay.addChild(intro);

    const iris = new Graphics(); // black field with the animated circular hole
    overlay.addChild(iris);

    this.app.stage.addChild(overlay); // appended last => renders above sceneRoot

    // Single state proxy => one gsap.killTweensOf target for teardown.
    const st = { r: rDiag, tint: 0 };
    this.irisState = st;

    const redraw = () => {
      if (!this.isLive) return; // never draw into a torn-down GraphicsContext
      const r = Math.max(0, st.r);
      // Black field with the circular hole punched via .cut() (v8-correct).
      iris.clear();
      iris.rect(ox, oy, outer, outer);
      iris.fill({ color: 0x000000, alpha: st.tint });
      if (r > 0.5) { iris.circle(cx, cy, r); iris.cut(); }
    };

    redraw();

    return new Promise<void>((resolve) => {
      const finish = () => {
        gsap.killTweensOf(st);
        gsap.killTweensOf(overlay);
        gsap.killTweensOf(introContent); gsap.killTweensOf(introContent.scale);
        if (this.irisTl === tl) this.irisTl = null;
        if (this.irisState === st) this.irisState = null;
        if (this.irisOverlay === overlay) this.irisOverlay = null;
        this.irisResolve = null;
        try { overlay.destroy({ children: true }); } catch { /* already torn down */ }
        resolve();
      };

      const tl = gsap.timeline({ onComplete: finish });
      this.irisTl = tl;
      // destroy() can resolve this (kill() never fires onComplete) — resolve is
      // idempotent, so a later finish()/destroy() call is harmless.
      this.irisResolve = () => resolve();

      // CLOSE (0.00 -> 0.70): the live board is slowly pulled into a shrinking
      // black circle — power3.in accelerates the collapse for a "suck-in" feel.
      tl.to(st, { r: 0, tint: 1, duration: 0.70, ease: 'power3.in', onUpdate: redraw }, 0);
      // FULL-BLACK BEAT: the screen is entirely covered — swap in the
      // free-spins-only background here so the change is never visible.
      tl.call(() => this.enterFsBackground(), undefined, 0.72);
      // Brief full-black beat, then arm the intro behind the field (still hidden).
      tl.set(intro, { alpha: 1 }, 0.74);
      // OPEN (0.82 -> 1.42): the black circle irises back open onto the intro screen.
      tl.to(st, { r: rDiag, tint: 0, duration: 0.60, ease: 'power2.out', onUpdate: redraw }, 0.82);
      tl.fromTo(introContent.scale, { x: 0.86, y: 0.86 }, { x: 1, y: 1, duration: 0.55, ease: 'power2.out' }, 0.84);
      // Gentle "breeze" sway on the board art while the intro holds (a taste of
      // Miami motion; true per-palm sway needs the palms as separate PNGs).
      if (introArt) {
        tl.to(introArt, { rotation: 0.012, duration: 0.9, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 1.0);
      }
      // HOLD on the intro (~1.3s), then DISMISS (2.7 -> 3.2): fade out into the round.
      tl.to(overlay, { alpha: 0, duration: 0.50, ease: 'power2.inOut' }, 2.70);
    });
  }

  /** Themed celebration banner drawn behind the count-up number for big+ wins:
   *  a gold-trimmed plaque tinted to the theme accent; mega adds a light-ray
   *  burst. Lives in winBanner (z: above dim/coins, below the number). */
  private buildWinBanner(isMega: boolean): void {
    const b = this.winBanner;
    gsap.killTweensOf(b.children);
    gsap.killTweensOf(b);
    gsap.killTweensOf(b.scale);
    for (const c of b.removeChildren()) c.destroy({ children: true });

    const accent = this.config.theme.accent;
    const gold = this.winBannerColorOverride ?? 0xFFD23F;
    const w = isMega ? 480 : 380;
    const h = isMega ? 170 : 132;
    const r = 22;

    // Mega: light-ray burst behind the plaque (scales in with the banner).
    if (isMega) {
      const rays = new Graphics();
      const R = Math.max(w, h) * 1.6;
      const n = 20;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = a0 + (Math.PI * 2 / n) * 0.5;
        rays.moveTo(0, 0);
        rays.lineTo(Math.cos(a0) * R, Math.sin(a0) * R);
        rays.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
        rays.closePath();
      }
      rays.fill({ color: gold, alpha: 0.12 });
      b.addChild(rays);
    }

    const plaque = new Graphics();
    // soft outer glow
    for (let i = 4; i >= 1; i--) {
      plaque.roundRect(-w / 2 - i * 4, -h / 2 - i * 4, w + i * 8, h + i * 8, r + i * 3);
      plaque.fill({ color: gold, alpha: 0.05 });
    }
    // base body (deep) → top-lit upper half → bottom shaded band = vertical
    // gradient with real depth.
    plaque.roundRect(-w / 2, -h / 2, w, h, r);
    plaque.fill({ color: blendHex(accent, 0x000000, 0.55) });
    plaque.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, (h - 8) * 0.5, r - 2);
    plaque.fill({ color: blendHex(accent, 0xffffff, 0.16), alpha: 0.6 });
    plaque.roundRect(-w / 2 + 4, h * 0.10, w - 8, (h - 8) * 0.4, r - 2);
    plaque.fill({ color: blendHex(accent, 0x000000, 0.35), alpha: 0.5 });
    // gold border + inner highlight rim
    plaque.roundRect(-w / 2, -h / 2, w, h, r);
    plaque.stroke({ color: gold, width: isMega ? 4 : 3, alpha: 0.95 });
    plaque.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, r - 4);
    plaque.stroke({ color: blendHex(gold, 0xffffff, 0.4), width: 1.5, alpha: 0.55 });
    // corner studs (gold hardware with a specular dot) → premium plaque detail.
    const sx = w / 2 - 12, sy = h / 2 - 12;
    for (const [dx, dy] of [[-sx, -sy], [sx, -sy], [-sx, sy], [sx, sy]] as Array<[number, number]>) {
      plaque.circle(dx, dy, 3.2).fill({ color: gold, alpha: 0.95 });
      plaque.circle(dx - 0.8, dy - 0.8, 1.1).fill({ color: 0xFFFFFF, alpha: 0.6 });
    }
    b.addChild(plaque);
  }

  private playCoinWin(
    winAmount: bigint,
    wager: bigint,
    symbol: string,
    decimals: number,
    originsLocal: Array<{ x: number; y: number }>,
  ): Promise<void> {
    if (!this.isLive || !this.winCelebration) return Promise.resolve();

    // Marquee tier: BIG → MEGA → EPIC by win/wager multiplier; MAX only when
    // the win hit the game's max-win cap. Below minBigWin the marquee doesn't
    // play at all (small wins stay on-board). Decoupled from the audio tiers.
    const r = wager > 0n ? Number(winAmount) / Number(wager) : Number(winAmount);
    const C = WIN_CELEBRATION_CONFIG;
    const capX = this.config.maxWinMultiplier;
    const isMax = capX > 0 && r >= capX * 0.999;
    if (!isMax && r < C.minBigWin) return Promise.resolve();
    const tier = isMax ? 3 : r >= C.bands.epic ? 2 : r >= C.bands.mega ? 1 : 0;

    // Screen-space centre + coin origins (real winning cells → global coords),
    // since the celebration overlay lives on app.stage (screen pixels).
    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    const rh = this.reelSet.totalHeight + FRAME_PAD * 2;
    const centre = this.sceneRoot.toGlobal({ x: rw / 2, y: HEADER_H + rh / 2 });
    const originPts = originsLocal.length
      ? originsLocal.map(o => this.sceneRoot.toGlobal({ x: FRAME_PAD + o.x, y: HEADER_H + FRAME_PAD + o.y }))
      : [this.sceneRoot.toGlobal({ x: rw / 2, y: HEADER_H + rh / 2 })];

    // Slot-frame bounds in screen coords — the coin fountain stays inside the
    // slot (coins start at the frame's bottom edge, not under the control bar).
    const tl = this.sceneRoot.toGlobal({ x: 0, y: 0 });
    const br = this.sceneRoot.toGlobal({ x: rw, y: HEADER_H + rh });

    return this.winCelebration.play({
      winAmount, wager, symbol, decimals, tier,
      centre: { x: centre.x, y: centre.y },
      origins: originPts.map(pt => ({ x: pt.x, y: pt.y })),
      bounds: { left: tl.x, right: br.x, bottom: br.y },
      reduced: prefersReducedMotion(),
    });
  }

  /** Gold coins launched from given origins (celebrationFx coords), flying
   *  upward with an arc + spin, fading near the end. Cosmetic randomness only. */
  private spawnCoinsFrom(origins: Array<{ x: number; y: number }>, perOrigin: number, power: number): void {
    const colors = this.winCoinColors;
    for (const o of origins) {
      for (let i = 0; i < perOrigin; i++) {
        const coin = new Graphics();
        const r = 7 + Math.random() * 5;
        coin.ellipse(0, 0, r, r);
        coin.fill({ color: colors[i % colors.length] });
        coin.ellipse(-r * 0.25, -r * 0.3, r * 0.4, r * 0.55);
        coin.fill({ color: 0xFFFFFF, alpha: 0.55 });
        coin.x = o.x;
        coin.y = o.y;
        this.celebrationFx.addChild(coin);

        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.1; // upward + spread
        const speed = power * (0.65 + Math.random() * 0.7);
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const gravity = 760;
        const lifetime = 0.85 + Math.random() * 0.5;
        const state = { t: 0 };
        this.fxStateTargets.push(state);
        gsap.to(state, {
          t: lifetime,
          duration: lifetime,
          ease: 'none',
          onUpdate: () => {
            if (this._aborted) return;
            coin.x = o.x + vx * state.t;
            coin.y = o.y + vy * state.t + 0.5 * gravity * state.t * state.t;
            coin.scale.x = Math.abs(Math.cos(state.t * 11)) * 0.85 + 0.15; // spin/flip
          },
        });
        gsap.to(coin, { alpha: 0, duration: lifetime * 0.4, delay: lifetime * 0.6, ease: 'power1.in' });
      }
    }
  }

  // Force a renderer resize to match the canvas's parent element. Pixi's own
  // `resizeTo` uses a ResizeObserver, which only fires when the observed
  // element's size *changes* — so if the parent renders at its final size
  // before init runs, the observer never fires and the renderer stays at the
  // default 300×150 backing buffer. Call this after init and on every layout
  // change to keep the buffer in sync. Safe to call before init (no-op).
  public resize(): void {
    if (!this._ready) return;
    const parent = this.app.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w <= 0 || h <= 0) return;
    this.app.renderer.resize(w, h);
  }

  /** Apply a whitelisted visual param live — the chat-config apply path. The
   *  NL parser maps a prompt → (id, value) from ADJUSTABLE_PARAMS, then calls
   *  this. Only declared params take effect; unknown ids are ignored. */
  /** Wire click-to-edit: fires with the tapped board symbol's id (delegated to
   *  ReelSet, which owns the board geometry). Pass undefined to disable. */
  public setSymbolPickHandler(cb?: (symbolId: number) => void): void {
    this.reelSet?.setSymbolPickHandler(cb);
  }

  public applyVisualParam(id: string, value: string | number | boolean): void {
    if (!this.isLive) return;
    switch (id) {
      case 'winLineColor': {
        const preset = WIN_LINE_PRESETS[String(value)];
        if (preset) this.reelSet.setWinColors(preset.line, preset.frame);
        break;
      }
      case 'winCoinColor': {
        const preset = WIN_COIN_PRESETS[String(value)];
        if (preset) this.winCoinColors = preset.colors;
        break;
      }
      case 'ambientMotes': {
        this.setAmbientEnabled(String(value) !== 'off');
        break;
      }
      case 'reelBgColor': {
        // A picked colour also updates the H/S/L state, so the sliders and the
        // picker always agree (the studio mirrors this on its side too).
        const { h, s, l } = numToHsl(hexToNum(String(value)));
        this.reelBgHue = h; this.reelBgSat = s; this.reelBgLight = l;
        this.applyReelTint();
        break;
      }
      case 'reelBgHue': { this.reelBgHue = Number(value); this.applyReelTint(); break; }
      case 'reelBgSaturation': { this.reelBgSat = Number(value); this.applyReelTint(); break; }
      case 'reelBgLightness': { this.reelBgLight = Number(value); this.applyReelTint(); break; }
      case 'reelBgOpacity': { this.reelBgOpacity = Number(value); this.applyReelTint(); break; }
      case 'frameColor': {
        const { h, s, l } = numToHsl(hexToNum(String(value)));
        this.frameHue = h; this.frameSat = s; this.frameLight = l; this.redrawFrame();
        break;
      }
      case 'frameHue': { this.frameHue = Number(value); this.redrawFrame(); break; }
      case 'frameSaturation': { this.frameSat = Number(value); this.redrawFrame(); break; }
      case 'frameLightness': { this.frameLight = Number(value); this.redrawFrame(); break; }
      case 'frameOpacity': { this.frameOpacity = Number(value); this.redrawFrame(); break; }
      case 'frameWidth': { this.frameWidth = Number(value); this.redrawFrame(); break; }
      case 'cellBgColor':
      case 'cellBgHue':
      case 'cellBgSaturation':
      case 'cellBgLightness':
      case 'cellBgOpacity':
      case 'cellBgRadius':
      case 'cellBgInset':
      case 'cellBgBorderColor':
      case 'cellBgBorderWidth': {
        this.reelSet.setCellBackdropParam(id, value as string | number);
        break;
      }
      case 'reelSpeed': {
        const v = String(value);
        const mul = v === 'snappy' ? 1.7 : v === 'relaxed' ? 0.6 : 1.0;
        this.reelSet.setReelSpeed(mul);
        break;
      }
      case 'backgroundMood': {
        const v = String(value);
        this.setAmbientIntensity(v === 'vivid' ? 1.6 : v === 'subtle' ? 0.5 : 1.0);
        break;
      }
      case 'titleColor': {
        const preset = ACCENT_PRESETS[String(value)];
        if (preset) { this.titleColorOverride = preset.color; this.styleTitle(); }
        break;
      }
      case 'winBannerColor': {
        const preset = ACCENT_PRESETS[String(value)];
        if (preset) this.winBannerColorOverride = preset.color; // applied on the next win
        break;
      }
      case 'waysLight': {
        waysLightConfig.enabled = String(value) !== 'off';
        break;
      }
      case 'waysLightColor': {
        const preset = WAYS_LIGHT_PRESETS[String(value)];
        if (preset) waysLightConfig.color = preset.color;
        break;
      }
      case 'waysLightSpeed': {
        waysLightConfig.stepMs = WAYS_LIGHT_SPEED_MS[String(value)] ?? waysLightConfig.stepMs;
        break;
      }
      case 'waysLightWidth': {
        waysLightConfig.width = WAYS_LIGHT_WIDTH_PX[String(value)] ?? waysLightConfig.width;
        break;
      }
      case 'stickyWild': {
        stickyWildConfig.enabled = String(value) !== 'off';
        if (stickyWildConfig.enabled) this.reelSet.refreshStickyWilds();
        else this.reelSet.clearStickyWilds();
        break;
      }
      case 'stickyWildColor': {
        const preset = STICKY_WILD_PRESETS[String(value)];
        if (preset) { stickyWildConfig.borderColor = preset.color; this.reelSet.refreshStickyWilds(); }
        break;
      }
      case 'stickyWildSpeed': {
        stickyWildConfig.speedMs = STICKY_WILD_SPEED_MS[String(value)] ?? stickyWildConfig.speedMs;
        this.reelSet.refreshStickyWilds();
        break;
      }
      case 'symbolSize': {
        // Preview preset: scale every symbol's object bigger/smaller in its
        // cell. Re-draws all tiles so the new size takes effect immediately.
        symbolSizing.objectScale = SYMBOL_SIZE_PRESETS[String(value)] ?? symbolSizing.objectScale;
        this.reelSet.refreshAllTiles();
        this.reelSet.refreshStickyWilds();
        break;
      }
      default:
        break;
    }
  }

  // Test-only: fire the win ceremony directly. Used by the dev harness
  // (`src/dev/WinTierTestPanel.tsx`) so QA can verify each tier without having
  // to land a real spin in that band. Production wins go through resolve().
  public __testWin(
    winAmount: bigint,
    symbol: string,
    decimals: number,
    _label: string,
    wager: bigint,
  ): void {
    // Dev harness: fire the coin-win ceremony (centre origins — no real board).
    void this.playCoinWin(winAmount, wager, symbol, decimals, []);
  }

  /** Test-only: reveal a synthetic full-board (5-of-a-kind) win on the current
   *  board — exercises the win-line + node dots, the 5-of-a-kind light sweep,
   *  symbol enlarge-pulse + rim-light, and the count-up + coin ceremony. */
  public __testLineWin(symbol: string, decimals: number, wager: bigint): void {
    if (!this.isLive) return;
    const reelCount = this.config.reelLengths.length;
    const cells: [number, number][] = [];
    for (let r = 0; r < reelCount; r++) cells.push([1, r]);
    const winAmount = wager * 25n;
    const outcome: SpinOutcome = {
      stops: this.config.reelLengths.map(() => 0),
      board: [],
      winAmount,
      wager,
      scatterCount: 0,
      freeSpinsTriggered: false,
      freeSpinsPlayed: 0,
      holdWinTriggered: false,
      holdWinWin: 0n,
      holdWin: null,
      winResult: {
        totalWin: winAmount,
        combinations: [{ symbolId: 2, matchCount: reelCount, ways: 1, payBps: 0, winAmount, cells }],
        scatterCount: 0,
        scatterPaid: false,
      },
    };
    void this.playWinSequence(outcome, symbol, decimals);
  }

  /** Test-only: roll REAL engine outcomes (real reel strips + the dev's ways
   *  WinEvaluator / paytable / RTP) until a genuine ways win lands — preferring
   *  one with a fan (a reel carrying 2+ winning cells) so the connection reads
   *  clearly — then spin and reveal that real outcome. Nothing is forced/faked;
   *  the symbols on the board are the actual ways win. */
  public __testWaysWin(_symbol: string, _decimals: number, wager: bigint): void {
    if (!this.isLive) return;
    let best: { stops: number[]; winResult: WinResult } | null = null;
    let fan: { stops: number[]; winResult: WinResult } | null = null;
    for (let i = 0; i < 1500 && !fan; i++) {
      const stops = deriveStopsFromRandomness(randomBytes32());
      const board = buildBoard(stops);
      const winResult = evaluateWins(board, wager, this.config);
      for (const c of winResult.combinations) {
        if (c.winAmount <= 0n) continue;
        const perReel = new Map<number, number>();
        for (const [, reel] of c.cells) perReel.set(reel, (perReel.get(reel) ?? 0) + 1);
        if (perReel.size < 2) continue; // needs a real cross-reel connection
        best ??= { stops, winResult };
        if ([...perReel.values()].some(n => n >= 2)) { fan = { stops, winResult }; break; }
      }
    }
    const chosen = fan ?? best;
    if (!chosen) return; // no ways win found (astronomically unlikely)
    this.reelSet.startSpin();
    void (async () => {
      await new Promise(r => setTimeout(r, 450));
      if (!this.isLive) return;
      await this.reelSet.stopOnStops(chosen.stops, false);
      if (!this.isLive) return;
      this.reelSet.highlightWins(chosen.winResult);
    })();
  }

  /** Test-only: run the full free-spins presentation — entry card ("FREE SPINS
   *  ×N"), per-spin replay, win ceremony, and exit card ("FREE SPINS TOTAL"). */
  public __testFreeSpins(symbol: string, decimals: number, wager: bigint, count = 8): void {
    if (!this.isLive) return;
    const reelCount = this.config.reelLengths.length;
    const cells: [number, number][] = [];
    for (let r = 0; r < reelCount; r++) cells.push([1, r]);
    const winAmount = wager * 30n;
    const outcome: SpinOutcome = {
      stops: this.config.reelLengths.map(() => 0),
      board: [],
      winAmount,
      wager,
      scatterCount: 3,
      freeSpinsTriggered: true,
      freeSpinsPlayed: count,
      holdWinTriggered: false,
      holdWinWin: 0n,
      holdWin: null,
      winResult: {
        totalWin: winAmount,
        combinations: [{ symbolId: 2, matchCount: reelCount, ways: 1, payBps: 0, winAmount, cells }],
        scatterCount: 0,
        scatterPaid: false,
      },
    };
    void this.resolve(outcome, symbol, decimals);
  }

  /** Test-only: play a Hold & Win round on the board with a synthetic set of
   *  trigger coins, so the debug panel can preview the lock/respin/collect
   *  presentation regardless of whether the current reels carry coin symbols. */
  public __testHoldAndWin(): void {
    if (!this.isLive) return;
    const size = this.grid.reelCount * this.grid.visibleRows;
    const want = Math.min(Math.max(HW_TRIGGER_MIN, 6), size);
    const idxs: number[] = [];
    while (idxs.length < want) {
      const i = Math.floor(Math.random() * size);
      if (!idxs.includes(i)) idxs.push(i);
    }
    const rb = crypto.getRandomValues(new Uint8Array(32));
    let seed = 0n;
    for (const b of rb) seed = (seed << 8n) | BigInt(b);
    const round = playDeterministicHoldAndWin(seed, idxs, size);
    void this.reelSet.playHoldAndWin(round, {
      accent: this.config.theme.accent,
      turbo: this.turbo,
      reduced: prefersReducedMotion(),
      isLive: () => this.isLive,
    });
  }

  /** Test-only: OUR sticky-wild showcase reveal. Honours the dev's `sticky-wild`
   *  rule ("wilds remain in place") as a purely visual treatment — dims the
   *  board, pops 3–25 wilds criss-cross one-by-one with the AAA shine while the
   *  reels roll, then leaves them stuck. Never rewrites the board or the math. */
  public __testStickyWildReveal(): void {
    if (!this.isLive) return;
    void this.reelSet.playStickyWildReveal({ isLive: () => this.isLive, turbo: this.turbo });
  }

  /** Load the expanding-wild column art (the Vice money tower). Pass null to
   *  clear (the effect then falls back to a flat panel). */
  async setExpandingWildImage(url: string | null): Promise<void> {
    if (!this._initialized || this._aborted) return;
    if (!url) { this.reelSet?.setExpandingWildTexture(null); return; }
    try {
      const tex = await Assets.load<Texture>(url);
      if (!this._aborted) this.reelSet.setExpandingWildTexture(tex);
    } catch (err) {
      console.warn('[PixiApp] failed to load expanding wild image:', err);
    }
  }

  /** Test-only: OUR expanding-wild showcase (Gift-Bonanza choreography on the
   *  Vice money tower) — wild lands on 1–2 random reels, clear-beat, column
   *  races out of the landing cell, locks in with the AAA shine. Visual only. */
  public __testExpandingWild(): void {
    if (!this.isLive) return;
    void this.reelSet.playExpandingWildReveal({ isLive: () => this.isLive, turbo: this.turbo });
  }

  /** Test-only: play a symbol's WIN animation on the board. Every cell showing
   *  the symbol enters the 'win' state for ~3.5s (if none is visible, the
   *  centre cell is re-skinned to it, display-only). Exercises the win-sheet
   *  overlay exactly like a real connection. */
  public __testSymbolWin(symbolId: number): void {
    if (!this.isLive) return;
    const cells: AnimatedSymbol[] = [];
    const all: AnimatedSymbol[] = [];
    const walk = (n: Container) => {
      for (const c of n.children) {
        if (c instanceof AnimatedSymbol) {
          all.push(c);
          if (c.symbol === symbolId) cells.push(c);
        } else if (c instanceof Container) walk(c);
      }
    };
    walk(this.reelSet.container);
    if (cells.length === 0 && all.length > 0) {
      // No such symbol visible — re-skin a middle cell for the demo.
      const mid = all[Math.floor(all.length / 2)];
      mid.setSymbol(symbolId as Parameters<AnimatedSymbol['setSymbol']>[0]);
      cells.push(mid);
    }
    for (const c of cells) c.play('win');
    window.setTimeout(() => { for (const c of cells) { if (!c.destroyed) c.clearState(); } }, 3500);
  }

  /** Test-only: force a near-miss anticipation tease — lands a single scatter
   *  on reels 0 and 1 (2 total → no FS trigger), so the remaining reels
   *  decelerate dramatically. Exercises the anticipation slow-down + tease cue. */
  public __testNearMiss(): void {
    if (!this.isLive) return;
    const SCATTER = 1;
    const rows = this.grid.visibleRows;
    const strips = this.config.reelStrips;
    const lens = this.config.reelLengths;
    const visibleScatters = (reel: number, stop: number): number => {
      const strip = strips[reel];
      const len = lens[reel];
      let n = 0;
      for (let r = 0; r < rows; r++) if (strip[(stop + r) % len] === SCATTER) n++;
      return n;
    };
    const findStop = (reel: number, want: number): number => {
      const len = lens[reel];
      for (let s = 0; s < len; s++) if (visibleScatters(reel, s) === want) return s;
      return 0;
    };
    const stops = lens.map((_, r) => findStop(r, r < 2 ? 1 : 0));
    this.reelSet.startSpin();
    void (async () => {
      await new Promise(res => setTimeout(res, 400));
      if (this.isLive) await this.reelSet.stopOnStops(stops, false, true); // force tease — a demo must show it regardless of the per-game gate
    })();
  }

  /** Destroy and refresh the celebration FX container so sparks/coins/glow
   *  from a previous win don't leak into the next one. */
  private clearCelebrationFx(): void {
    // The AAA win celebration owns a SEPARATE app.stage overlay — settle it here
    // too (safe: play() re-cancels itself on start).
    this.winCelebration?.cancel();
    if (this.celebrationFx) {
      gsap.killTweensOf(this.celebrationFx.children);
      // Kill the off-graph spark-motion proxies too (not reachable via children).
      for (const target of this.fxStateTargets) gsap.killTweensOf(target);
      this.fxStateTargets.length = 0;
      this.celebrationFx.destroy({ children: true });
    }
    this.celebrationFx = new Container();
    // Re-insert just below the banner so banner stays on top.
    const bannerIndex = this.sceneRoot.children.indexOf(this.winBanner);
    if (bannerIndex >= 0) {
      this.sceneRoot.addChildAt(this.celebrationFx, bannerIndex);
    } else {
      this.sceneRoot.addChild(this.celebrationFx);
    }
  }

  /** Live toggle for the ambient mote layer (chat-config `ambientMotes`).
   *  Idempotent: tears down any existing layer first, then optionally respawns.
   *  Mirrors the ambient teardown in destroy(). */
  private setAmbientEnabled(on: boolean): void {
    this.motesEnabled = on;
    for (const tl of this.ambientTweens) tl.kill();
    this.ambientTweens.length = 0;
    if (this.ambientLayer) {
      try { this.ambientLayer.destroy({ children: true }); } catch { /* torn down */ }
      this.ambientLayer = null;
    }
    if (on && this.isLive) this.spawnAmbientMotes();
  }

  /** Ambient drifting "dust" motes over the reel area — subtle atmosphere so
   *  the idle board feels alive. Low count (~16) → GSAP-driven Graphics is the
   *  right tool (native ParticleContainer is for high-count bursts). Gated by
   *  reduced-motion; tweens tracked for teardown. */
  private spawnAmbientMotes(): void {
    if (!this.reelSet || prefersReducedMotion()) return;
    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    const rh = this.reelSet.totalHeight + FRAME_PAD * 2;
    const layer = new Container();
    layer.eventMode = 'none';
    this.ambientLayer = layer;
    this.gameContainer.addChild(layer);

    // Rising motes only when explicitly enabled (off by default). The glow
    // "breathe" below always runs so the stage isn't static.
    if (this.motesEnabled) {
      const tints = [0xFFE082, 0xFFFFFF, this.config.theme.accent];
      const count = 16;
      for (let i = 0; i < count; i++) {
        const m = new Graphics();
        const col = tints[i % tints.length];
        const baseR = 2 + (i % 3);
        for (let k = 4; k >= 1; k--) m.circle(0, 0, baseR * k * 0.7).fill({ color: col, alpha: 0.12 });
        m.alpha = 0;
        layer.addChild(m);
        this.animateMote(m, rw, rh, i);
      }
    }

    // Living background: a slow alpha breathe on the glow layers so the stage
    // isn't static behind the reels (tracked in ambientTweens for teardown).
    const breathe = gsap.timeline({ repeat: -1, yoyo: true });
    breathe.to(this.ambientGraphic, { alpha: 0.78, duration: 4.5, ease: 'sine.inOut' }, 0);
    breathe.to(this.ambient2Graphic, { alpha: 0.80, duration: 3.6, ease: 'sine.inOut' }, 0);
    this.ambientTweens.push(breathe);
  }

  /** One drifting mote: rises bottom→top with a gentle sway, fading in then
   *  out, looping forever with a per-mote offset. Display-only randomness via
   *  the index (no Math.random in any path). */
  private animateMote(m: Graphics, rw: number, rh: number, i: number): void {
    const startX = (i * 53) % rw;
    const dur = 7 + (i % 6);
    const sway = 14 + (i % 4) * 8;
    const tl = gsap.timeline({ repeat: -1, delay: (i % 9) * 0.6 });
    tl.set(m, { x: startX, y: rh + 20, alpha: 0 })
      .to(m, { alpha: 0.22, duration: dur * 0.3, ease: 'sine.in' }, 0)
      .to(m, { y: -20, duration: dur, ease: 'none' }, 0)
      .to(m, { x: startX + sway, duration: dur / 2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0)
      .to(m, { alpha: 0, duration: dur * 0.3, ease: 'sine.out' }, dur * 0.7);
    this.ambientTweens.push(tl);
  }

  /** A quick full-scene flash (mega-win peak / free-spins trigger). Lives in
   *  celebrationFx (above the reels), self-destructs, and is cleared with the
   *  rest of the celebration FX on the next spin / destroy. */
  private spawnFlash(color: number, maxAlpha: number, fadeSec: number): void {
    if (!this.reelSet || !this.isLive) return;
    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    const rh = this.reelSet.totalHeight + FRAME_PAD * 2;
    const totalH = HEADER_H + rh + FOOTER_H;
    const flash = new Graphics();
    flash.rect(-rw, -totalH, rw * 3, totalH * 3);
    flash.fill({ color, alpha: 1 });
    flash.alpha = 0;
    this.celebrationFx.addChild(flash);
    gsap.to(flash, {
      alpha: maxAlpha, duration: 0.06, ease: 'power2.out',
      onComplete: () => {
        gsap.to(flash, {
          alpha: 0, duration: fadeSec, ease: 'power2.in',
          onComplete: () => { try { flash.destroy(); } catch { /* torn down */ } },
        });
      },
    });
  }

  /** Concentric shock-wave rings expanding from the grid centre — punctuates
   *  the free-spins trigger (gridEffects: `fs-trigger-shock`). Centre-anchored
   *  because the triggering board isn't displayed at the trigger instant (the
   *  engine reveals the final board on the last free-spin step). Cosmetic;
   *  lives in celebrationFx and is cleared with the rest of the FX. */
  private spawnShockwave(): void {
    if (!this.reelSet || !this.isLive || prefersReducedMotion()) return;
    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    const rh = this.reelSet.totalHeight + FRAME_PAD * 2;
    const cx = FRAME_PAD + this.reelSet.totalWidth / 2;
    const cy = HEADER_H + FRAME_PAD + this.reelSet.totalHeight / 2;
    const maxR = Math.hypot(rw, rh) / 2;
    for (let k = 0; k < 3; k++) {
      const ring = new Graphics();
      ring.circle(0, 0, 1);
      ring.stroke({ color: 0xFFD23F, width: 3, alpha: 1 });
      ring.position.set(cx, cy);
      ring.alpha = 0;
      this.celebrationFx.addChild(ring);
      const state = { t: 0 };
      this.fxStateTargets.push(state);
      gsap.to(state, {
        t: 1,
        duration: 0.7,
        delay: k * 0.14,
        ease: 'power2.out',
        onUpdate: () => {
          if (this._aborted || ring.destroyed) return;
          ring.scale.set(Math.max(0.01, state.t * maxR));
          ring.alpha = state.t < 0.12 ? (state.t / 0.12) * 0.85 : 0.85 * (1 - (state.t - 0.12) / 0.88);
        },
        onComplete: () => { try { ring.destroy(); } catch { /* torn down */ } },
      });
    }
  }

  /** Jackpot punctuation (gridEffects: `jackpot-full-flash`) — a strong
   *  full-grid white flash plus a shower of golden sparkles, layered over the
   *  mega treatment for the top (epic) win tier only. Cosmetic, self-cleaning.
   *  Index-driven placement (no Math.random in any path). */
  private spawnJackpotFlash(): void {
    if (!this.reelSet || !this.isLive || prefersReducedMotion()) return;
    this.spawnFlash(0xFFFFFF, 0.7, 0.6);
    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    const rh = this.reelSet.totalHeight + FRAME_PAD * 2;
    const top = HEADER_H + FRAME_PAD;
    const colors = [0xFFD23F, 0xFFE082, 0xFFFFFF];
    const count = 36;
    for (let i = 0; i < count; i++) {
      const star = new Graphics();
      const r = 3 + (i % 4);
      star.star(0, 0, 5, r, r * 0.45);
      star.fill({ color: colors[i % colors.length] });
      const sx = FRAME_PAD + (i * 97) % rw;
      const sy = top + (i * 53) % Math.max(1, Math.floor(rh * 0.45));
      star.position.set(sx, sy);
      star.alpha = 0;
      this.celebrationFx.addChild(star);
      const state = { t: 0 };
      this.fxStateTargets.push(state);
      const fall = rh * (0.45 + (i % 5) * 0.1);
      const dur = 1.0 + (i % 5) * 0.18;
      gsap.to(state, {
        t: 1,
        duration: dur,
        delay: (i % 6) * 0.05,
        ease: 'power1.in',
        onUpdate: () => {
          if (this._aborted || star.destroyed) return;
          star.y = sy + state.t * fall;
          star.alpha = state.t < 0.1 ? state.t / 0.1 : Math.max(0, (1 - state.t) * 1.1);
          star.rotation = state.t * 6;
        },
        onComplete: () => { try { star.destroy(); } catch { /* torn down */ } },
      });
    }
  }

  /** Full-scene dim overlay that fades in at win start and out at exit.
   *  Drops everything behind the banner to ~35% brightness so the
   *  celebration reads against the reels. Sized to cover the reel + frame
   *  area generously — it lives in sceneRoot, so it shares the scene scale. */
  private spawnBackgroundDim(holdSeconds: number, maxAlpha = 0.55): void {
    if (!this.reelSet) return;
    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    const rh = this.reelSet.totalHeight + FRAME_PAD * 2;
    const totalH = HEADER_H + rh + FOOTER_H;

    const dim = new Graphics();
    // Drawn 2× the scene to overhang the edges even after shake offsets.
    dim.rect(-rw, -totalH, rw * 3, totalH * 3);
    dim.fill({ color: 0x000000, alpha: 1 });
    dim.alpha = 0;
    this.celebrationFx.addChild(dim);

    gsap.to(dim, { alpha: maxAlpha, duration: 0.3 });
    gsap.to(dim, {
      alpha: 0,
      duration: 0.4,
      delay: Math.max(holdSeconds - 0.4, 0.4),
    });
  }

  /** Center-anchored "punch" zoom on the whole scene — a quick scale-up that
   *  springs back, for big-win impact. The responsive sceneRoot carries a base
   *  scale + centering offset (see onResize), so we scale relative to that base
   *  AND re-derive the centering position at each keyframe; scaling naively
   *  would drift the scene toward a corner. A final onResize() restores exact
   *  layout in case the viewport changed mid-punch. */
  private addZoomPunch(tl: gsap.core.Timeline, atTime: number, factor: number): void {
    if (!this.reelSet) return;
    const { width, height } = this.app.screen;
    const totalW = this.reelSet.totalWidth + FRAME_PAD * 2;
    const totalH = HEADER_H + this.reelSet.totalHeight + FRAME_PAD * 2 + FOOTER_H;
    const base = this.sceneRoot.scale.x;
    const punched = base * factor;
    const xAt = (s: number) => Math.round((width - totalW * s) / 2);
    const yAt = (s: number) => Math.round((height - totalH * s) / 2);
    tl.to(this.sceneRoot.scale, { x: punched, y: punched, duration: 0.12, ease: 'power2.out' }, atTime)
      .to(this.sceneRoot, { x: xAt(punched), y: yAt(punched), duration: 0.12, ease: 'power2.out' }, atTime)
      .to(this.sceneRoot.scale, { x: base, y: base, duration: 0.55, ease: 'elastic.out(1, 0.55)' }, atTime + 0.12)
      .to(this.sceneRoot, { x: xAt(base), y: yAt(base), duration: 0.55, ease: 'elastic.out(1, 0.55)' }, atTime + 0.12)
      .call(() => { if (!this._aborted) this.onResize(); }, undefined, atTime + 0.72);
  }

  /** Show a free-spin visual overlay: tinted ambient glow shift + counter badge.
   *  Returns a handle so the caller can update the counter and hide it. */
  private showFreeSpinOverlay(totalSpins: number): { container: Container; counter: Text } {
    const rw = this.reelSet.totalWidth + FRAME_PAD * 2;
    const rh = this.reelSet.totalHeight + FRAME_PAD * 2;

    const fsContainer = new Container();
    this.sceneRoot.addChild(fsContainer);

    // (the old full-board aura ellipse is gone — it read as a giant circle
    // sitting over the animated FS background)

    // Counter — TOP-RIGHT, beside the slot frame (outside the grid's right
    // edge), so the board stays clean during the expanding-wild free spins.
    const counter = new Text({
      text: `FREE SPIN 1 / ${totalSpins}`,
      style: new TextStyle({
        fontFamily: "'Rubik', ui-sans-serif, system-ui, sans-serif",
        fontSize: 14,
        fontWeight: '700',
        fill: 0xFFD700,
        letterSpacing: 2,
        dropShadow: { color: 0x000000, blur: 4, distance: 0, alpha: 0.6 },
      }),
    });
    counter.anchor.set(0, 0);
    counter.x = rw + 12;
    counter.y = HEADER_H + 2;
    fsContainer.addChild(counter);

    // Animate in
    fsContainer.alpha = 0;
    gsap.to(fsContainer, { alpha: 1, duration: 0.3 });

    return { container: fsContainer, counter };
  }

  /** Iris OUT → midAction at full black → iris back IN. The same circle beat
   *  as the FS entry, used to bring the round back to the base screen. */
  private async playExitIris(midAction: () => void): Promise<void> {
    const { width, height } = this.app.screen;
    const g = new Graphics();
    g.eventMode = 'none';
    this.app.stage.addChild(g);
    const maxR = Math.hypot(width, height) / 2;
    const state = { r: maxR };
    const draw = () => {
      g.clear();
      g.rect(0, 0, width, height).fill(0x000000);
      if (state.r > 0.5) g.circle(width / 2, height / 2, state.r).cut();
    };
    draw();
    await new Promise<void>(res => { gsap.to(state, { r: 0, duration: 0.45, ease: 'power2.in', onUpdate: draw, onComplete: res }); });
    try { midAction(); } catch { /* keep the iris opening */ }
    await new Promise<void>(res => { gsap.to(state, { r: maxR, duration: 0.5, ease: 'power2.out', onUpdate: draw, onComplete: res }); });
    g.parent?.removeChild(g);
    g.destroy();
  }

  private hideFreeSpinOverlay(overlay: { container: Container; counter: Text }): void {
    gsap.killTweensOf(overlay.container.children);
    gsap.to(overlay.container, {
      alpha: 0,
      duration: 0.4,
      onComplete: () => {
        overlay.container.destroy({ children: true });
      },
    });
  }

  snapToOutcome(outcome: SpinOutcome) {
    if (!this.isLive) return;
    this.reelSet.snapToStops(outcome.stops);
    this.reelSet.applyStickyWilds(outcome.board);
    if (outcome.winAmount > 0n) {
      this.reelSet.highlightWins(outcome.winResult);
    }
  }

  skip() {
    if (!this.isLive) return;
    this.reelSet.skipSpin();
  }

  destroy() {
    this._aborted = true;
    this._ready = false;

    // Kill outstanding banner / win-number tweens before tearing the stage down.
    gsap.killTweensOf(this.winBanner);
    gsap.killTweensOf(this.winBanner.scale);
    gsap.killTweensOf(this.winNumberText);
    gsap.killTweensOf(this.winNumberText.scale);
    gsap.killTweensOf(this.sceneRoot);

    // Kill any in-flight celebration FX tweens — including the off-graph
    // spark-motion proxies — so nothing keeps ticking against the destroyed
    // scene graph after app.destroy().
    if (this.celebrationFx) gsap.killTweensOf(this.celebrationFx.children);
    for (const target of this.fxStateTargets) gsap.killTweensOf(target);
    this.fxStateTargets.length = 0;

    // Kill an in-flight transition card (FREE SPINS entry/exit) before teardown.
    if (this.transitionCardTl) { this.transitionCardTl.kill(); this.transitionCardTl = null; }
    if (this.transitionCard) {
      gsap.killTweensOf(this.transitionCard);
      gsap.killTweensOf(this.transitionCard.scale);
      try { this.transitionCard.destroy({ children: true }); } catch { /* already torn down */ }
      this.transitionCard = null;
    }

    // Kill an in-flight free-spins iris (timeline + off-graph state proxy + overlay).
    if (this.irisTl) { this.irisTl.kill(); this.irisTl = null; }
    if (this.irisState) { gsap.killTweensOf(this.irisState); this.irisState = null; }
    if (this.irisOverlay) {
      gsap.killTweensOf(this.irisOverlay);
      gsap.killTweensOf(this.irisOverlay.children);
      try { this.irisOverlay.destroy({ children: true }); } catch { /* already torn down */ }
      this.irisOverlay = null;
    }
    // kill() above never fires the timeline's onComplete, so settle the awaited
    // iris Promise here — otherwise resolve() would await it forever.
    if (this.irisResolve) { this.irisResolve(); this.irisResolve = null; }

    // Tear down the win celebration (its overlay/ticker/coin texture live on
    // app.stage + the renderer, outside the sceneRoot teardown).
    if (this.winCelebration) { this.winCelebration.dispose(); this.winCelebration = null; }

    // Stop the ambient mote loops + drop the layer.
    for (const tl of this.ambientTweens) tl.kill();
    this.ambientTweens.length = 0;
    if (this.ambientLayer) {
      try { this.ambientLayer.destroy({ children: true }); } catch { /* already torn down */ }
      this.ambientLayer = null;
    }

    // If reelSet was constructed, dispose its tweens + cancel pending
    // callbacks before destroying the Pixi scene graph — otherwise GSAP
    // keeps ticking on destroyed containers.
    if (this.reelSet) {
      this.reelSet.dispose();
    }

    // Destroy the background image (sprite + texture) + the FS-only bg.
    // If we die mid-round, bgTexture === fsBgTexture: point it back at the
    // saved base so clearBackgroundImage frees the BASE and we free the FS
    // texture exactly once below (no double-destroy).
    this.fsBgActive = false;
    if (this.fsBgTexture && this.bgTexture === this.fsBgTexture) this.bgTexture = this.fsBgSavedBase;
    this.fsBgSavedBase = null;
    this.clearBackgroundImage();
    if (this.fsBgTexture) { try { this.fsBgTexture.destroy(true); } catch { /* torn down */ } this.fsBgTexture = null; }

    // Destroy user-asset textures we created.
    const userAssets = this.config.theme.userAssetTextures;
    if (userAssets) {
      for (const tex of userAssets.values()) {
        try {
          tex.destroy(true);
        } catch {
          /* already torn down */
        }
      }
      this.config.theme.userAssetTextures = undefined;
    }
    // Destroy lucide cache textures (also clears the cache).
    void disposeLucideTextureCache(this.lucideCache);
    this.config.theme.iconTextures = undefined;

    if (this._initialized) {
      this._initialized = false;
      // children: true → recursively destroy scene-graph containers/sprites
      // (catches anything not torn down explicitly above).
      this.app.destroy({ removeView: false }, { children: true });
    }
  }
}

/** Downscale a data-URL image if either dimension exceeds `max` pixels.
 *  Returns the original URL if already within bounds. Uses an offscreen
 *  canvas to resize — this keeps GPU texture uploads small and prevents
 *  GL context loss on constrained devices. */
async function constrainImageSize(dataUrl: string, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= max && img.height <= max) {
        resolve(dataUrl);
        return;
      }
      const scale = max / Math.max(img.width, img.height);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to decode uploaded image'));
    img.src = dataUrl;
  });
}

/** A fresh random bytes32 hex — seeds a real dev-harness outcome (dev-only). */
function randomBytes32(): `0x${string}` {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let h = '0x';
  for (const x of b) h += x.toString(16).padStart(2, '0');
  return h as `0x${string}`;
}

function formatWin(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;
  // Round to 2 decimal places
  const scale = 10n ** BigInt(decimals - 2);
  const rounded = (frac + scale / 2n) / scale;
  const fracStr = rounded.toString().padStart(2, '0');
  return `${whole}.${fracStr}`;
}
