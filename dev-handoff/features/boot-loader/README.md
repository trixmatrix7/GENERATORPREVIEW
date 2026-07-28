# CHAIN GAMES Boot Loader — the first thing on screen, in every game

**Type:** flow stage / lifecycle (needs render code) · **Grids:** any · **Universal.**

> ⚠️ **The dev build has no loading screen at all today.** This is not an optional
> flourish and it is not a Vice Heat decoration — it is **platform branding**, the
> same in every slot the generator produces, and it must run **before anything
> else**. It is stage 1 of `FLOW.md`.

---

## What it is

When the generator embeds a built game it renders it in an **iframe** (the game
box). This loader is the first thing shown *inside that box* — never over the
studio/host chrome around it. An opaque panel covers the game area and shows
exactly two things:

1. **The CHAIN GAMES logo building in** — a one-shot spritesheet animation that
   assembles the wordmark and then holds on the finished lockup.
2. **A hairline progress bar** underneath it.

When both the logo has finished and the critical assets have loaded, the panel
cross-fades straight into the game intro, which has already started underneath.

**There is no per-game title, no per-game colour ramp and no "LOADING" label.**
An earlier revision had all three; they were removed on purpose. The loader
identifies the *platform*, not the game. If per-game boot theming is ever wanted
again it belongs on the bar colour — never on a title.

---

## The logo

| | |
|---|---|
| asset | `theme/vice/chain_loader_sheet.webp` |
| sheet | **2000 × 2000**, an **8 × 8** grid of **250 px** frames |
| frames | **60 real** + 4 duplicates of the last frame padding the grid to 64 |
| timing | **66.7 ms per cell → 4.2667 s** for the one-shot |
| playback | plays **once and HOLDS**. It is a logo build-in, not a spinner, not a cycle |
| render | **1:1** — a 250 px sheet frame in a 250 px box, never upscaled |

**Step it on `transform`, not `background-position`.** Animating
`background-position` over a large sheet forces the browser to re-rasterise the
image on every step, and it stuttered badly — precisely because it runs *while*
the real assets are decoding, competing for the resource this screen exists to
cover. A transform animation cannot drive both axes on one element, so the
**row** walks on a wrapper and the **column** on the strip inside it, with the
clip box carrying `contain: strict`.

**Use `steps(8, jump-none)`, not `steps(8)`.** Plain `steps(n)` divides the
travel into *n*ths while an *n*-column sheet sits on (*n*−1)ths. Every rendered
"frame" then becomes two half-frames side by side, drifting further out of
register each step — which looks garbled and far too fast. `jump-none` yields
exactly *n* stops including both ends, i.e. the real cell grid, and holds on the
last one.

**Keep the sheet small.** A first bake at 4092 × 4092 was 16.7 MP — roughly
67 MB once decoded — for a mark that renders at 250 px. 2000 × 2000 is 4.0 MP and
228 KB: a quarter of the pixels, an eighth of the bytes.

---

## The bar

Ultra-clean: a **236 × 2 px hairline**, `rgba(255,255,255,0.92)` on an
`rgba(255,255,255,0.10)` track, both fully rounded. It breathes on opacity
(0.5 ↔ 0.9 over 1.8 s) and does nothing else — no glow, no gradient, no label.

The frame box carries `margin-bottom: -108px`: the logo's ink ends at 57.8 % of
the frame, so 105 px of the box is transparent tail. 105 dead + 18 px flex gap −
108 px margin leaves a ~15 px optical gap down to the bar.

### ⚠️ The bar may not finish before the logo does

This is the rule, and it is the one that is easy to get wrong.

Progress is **real**, not a timed fake — the width is the settled fraction of the
tracked load jobs. But on a warm cache those settle in a few hundred milliseconds,
so the bar snapped to 100 % while the lockup was still assembling and then just
sat there. It reads as if the game were waiting on nothing.

What is displayed is therefore the **minimum of real progress and the clip's own
playhead**:

```
width      = 6% + 94% * (settledCriticalJobs / totalCriticalJobs)
max-width  = @keyframes 0% → 100% over 4.2667s, linear, fill both
shown      = min(the two)
```

A percentage `max-width` resolves against the track, so the two compose into
exactly `min()` with no extra machinery. Whichever is slower wins, **in both
directions**: the bar can never outrun the logo, and on a cold cache the real
loading still holds it back.

Do this in **CSS**. A per-frame JavaScript clock re-renders on every frame and
competes with the asset decoding this screen exists to cover — the same class of
mistake as animating `background-position`.

---

## Which loads drive the bar

A small tracker wraps the promises for the **critical** assets only:

**Tracked:** symbol textures · static base background · title/logo image · frame
image · the `game` layered-intro set.

**Un-tracked** (fired with `void`, they stream in behind the intro): symbol win
sheets · scatter idle/win sheets · FS background · win-tier marquee art · coin
rain · the fs3/fs4/outro intro sets.

Non-critical assets must never hold the bar back.

---

## Exit

```
fadeStartsAt = max(criticalJobsSettled, LOADER_MS 4267 + BAR_HOLD_MS 280)
               // measured from boot start
→ showGameIntro()          arms the next stage underneath (iris-from-black)
→ opacity → 0 over 0.55s
→ unmount 650 ms later
```

The floor matters as much as the progress does. **Do not tear the screen down on
asset-ready alone** — without it, a warm cache dismissed the loader a few hundred
ms in and the logo was ripped away mid-build. It read as a broken flicker, not a
fast load. The hold guarantees the screen dwells a beat on *finished logo + full
bar* before it goes, and the fade reveals an iris already in progress, so there is
no flash of empty canvas.

A bare build (no theme assets) keeps the same schedule — the loader is branding,
so it plays out either way.

---

## It MUST sit inside the iframe, not over the studio

The overlay is rendered as a child of the **game-canvas container** and passed
down as a `bootScreen` prop, dropped in *inside* the aspect-ratio game box next to
the `<canvas>`, with `position: absolute; inset: 0; zIndex: 30`. It is scoped to
the game box's stacking context, so it covers the game and nothing else. Do **not**
portal it to `document.body` or render it in the studio shell — in the iframe
embedding the studio chrome is the host page and must stay visible.

---

## Settings

| Setting | Value | Meaning |
|---|---|---|
| `background` | `#07070c` | panel backdrop |
| `startFraction` | `0.06` | initial bar width, so it is never empty |
| `criticalJobs` | symbols, bg, title, frame, intro | which loads drive the bar |
| `loaderMs` | `4267` | the logo one-shot; also the bar's clock gate |
| `barHoldMs` | `280` | dwell on "logo standing, bar full" before the fade |
| `fadeDuration` | `0.55 s` | opacity fade of the panel |
| `unmountAfter` | `650 ms` after the fade starts | when the node is removed |
| `barPx` | `236 × 2` | the hairline |
| `mount` | inside the game box | canvas container, `zIndex 30` |

The machine-readable version of all of the above is `feature.json` in this folder.

---

## Render wiring (exact call sites)

**`src/App.tsx`**
- `bootProgress` (starts `0.06`), `bootFade`, `bootGone` React state; `bootStartRef`.
- `track(p)` inside the boot effect: pushes into `bootJobs`, and on settle sets
  `bootProgress = 0.06 + 0.94 * (done / bootJobs.length)`. Only critical loaders
  are wrapped; the rest are `void`-fired.
- `finishBoot()`: `setBootProgress(1)`, then
  `wait = max(0, LOADER_MS + BAR_HOLD_MS - elapsed)`,
  `setTimeout(setBootFade, wait)`, `setTimeout(setBootGone, wait + 650)`.
- Keyframes `boot-loader-row`, `boot-loader-col` (the sheet) and `boot-bar-clock`
  (the bar's gate); `boot-bar-idle` for the breathing opacity.
- `bootScreen` node: opaque panel, opacity toggled by `bootFade`, unmounted on
  `bootGone`.

**`src/ui/GameCanvas.tsx`**
- takes a `bootScreen?: ReactNode` prop and renders it **inside** the aspect-ratio
  game box, immediately after the `<canvas>`.

---

## How to verify it

Sample a fresh boot every ~250 ms and assert two things:

1. **Frame-clean stepping** — every sampled sheet offset is an exact multiple of
   the frame size on *both* axes. A non-multiple means the `steps()` timing is
   off-grid and you are rendering half-frames.
2. **The bar never leads** — the first sample reading 100 % is no earlier than the
   sample in which the sheet reaches its last cell.

Our production run: bar at **94.1 %** while the sheet was on cell `[7,4]`, and
**100 %** on the sample where it reached `[7,7]`.
