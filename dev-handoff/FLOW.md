# Presentation Flow — the full generator-reproducible pipeline

This document describes the **complete on-screen presentation flow** of the slot
as an ordered pipeline the generator can rebuild stage-by-stage. It is written
**theme-agnostically**: "Vice Heat" is only the reference skin. Every stage is an
**independently addable / removable** unit — dropping a stage never breaks the
ones around it (each stage falls back to a plain cut or to the next live scene).

Reference sources (read these to re-derive every number below):
- `src/App.tsx` — boot loader + theme-wiring effect (asset load → intro handoff).
- `src/game/PixiApp.ts` — `showGameIntro`, `buildLayeredIntroScene`,
  `playFreeSpinsIris`, `showFreeSpinOverlay`, the `resolve()` free-spins branch,
  `playFreeSpinsOutro`, `playExitIris`, `teaseZoomStep`/`releaseTeaseZoom`,
  `playFrameWinFlash`.
- `src/game/ReelSet.ts` — `stopOnStops` (near-miss tease + sequential gates + POV camera).
- `src/game/effects/tease/universalAnticipation.ts` — the default "gold gate" tease preset.

> **Motion is never skipped.** `src/motionOverride.ts` shims
> `matchMedia('prefers-reduced-motion')` to always answer `matches:false`, so
> every gate that reads `prefersReducedMotion()` runs the full presentation
> regardless of the viewer's OS reduce-motion setting. The generator should
> assume the full flow always plays (turbo is the only path that shortcuts it).

---

## The iris technique (shared by every black-bookended transition)

All intro/FS/outro transitions use one **v8-safe circular iris**. Reproduce it
exactly — the naive even-odd fill unions in Pixi v8 and produces a grey wash.

1. Build one `Graphics` on a **screen-space overlay** added *last* to
   `app.stage` (so it renders above the letterboxed `sceneRoot`; the overlay is
   in raw screen pixels, immune to scene scaling).
2. Each redraw: `clear()` → draw an **oversized solid-black field rect**, fully
   opaque (`alpha:1`), then punch the hole with **`circle(cx,cy,r).cut()`**.
   - Field size `outer = rDiag * 2.4`, positioned `ox = cx - outer/2`,
     `oy = cy - outer/2`, where `rDiag = 0.5 * hypot(sw, sh)` (half-diagonal, so
     the hole covers all four corners on any aspect).
   - The oversize guarantees the cut circle is **always fully inside** the
     field even at `r = rDiag` (v8 `cut()` fails if the hole touches an edge).
   - Only draw+cut the circle when `r > 0.5` (radius 0 = full black).
3. Animate a plain `{ r }` proxy with GSAP and call `redraw()` on `onUpdate`.
   One proxy = one `killTweensOf` target for clean teardown.

**Blink shape** used by every stage: `r: full → 0` (CLOSE, `power3.in`, the
"suck-in"), a **full-black beat** where the scene behind is swapped, then
`r: 0 → full` (OPEN, `power2.out`). The game intro's entrance is a half-blink
(open only); FS-intro / outro are full blinks bookended on both ends.

`playExitIris` is the **degenerate fallback** (no art loaded): close `r→0`
`0.45s power2.in` → `midAction()` at black → open `0→r` `0.5s power2.out`.

---

## Stage 1 — CHAIN GAMES boot loader (**the first thing on screen, in every game**)

> ⚠️ **This stage is missing from the dev build entirely — there is no loading
> screen today.** It is not optional and it is not Vice-specific: it is
> **platform branding**, identical in every slot the generator produces, and it
> must run **before anything else**. A game that cuts straight to its intro has
> skipped stage 1.

**Source:** `src/App.tsx` — the `bootScreen` node, `finishBoot()`, and four
`@keyframes`: `boot-loader-row` + `boot-loader-col` (the sheet), `boot-bar-clock`
(the bar's gate) and `boot-bar-idle` (the bar's breathing opacity).

**What shows:** an opaque DOM overlay rendered **inside the game-canvas
container only** (never over the studio/host chrome — it mimics the generator's
game iframe). Solid `#07070c`, `position:absolute; inset:0; zIndex:30`. Two
elements, centred, nothing else:

1. **The CHAIN GAMES logo build-in** — a one-shot animation, not a spinner and
   not a cycle. Asset: `theme/vice/chain_loader_sheet.webp`, **2000×2000, an 8×8
   grid of 250 px frames**, 60 real frames plus 4 duplicates of the last frame
   padding the grid out to 64. Played at **66.7 ms per cell = 4.2667 s total**,
   then it **holds** on the finished lockup.
2. **An ultra-clean bar** — a **236×2 px hairline**, no glow, no colour ramp, no
   label: `rgba(255,255,255,0.92)` fill on an `rgba(255,255,255,0.10)` track,
   both `border-radius: 999px`. It breathes on opacity (0.5↔0.9, 1.8 s) and
   nothing else.

The frame box is 250×250 shown **1:1** (never scaled) with `overflow:hidden;
contain:strict`, and carries `marginBottom:-108` — the logo's ink ends at 57.8 %
of the frame, so 105 px of the box is transparent tail; 105 dead + 18 flex gap −
108 margin leaves a ~15 px optical gap down to the bar.

⚠️ **The travel is −1750 px per axis, not −2000 px.** `jump-none` includes both
endpoints, so an 8-cell axis moves in **7** steps of 250 px. The two axes also
run at different durations and iteration counts — they are not one shared
animation:

| | element | keyframe | duration | iterations |
|---|---|---|---|---|
| row | the 250×250 wrapper inside the clip box | `translate3d(0,0,0)` → `translate3d(0,-1750px,0)` | `4.2667s` | `1`, `both` |
| column | a 2000×2000 strip inside that wrapper (`background-size: 2000px 2000px`, `no-repeat`, `will-change: transform`) | `translate3d(0,0,0)` → `translate3d(-1750px,0,0)` | `0.5333s` | `8`, `both` |

The column completes one pass per row, so the row advances exactly as the column
wraps. Guess −2000 px or a single shared duration and the logo lands a cell off
and shows blank frames. Machine-readable copy: `features/boot-loader/feature.json`
→ `logo.stepping`.

**⚠️ THE BAR MAY NOT FINISH BEFORE THE LOGO DOES.** This is the rule, and it is
the one that is easy to get wrong. Real asset progress alone fills the bar in a
few hundred ms on a warm cache, so it sits at 100 % while the lockup is still
assembling — it reads as if the game were waiting on nothing. What is displayed
is therefore the **minimum of real progress and the clip's own playhead**:

```
width      = 6% + 94% * (settledCriticalJobs / totalCriticalJobs)   // real progress
             transition: width 0.35s ease                          // else it hard-jumps
                                                                   // ~18.8pp per job
max-width  = keyframe 0% -> 100% over 4.2667s, linear, fill both    // the playhead
shown      = min(the two)                                           // percentage
                                                                    // max-width resolves
                                                                    // against the track
```

Whichever is slower wins, in **both** directions: the bar can never outrun the
logo, and on a cold cache the real loading still holds it back. Doing this in
CSS is deliberate — a per-frame JS clock competes with the asset decoding this
screen exists to cover, and that is exactly what made an earlier cut of this
loader stutter.

**Critical vs non-critical loads.** Only the assets that gate the first frame
count toward the fraction (`track(...)`): symbol textures, the static base
background, the title image, the frame image, and the `game` layered-intro set.
Everything else (win sheets, scatter idle/win sheets, FS background, win-tier
marquee art, coin rain, fs3/fs4/outro intro sets) is fired with `void` and
streams in behind the overlay.

**Transition IN:** none — the overlay is opaque from first paint.
**Transition OUT:** when the tracked jobs resolve, `finishBoot()` snaps progress
to 1 and then waits out `LOADER_MS (4267) + BAR_HOLD_MS (280)` **measured from
boot start**, so the screen always dwells a beat on *finished logo + full bar*
before it goes. Then `bootFade=true` (CSS `opacity 0.55s ease` → 0) and 650 ms
later `bootGone=true` (node unmounts). `showGameIntro()` has already armed
stage 2 underneath, so the fade reveals an iris-from-black already in progress.

**Do not tear the screen down on asset-ready alone.** Without the floor, a warm
cache dismissed the loader a few hundred ms in and the logo was ripped away
mid-build — it read as a broken flicker, not a fast load.

**Control bar:** **hidden** — the opaque overlay covers the whole game area, and
`introOpen` is already true when the fade begins, so the bar stays hidden
straight through into stage 2.

**Bare-build shortcut:** with no theme assets to load the timing is unchanged —
the loader is branding, so it plays out and fades on the same schedule.

---

## Stage 2 — Game intro (iris-open, breathing layers, live animated bg)

**Source:** `PixiApp.showGameIntro` + `buildLayeredIntroScene('game', …)`.

**What shows:** a full-canvas **living title screen** built from the `game`
layered-intro set (see `flow/intro-screens/README.md` for the layer format).
The board is hidden (`sceneRoot.visible=false`) but the **live animated
base-game background stays visible behind the intro** — the `game` set has **no
bg layer** (it is skipped so the running base background shows through). A light
**black scrim `alpha:0.35`** sits under the layers so white captions stay
readable over the bright art.

**Layers & presets:** overlay `zIndex:30000`, `eventMode:'static'`, full-canvas
hit area (tap **anywhere** dismisses). Per-role motion (all yoyo/sine.inOut):
logos & symbols **float**; the biggest logo becomes the **hero** (stronger sway
+ drift); press-to-continue **pulses** (alpha 0.9→0.34, scale →1.05 over
0.85 s); **cards and text stay STATIC** (see intro-screens README for why).

**Transition IN (half-blink, open only):** screen starts **fully black**; a
circle irises open onto the breathing scene. `st.r: 0 → rDiag`, **duration
0.85 s, delay 0.25 s, `power2.out`**. Simultaneously the scene settles from
`scale×1.045 → ×1.0` over **1.1 s, delay 0.25 s, `power2.out`**. The iris
Graphics is destroyed on complete.

**Transition OUT (full blink, on tap):** builds a second iris and a GSAP
timeline: CLOSE `st2.r: rDiag → 0` **0.55 s `power3.in`** at t=0; at **t=0.62 s**
a `call` fires the black-beat swap — `scene.visible=false`, scrim
`black.visible=false`, `sceneRoot.visible=true`, and `onDismiss()`
(→ `setIntroOpen(false)`); OPEN `st2.r: 0 → rDiag` **0.6 s `power2.out`** at
**t=0.72 s**. Overlay destroyed on complete.

**Control bar:** **hidden** the entire time (`introOpen=true`). It fades back in
via DOM `opacity 0.6s ease` starting at the OUT black beat.

**Audio note:** the dismiss tap doubles as the browser audio gesture, so
ambient music can start the instant the player enters the base game.

---

## Stage 3 — Base game

**What shows:** the reels over the live animated base background (static paints
instantly, then a seamless spritesheet loop cross-fades in @6fps), the neon
frame with its auto-detected inner window, and the win-tier marquee ceremony on
wins. This is the steady-state loop; spins resolve through `PixiApp.resolve()`.

**Transition IN:** revealed at Stage 2's OUT black beat (no separate motion).
**Transition OUT:** none — it is continuous; feature stages (4–8) overlay it and
return to it.

**Control bar:** **visible** (full spin/bet/auto/turbo controls).

---

## Stage 4 — POV-dolly tease + sequential gold gates (on the 2nd scatter)

**Source:** `ReelSet.stopOnStops` (camera hooks + near-miss detection) +
`PixiApp.teaseZoomStep`/`releaseTeaseZoom` + `universalAnticipation` preset.

**Trigger:** fires the moment the **2nd scatter VISIBLY lands** (never at spin
start — that would telegraph it). Gated by `config.nearMissTease` (undefined =
on). Skipped in turbo/fast stops.

**POV dolly (`teaseZoomStep`):** the **whole world** (background included)
dollies toward the viewer, pinned on the machine centre. `world.scale → 1.06 +
0.05 * step`, `world.position → cx*(1-s), cy*(1-s)`, each **0.65 s `power2.out`,
`overwrite:'auto'`**. `step 0` = 2nd scatter landed; **+1 per landed teased
reel** (the tension arc). Overlays (iris, marquee, boot) live above `world` and
stay put.

**Sequential gold gates (`universalAnticipation`, the default preset):** reels
arm **one after another** (position-staggered, never all at once). Each landed
scatter gets a one-shot golden **ray burst** + breathing **corner brackets** +
**stage dim** of its reel's other cells (0.42). Each **pending** reel gets a
clean **double gold border** with rising ember energy masked to the reel window
— the "gate" lights up just as the previous reel stops. The preset is swappable
(`teaseRegistry`) and fully theme/grid-agnostic (all geometry from ctx rects,
color from `ctx.gold`).

**Progressive deceleration (timings from `symbolAnimations.FALLBACK_TIMINGS.nearMiss`):**
normal reels stop with `1.0 s` decel and `i*0.15 s` stagger. Each teased reel
`teaseIdx` gets `extra = 1.1 * (teaseIdx+1) * intensityScale` added to a
`1.4 s` base, and `teaseDelay = i*0.15 + 0.35*(teaseIdx+1)`. `intensityScale =
1.4` when scatterCount ≥ 3, else `1.0`.

**Transition OUT (`releaseTeaseZoom`, after all reels stop):**
- **MISS (≤2 scatters):** camera bounces relaxed back out — `world.scale→1`,
  `world.position→0`, **0.9 s `back.out(1.4)`**. Returns to Stage 3.
- **HIT (3+ scatters):** the lock is **KEPT** — Stage 5 owns the exit.

**Control bar:** **visible** (the tease is an in-board effect).

---

## Stage 5 — Trigger: camera lock + per-cell scatter win + frame flash

**Source:** `resolve()` free-spins branch (top) + `playFrameWinFlash`.

**Entry condition:** `outcome.freeSpinsTriggered && freeSpinsPlayed > 0 &&
!turbo`. The trigger board lands first (with the Stage-4 tease), then:
- The **3rd landed scatter** fires `playFrameWinFlash()` — the frame marquee
  bulb-chase/arrow-strobe one-shot sheet (48 frames @12 fps) plays inside the
  frame's flash region: fade-in `0.12 s`, frame sweep over `frames/fps` s,
  fade-out `0.35 s`.
- Every landed scatter cell plays its **own win sheet on its cell** (no
  fly-to-centre collect). Camera stays **LOCKED** (tease zoom kept).
- **Hold 2.2 s** on the per-cell scatter win (`gsap.delayedCall(2.2, …)`).
- `gsap.delayedCall(0.95, resetTeaseZoom)` releases the camera **hard at the
  iris' black beat** (never visibly).

**Transition OUT:** straight into Stage 6's iris.

**Control bar:** **visible** during the 2.2 s hold, then **hidden** the instant
the FS iris begins (`onFsIntroVisible(true)`).

---

## Stage 6 — Free-spins intro (iris blink, 7 s hold, tap-to-start)

**Source:** `PixiApp.playFreeSpinsIris(count, scatterCount)`. Overlay
`zIndex:10000`. Whole-transition tempo multiplier **`S = 1.3`** (30 % slower —
every duration and position below is already ×1.3).

**Tier select:** uses the **`fs4`** layered set when `scatterCount ≥ 4`, else
**`fs3`** (falls back to a single texture, then to plain "FREE SPINS / N SPINS"
text). The set's own bg layer + a dark `0x050509` backing fill the screen.

**Transition IN (full blink):**
- `onFsIntroVisible(true)` → control bar hidden for the whole transition.
- CLOSE `st.r: rDiag → 0`, tint `0→1`, **0.91 s `power3.in`** at t=0.
- **t≈0.94 s** `enterFsBackground()` — swap to the FS-only background at full
  black (never visible).
- **t≈0.96 s** intro armed (`alpha:1`) behind the field.
- OPEN `st.r: 0 → rDiag`, **0.78 s `power2.out`** at **t≈1.07 s**;
  `introContent.scale 0.86→1` **0.72 s** at **t≈1.09 s**.

**Hold:** **7.0 s** from when the intro becomes visible
(`dismissAt = 0.84*S + 7.0 ≈ 8.09 s`). A **tap anywhere** during the hold
(`t` between `1.95 s` and `dismissAt−0.05`) seeks straight to the dismiss blink;
the 7 s timer is the autoplay-safe fallback.

**Transition OUT (dismiss blink):** CLOSE `st.r→0` **0.72 s `power3.in`** at
`dismissAt`; intro `alpha:0` at `dismissAt+0.81 s`; OPEN `st.r→rDiag` **0.78 s
`power2.out`** at `dismissAt+0.94 s` — opening onto the FS board. `finish()`
calls `onFsIntroVisible(false)`.

**Control bar:** **hidden** for the whole stage.

---

## Stage 7 — Free-spins round (animated bg, plaques, expanding/sticky wilds)

**Source:** `resolve()` free-spins loop + `showFreeSpinOverlay`.

**What shows:** the FS-only animated background (e.g. a 48-frame seamless
spritesheet loop @6fps), the reels, optional side dancers, and two neon plaques
in `showFreeSpinOverlay`:
- **FREE SPINS** counter plaque (`1 / N`, pops on each spin change).
- **TOTAL WIN** plaque (accumulates each spin's displayed win, pops on update).
On a portrait phone (`screen.width < 520`) the plaques move into the top-left
header band (scaled 0.66) and the dancers are dropped.

**The plaques are BAKED-TITLE SPRITES, not drawn.** `setFsPlaquePair(freeUrl,
totalUrl)` takes two art files — `free_spins_counter.png` and
`total_win_counter.png` — and the value is drawn into each plaque's dark inset
box. The procedural neon plate is only the fallback for a skin that ships no
plaque art; Vice ships both, so a build that draws the plate is not matching the
reference.

**⚠️ Swap the reel strips before the round rolls.** The free spins roll their own
**rare-wild `fsReelStrips`**, and a *bought* round rolls its stage's strips —
`setFsStripsForStage(viceRound.stageCode)`. Whatever the settlement evaluates,
the display must roll. We shipped this half-wired once: settlement swapped, the
display kept the base strips, and wilds appeared on screen that "didn't connect
with Q/J" because the shown board was not the settled board. **Swap
`reelLengths` with the strips** — we also shipped a bought round where those
desynced (1170-stop display against 405-stop settlement) and wins highlighted the
wrong cells.

**Per-spin loop:**

1. counter pop
2. `playExpandingWildReveal` — **sticky** when `scatterCount ≥ 4`: towers persist
   and accumulate up to `custom.stickyTowerCap` = **5**; otherwise per-spin
   towers clear. A sticky tower must stay standing **while the other reels roll**,
   not be rebuilt after the board lands.
3. evaluate the displayed board with every standing tower fully wild
4. **→ TOWER MULTIPLIER badges ←** — see below. This step sits **between the
   evaluate and the win presentation**, and it is missing from a naive port.
5. per-win `playWinSequence` (its own tiered marquee)
6. roll into the TOTAL WIN plaque

**The badge beat (step 4).** Every reel standing fully wild in a free spin
carries a **×1–×5** badge. Show it *after* the board evaluates and *before* the
win presentation, so the player reads the ×N that is about to be applied
(`reelSet.setTowerMultiplier`). The values are **dealt at settlement and merely
replayed** — the display never rolls them. Vice ships art for all five values, so
a ×1 tower shows its plate too. A 4-scatter **sticky** tower keeps the badge it
was dealt when it *joined*; a 3-scatter round re-expands from scratch and redraws
every spin. The badge drops in and locks with the tower as **one** impact
(`expandWildMultiPop` 1.45 overshoot over `expandWildMultiPopTime` 0.42 s,
`back.out(3)`, with the tower flexing scaleX 1.05 / scaleY 0.95 on
`elastic.out(1, 0.45)`) — two separate fades read as no impact at all. Weights
`[55,20,9,6,10]`; a win pays × the **highest** badge it crosses, never the
product. Full spec: `features/tower-multipliers/`.

> Omit the badges and the game still runs — it just pays the **no-tower floor of
> 71.6 %** against a certified 96.46 %.

**Two routes into MAX WIN, not one:**

- **Full board** — 5 fully wild reels pay exactly `maxWinMultiplier × bet`
  **instantly** and end the round (`custom.fullBoardInstantMaxWin`), in **both**
  bonuses. Nothing is multiplied on top of it. This is the visible, celebrated
  route and the only one a 3-scatter round realistically reaches.
- **Running-total cap** — when the accumulated total would reach
  `maxWinMultiplier × wager` (default 5000), the plaque locks at the cap, the MAX
  WIN marquee takes over, and the round **stops on that spin**.

Test the cap in **exact integer arithmetic** (`winAmount >= BigInt(capX) * wager`).
A float comparison with a tolerance can skip the ceremony on a round that was
actually paid the cap.

**Transition IN:** revealed as Stage 6's iris opens.
**Transition OUT:** into Stage 8's iris after the last spin (or the cap spin).

**Control bar:** **visible** (returns when the Stage-6 iris finished).

---

## Stage 8 — TOTAL WIN outro (iris-bookended, count-up, ≤15 s, tap-anywhere)

**Source:** `PixiApp.playFreeSpinsOutro(totalWin, decimals, onBlackBeat)`.
Overlay `zIndex:10000`, tempo **`S = 1.3`**. Falls back to `playExitIris` when
no `outro` art is loaded.

**What shows:** the `outro` layered set (TOTAL WIN wordmark + press-to-continue
over the club bg, every layer breathing) with a **marquee-styled amount** set
into the scene's content root that **counts up**.

**Transition IN (full blink):** `onFsIntroVisible(true)`; CLOSE `r→0` **0.91 s
`power3.in`**; at **t≈0.94 s** `onBlackBeat()` hides the FS overlay + swaps the
background back (invisibly); scene `alpha:1` at **t≈0.96 s**; OPEN `r→rDiag`
**0.78 s `power2.out`** at **t≈1.07 s**; `content.scale 0.86→1` at **t≈1.09 s**.

**Count-up:** amount `0 → finalVal` over **4.2 s `power1.inOut`** starting at
**t≈1.76 s**, then a `back.out(2.2)` pop (0.5 s) settling into a gentle
`×1.045` pulse (1.3 s yoyo) for the rest of the hold.

**Hold:** **15.0 s** (`dismissAt = 0.84*S + 15.0 ≈ 16.09 s`). A **tap anywhere**
(`t` between `1.95 s` and `dismissAt−0.05`) continues immediately.

**Transition OUT (dismiss blink):** CLOSE `r→0` **0.72 s `power3.in`** at
`dismissAt`; scene `alpha:0` at `+0.81 s`; OPEN `r→rDiag` **0.78 s `power2.out`**
at `+0.94 s` — landing back on the base game. `finish()` →
`onFsIntroVisible(false)`.

**Control bar:** **hidden** the whole stage; returns at the OUT black beat.

---

## Stage 9 — Return to base game

The outro's second blink opens onto the normal base screen (Stage 3). Control
bar **visible**. The cycle is complete.

---

## Control-bar visibility summary (explicit per stage)

| Stage | Control bar |
|-------|-------------|
| 1 Boot loading | **Hidden** (covered by opaque overlay; `introOpen` armed before fade) |
| 2 Game intro | **Hidden** (`introOpen`); fades in 0.6 s at OUT black beat |
| 3 Base game | **Visible** |
| 4 Tease / gold gates | **Visible** |
| 5 Trigger (hold) | **Visible** during 2.2 s hold → **Hidden** as FS iris starts |
| 6 FS intro | **Hidden** (`fsIntroOpen`) |
| 7 FS round | **Visible** |
| 8 TOTAL WIN outro | **Hidden** (`fsIntroOpen`) |
| 9 Base game | **Visible** |

Wiring: `introOpen` (game intro) and `fsIntroOpen` (FS iris + outro, driven by
`pixiApp.onFsIntroVisible`) both drive the DOM control-bar container's
`opacity`/`pointerEvents` with a `0.6 s ease` transition.

---

## Generator-consumable flow array

Each stage is independently addable/removable. `transitionIn`/`transitionOut`
carry the iris technique + exact seconds; `controlBar` is the DOM-bar flag.
`S = 1.3` is the FS/outro tempo multiplier (durations below are the raw base ×S
values already resolved).

```json
{
  "iris": {
    "technique": "oversized-black-field-rect + v8 circle.cut() hole",
    "fieldSize": "rDiag * 2.4",
    "rDiag": "0.5 * hypot(screenW, screenH)",
    "drawCircleWhen": "r > 0.5",
    "tempoMultiplierS": 1.3
  },
  "flow": [
    {
      "id": "boot",
      "shows": "CHAIN GAMES logo build-in + hairline progress bar, opaque, inside the game box",
      "universal": true,
      "mustBeFirst": true,
      "note": "PLATFORM BRANDING — identical in every generated game, not a per-game skin. Currently ABSENT from the dev build; it has to exist before anything else renders.",
      "background": "#07070c",
      "logo": {
        "sheet": "theme/vice/chain_loader_sheet.webp",
        "sheetPx": [2000, 2000],
        "grid": [8, 8],
        "framePx": [250, 250],
        "realFrames": 60,
        "padFrames": 4,
        "padContent": "copies of the last frame",
        "msPerCell": 66.7,
        "totalSeconds": 4.2667,
        "playback": "one-shot, then HOLD on the lockup (never loops)",
        "render": "1:1, never scaled; box overflow:hidden + contain:strict",
        "stepping": "transform, NOT background-position — steps(8, jump-none) on both axes, row on the wrapper and column on the inner strip",
        "whyTransform": "background-position on a large sheet re-rasterises every step and stuttered while the real assets were decoding",
        "marginBottom": -108,
        "whyMargin": "logo ink ends at 57.8% of the frame; 105px dead tail + 18px flex gap - 108px margin leaves a ~15px optical gap to the bar"
      },
      "bar": {
        "px": [236, 2],
        "borderRadius": 999,
        "fill": "rgba(255,255,255,0.92)",
        "track": "rgba(255,255,255,0.10)",
        "idle": "opacity 0.5<->0.9 over 1.8s",
        "label": null,
        "colourRamp": null,
        "width": "6% + 94% * (settledCriticalJobs / totalCriticalJobs)",
        "cap": "max-width keyframe 0% -> 100% over 4.2667s linear, fill both",
        "shown": "min(width, cap) — the bar MUST NOT reach full before the logo has finished playing",
        "whyCss": "a per-frame JS clock competes with the asset decoding this screen exists to cover"
      },
      "criticalJobs": ["symbol textures", "static base background", "title image", "frame image", "game layered-intro set"],
      "nonCriticalJobs": "win sheets, scatter idle/win sheets, FS background, win-tier art, coin rain, fs3/fs4/outro intro sets — fired unawaited, they stream in behind the overlay",
      "transitionIn": { "type": "none", "why": "opaque from first paint" },
      "transitionOut": {
        "type": "css-fade",
        "seconds": 0.55,
        "startsAt": "max(criticalJobsSettled, LOADER_MS 4267 + BAR_HOLD_MS 280) measured from boot start",
        "unmountAfter": 0.65,
        "armsNextAt": "showGameIntro() runs before the fade, so the iris-from-black is already in progress when the overlay clears",
        "whyFloor": "on a warm cache the assets settle in a few hundred ms; without the floor the logo is torn away mid-build and reads as a broken flicker"
      },
      "controlBar": false,
      "addable": false
    },
    {
      "id": "game-intro",
      "shows": "layered breathing title screen over live animated base bg",
      "scrimAlpha": 0.35,
      "zIndex": 30000,
      "layerSet": "game",
      "transitionIn": { "type": "iris-open", "seconds": 0.85, "delay": 0.25, "ease": "power2.out", "sceneSettle": { "seconds": 1.1, "from": 1.045, "ease": "power2.out" } },
      "transitionOut": { "type": "iris-blink", "closeSeconds": 0.55, "closeEase": "power3.in", "blackBeatAt": 0.62, "openSeconds": 0.6, "openEase": "power2.out", "dismiss": "tap-anywhere" },
      "controlBar": false,
      "addable": true
    },
    {
      "id": "base-game",
      "shows": "reels + animated base bg + neon frame + win-tier marquee",
      "transitionIn": { "type": "revealed-at-prev-black-beat" },
      "transitionOut": { "type": "none-continuous" },
      "controlBar": true,
      "addable": false
    },
    {
      "id": "tease",
      "shows": "POV world dolly + sequential gold-gate reels + stage dim",
      "trigger": "2nd scatter visibly lands",
      "camera": { "scale": "1.06 + 0.05*step", "seconds": 0.65, "ease": "power2.out" },
      "tease": { "extraDuration": 1.1, "teasePause": 0.35, "intensityScaleGte3": 1.4, "baseDecel": 1.4, "normalDecel": 1.0, "stagger": 0.15 },
      "transitionIn": { "type": "camera-dolly-in" },
      "transitionOut": { "type": "miss-pullback", "seconds": 0.9, "ease": "back.out(1.4)", "hitKeepsLock": true },
      "controlBar": true,
      "addable": true
    },
    {
      "id": "trigger",
      "shows": "per-cell scatter win sheets + frame marquee flash, camera locked",
      "frameFlash": { "firesOn": "3rd landed scatter", "fadeIn": 0.12, "fadeOut": 0.35 },
      "hold": 2.2,
      "cameraReleaseAt": 0.95,
      "transitionIn": { "type": "trigger-board-land" },
      "transitionOut": { "type": "into-fs-iris" },
      "controlBar": { "duringHold": true, "atIrisStart": false },
      "addable": true
    },
    {
      "id": "fs-intro",
      "shows": "tiered FS intro screen (fs4 if scatters>=4 else fs3)",
      "zIndex": 10000,
      "layerSet": "fs3|fs4",
      "transitionIn": { "type": "iris-blink", "closeSeconds": 0.91, "closeEase": "power3.in", "bgSwapAt": 0.94, "openSeconds": 0.78, "openEase": "power2.out" },
      "hold": 7.0,
      "transitionOut": { "type": "iris-blink", "closeSeconds": 0.72, "openSeconds": 0.78, "dismiss": "tap-anywhere" },
      "controlBar": false,
      "addable": true
    },
    {
      "id": "fs-round",
      "shows": "animated FS bg + FREE SPINS/TOTAL WIN plaques + expanding/sticky wilds + tower multiplier badges",
      "plaques": "TWO BAKED-TITLE sprites (free_spins_counter.png + total_win_counter.png) via setFsPlaquePair — the value is drawn into each plaque's dark inset box. The drawn neon plate is only the fallback when a skin ships no plaque art.",
      "stripSwap": {
        "rule": "swap the DISPLAY reels to the strips the SETTLEMENT evaluates before the round rolls",
        "natural": "fsReelStrips (rare wilds)",
        "bought": "the stage's own strips — setFsStripsForStage(stageCode)",
        "alsoSwap": "reelLengths, together with the strips",
        "symptomIfMissed": "wilds appear on screen but 'do not connect' (display board != settled board), or wins highlight the wrong cells (1170-stop display against 405-stop settlement)"
      },
      "stickyWhenScattersGte": 4,
      "stickyTowerCap": 5,
      "stickyFromLanding": "a standing tower must remain on screen WHILE the other reels roll — do not tear it down at spin start and rebuild it after the board lands",
      "towerMultipliers": {
        "see": "features/tower-multipliers/",
        "values": "x1..x5",
        "weights": [55, 20, 9, 6, 10],
        "weightsMeaning": "index 0 = x1 … 4 = x5; relative weights, not percentages",
        "dealtTo": "every reel standing FULLY WILD in a free spin",
        "dealtBy": "SETTLEMENT, from a reserved seed namespace keccak(seed, 1 << 200) — the badge draw must NOT consume words from the reel-stop stream or every certified RTP figure is void",
        "rule": "a combination pays x the HIGHEST badge among the expanded reels it crosses (a ways combo starts on reel 0 and runs matchCount reels, so it crosses reels 0..matchCount-1) — NOT the product, NOT the sum",
        "scatterPayMultiplied": false,
        "appliedOnInstantMaxWin": false,
        "onHotSpins": false,
        "stickyRule": "a 4-scatter sticky tower keeps the badge it was dealt when it JOINED; a 3-scatter round redraws every spin",
        "present": "shown AFTER the board evaluates and BEFORE the win presentation, so the player reads the xN about to be applied; values are replayed from the settled spin and never rolled by the display; x1 DOES show a plate wherever the badge sheet ships an x1 frame (Vice does)",
        "art": { "file": "theme/vice/wild_multi_sheet.webp", "frames": 5, "slotYFrac": 0.86, "sizeFrac": 0.82 },
        "lockPop": { "dropFromFracOfReelHeight": 0.10, "overshootScaleParam": "expandWildMultiPop", "durationParam": "expandWildMultiPopTime", "settleEase": "back.out(3)", "towerFlex": { "scaleX": 1.05, "scaleY": 0.95, "ease": "elastic.out(1, 0.45)" } },
        "ifOmitted": "the free-spins RTP collapses to the no-badge floor of 71.6% against the certified 96.46% natural"
      },
      "maxWinRoutes": [
        { "id": "full-board", "rule": "5 fully wild reels pay exactly maxWinMultiplier * bet INSTANTLY and end the round (custom.fullBoardInstantMaxWin), in BOTH bonuses; nothing is multiplied on top" },
        { "id": "running-total-cap", "rule": "when the accumulated total would reach maxWinMultiplier * wager (default 5000) the plaque locks at the cap, the MAX WIN marquee takes over, and the round stops on that spin" }
      ],
      "capTest": "exact integer arithmetic — winAmount >= BigInt(capX) * wager. A float comparison with a tolerance can skip the ceremony on a round that WAS paid the cap.",
      "transitionIn": { "type": "revealed-at-fs-iris-open" },
      "transitionOut": { "type": "into-outro-iris" },
      "controlBar": true,
      "addable": false
    },
    {
      "id": "bonus-buy",
      "shows": "buy menu: two priced cards (3-scatter / 4-scatter) + the ante toggle, over a dimmed board",
      "note": "AN ALTERNATIVE ENTRY POINT, not a step in the linear path. It replaces the tease+trigger stages: base-game -> bonus-buy -> fs-intro -> fs-round. The array above models one linear run and has no way to express a branch, so it is declared here explicitly.",
      "cards": [
        { "id": "buy3", "scatters": 3, "costMult": 100, "label": "read verbatim from custom.viceBuyStages[].costMult — do NOT compute it (that produced the '300x' bug)" },
        { "id": "buy4", "scatters": 4, "costMult": 200, "label": "read verbatim from costMult" }
      ],
      "ante": { "costMult": 3.25, "label": "3x FREE SPINS CHANCE", "effect": "every spin costs bet * costMult and runs on custom.anteBet.reelStrips", "note": "a TOGGLE on the base game, not a stage — it changes the strips of every subsequent base spin until it is switched off" },
      "boughtRoundPresentation": "the forced stops carry the bought scatter count: 2 land, the tease arms, the rest drop like a natural trigger; the board is then evaluated in full so display == payout",
      "hotSpinsSuppressed": "a bought round NEVER goes hot — the expansion would erase the scatters the player just paid for",
      "guaranteedTower": "4-scatter buy only: if the first free spin would land with NO fully-wild reel, guaranteedTowerReel advances to the next stop whose window holds a wild (custom.viceBuyStages[].guaranteedTowerOnFirstSpin). Without it 15.5% of bought rounds showed no tower at all on a buy sold as '10 sticky tower spins'.",
      "controlBar": true,
      "addable": true
    },
    {
      "id": "total-win-outro",
      "shows": "layered TOTAL WIN screen + counting-up amount",
      "zIndex": 10000,
      "layerSet": "outro",
      "transitionIn": { "type": "iris-blink", "closeSeconds": 0.91, "blackBeatAt": 0.94, "openSeconds": 0.78, "countUpSeconds": 4.2, "countUpEase": "power1.inOut" },
      "hold": 15.0,
      "transitionOut": { "type": "iris-blink", "closeSeconds": 0.72, "openSeconds": 0.78, "dismiss": "tap-anywhere" },
      "fallback": "playExitIris (0.45 close / 0.5 open) when no outro art",
      "controlBar": false,
      "addable": true
    },
    {
      "id": "base-game-return",
      "shows": "back to steady-state base game",
      "transitionIn": { "type": "revealed-at-outro-black-beat" },
      "transitionOut": { "type": "none-continuous" },
      "controlBar": true,
      "addable": false
    }
  ]
}
```

### Adding / removing a stage

- **Remove the game intro:** don't load the `game` layered set / return `false`
  from `showGameIntro` — boot fades straight to a visible base game, control bar
  on from the first frame.
- **Remove the tease:** set `config.nearMissTease = false` — reels use the plain
  `1.0 s` decel, no camera dolly, no gates. Trigger still works.
- **Remove the FS intro:** clear the `fs3`/`fs4` sets — `playFreeSpinsIris`
  falls back to plain text, or (if you also skip the iris) the round can open
  directly. Control-bar flags are unchanged.
- **Remove the outro:** don't load the `outro` set — `playFreeSpinsOutro` falls
  back to `playExitIris` (a plain black blink back to base, no count-up).
- Each stage owns its own overlay/teardown, so removing one never leaks nodes
  into the next.
