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

## Stage 1 — Boot loading screen (in the game area, real progress)

**Source:** `App.tsx` — `bootScreen` node + the asset-load effect.

**What shows:** an opaque DOM overlay rendered **inside the game-canvas
container only** (never over the studio UI — it mimics the generator's game
iframe). Solid background `#07070c`, `position:absolute; inset:0; zIndex:30`.
Contents: a breathing wordmark (per-game title/colors), a 300×5 px progress
bar, and a breathing "LOADING" label. Bar width = **real completed-jobs
fraction**: starts at `0.06`, then `0.06 + 0.94 * (done / totalJobs)`.

**Critical vs non-critical loads.** Only the assets that gate the first frame
are tracked into the progress fraction (`track(...)`): user/base symbol
textures, the static base background, the title image, the frame image, and the
`game` layered-intro set. Everything else (win sheets, scatter idle/win sheets,
FS background, win-tier marquee art, coin rain, fs3/fs4/outro intro sets) loads
in parallel *behind* the overlay via `void` (non-blocking).

**Transition IN:** none — the overlay is opaque from first paint.
**Transition OUT:** when `Promise.all(bootJobs)` resolves → `showGameIntro()` is
called (arming Stage 2 underneath), then `setBootProgress(1)`, then after
**180 ms** `bootFade=true` (CSS `opacity 0.55s ease` → 0), then at
**180 + 650 ms** `bootGone=true` (node unmounts). The fade reveals the game
intro's iris-from-black already in progress — a seamless handoff.

**Control bar:** **hidden** — the opaque boot overlay covers the entire game
area; `showGameIntro()` sets `introOpen=true` at the same tick the fade begins,
so the bar stays hidden straight through into Stage 2.

**Bare-build shortcut:** if `isBareBuild()`, no theme assets load — the overlay
jumps to `progress=1`, fades at 150 ms, unmounts at 800 ms, and no intro shows.

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

**Per-spin loop:** counter pop → `playExpandingWildReveal` (**sticky** when
`scatterCount ≥ 4`: towers persist and accumulate; else per-spin towers clear) →
evaluate the displayed board with every standing tower fully wild → per-win
`playWinSequence` (its own tiered marquee) → roll into the TOTAL WIN plaque.
**Hard cap:** when the running total would reach `maxWinMultiplier × wager`
(default 5000), the plaque locks at the cap, the MAX WIN marquee takes over, and
the round **stops on that spin**.

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
      "shows": "opaque in-game loading overlay with real progress bar",
      "transitionIn": { "type": "none" },
      "transitionOut": { "type": "css-fade", "seconds": 0.55, "armsNextAt": "Promise.all(criticalJobs)" },
      "controlBar": false,
      "addable": true
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
      "shows": "animated FS bg + FREE SPINS/TOTAL WIN plaques + expanding/sticky wilds",
      "stickyWhenScattersGte": 4,
      "hardCap": "maxWinMultiplier * wager (default 5000)",
      "transitionIn": { "type": "revealed-at-fs-iris-open" },
      "transitionOut": { "type": "into-outro-iris" },
      "controlBar": true,
      "addable": false
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
