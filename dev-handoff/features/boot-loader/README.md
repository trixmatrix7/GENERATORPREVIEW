# Boot Loader — in-iframe loading screen with real progress

**Type:** UI / lifecycle (needs render code) · **Grids:** any · **Theme-agnostic.**

Reference skin: *Vice Heat* (a neon wordmark + pink→cyan bar). The mechanic is universal: a loading overlay that sits **inside the game box** and reports **real** progress over the critical asset-load jobs, then cross-fades straight into the game intro.

---

## What it is

When the generator embeds a built game, it renders it in an **iframe** (the game box). This loader is the first thing shown *inside that box* — never over the studio/host chrome around it. It covers the game area with an opaque panel (title + progress bar + "LOADING"), fills the bar as the **critical** theme visuals actually finish loading, holds at 100% for a beat, then fades out. Underneath, the game's intro (iris-from-black) has already begun, so the handoff is seamless with no flash of empty canvas.

Progress is **real**, not a timed fake: the bar width is the fraction of *tracked* load jobs that have settled.

---

## How progress is computed

A small tracker wraps the promises for the **critical** assets only. Non-critical assets (win sheets, free-spins art, animation loops) are fired in parallel **un-tracked** so they never hold the bar back — they stream in behind the intro.

```
bootProgress starts at 0.06        // a sliver, so the bar is never empty
track(p):  bootJobs.push(p)
           on settle → done++
           bootProgress = 0.06 + 0.94 * (done / bootJobs.length)
```

**Tracked (critical) in the reference build:** symbol textures, base background (static), title/logo, frame image, and the game intro layers. Everything else (`setSymbolWinSheet`, FS background, coin rain, marquee art, idle sheets) is `void`-fired, not tracked.

**Handoff on `Promise.all(bootJobs)`:** show the game intro, snap the bar to `1`, then after `180 ms` set `bootFade = true` (opacity → 0 over `0.55 s`), then after `180 + 650 ms` set `bootGone = true` (unmount the node).

**Bare build** (naked scaffold, no theme assets): skip straight to `progress = 1`, fade after `150 ms`, unmount after `800 ms`.

---

## It MUST sit inside the iframe, not over the studio

The overlay node is rendered as a child of the **game-canvas container** and passed down as a `bootScreen` prop, dropped in *inside* the aspect-ratio game box (next to the `<canvas>`), with `position: absolute; inset: 0; zIndex: 30`. It is scoped to the game box's stacking context, so it covers the game and nothing else. Do **not** portal it to `document.body` or render it in the studio shell — in the generator's iframe embedding, the studio chrome is the host page and must stay visible.

---

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `startFraction` | `0.06` | Initial bar width (never empty) |
| `criticalJobs` | symbols, bg, title, frame, intro | Which loads drive the bar |
| `holdBeforeFade` | `180 ms` | Hold at 100% before fading |
| `fadeDuration` | `0.55 s` | Opacity fade of the panel |
| `unmountAfter` | `180 + 650 ms` | When the node is removed |
| `bareBuildFade` / `bareBuildUnmount` | `150 ms` / `800 ms` | Fast path when there are no theme assets |
| `title` | game name | Wordmark shown while loading |
| `barColors` | brand gradient | Progress-fill gradient |
| `background` | `#07070c` | Panel backdrop |
| `mount` | inside game box | Rendered in the canvas container, `zIndex 30` |

### feature.json

```json
{
  "id": "boot-loader",
  "name": "In-Iframe Boot Loader",
  "description": "A loading overlay rendered INSIDE the game box (not over the studio/host) that fills a progress bar over the real settle-count of the critical asset-load jobs, holds at 100%, then cross-fades straight into the game intro. Non-critical assets load un-tracked behind it.",
  "version": "1.0.0",
  "implemented": true,
  "type": "ui-lifecycle",
  "settings": {
    "startFraction": 0.06,
    "holdBeforeFade": 180,
    "fadeDuration": 0.55,
    "unmountAfter": 830,
    "bareBuildFade": 150,
    "bareBuildUnmount": 800,
    "criticalJobs": ["symbols", "background", "title", "frame", "intro"],
    "background": "#07070c",
    "mount": "inside-game-box",
    "zIndex": 30
  }
}
```

---

## Render wiring (exact call sites)

**Progress + lifecycle state — `src/App.tsx`:**
- `bootProgress` (starts `0.06`), `bootFade`, `bootGone` React state.
- `track(p)` helper inside the boot effect: pushes into `bootJobs`, on settle sets `bootProgress = 0.06 + 0.94 * (done / bootJobs.length)`. Only critical loaders are wrapped in `track(...)`; the rest are `void`-fired.
- `Promise.all(bootJobs).then(...)` → `showGameIntro(...)`, `setBootProgress(1)`, `setTimeout(setBootFade, 180)`, `setTimeout(setBootGone, 180 + 650)`.
- Bare-build early return: `setBootProgress(1)` + `setTimeout(setBootFade, 150)` + `setTimeout(setBootGone, 800)`.
- `bootScreen` node: `position:absolute; inset:0; zIndex:30`, opaque panel, opacity toggled by `bootFade`, unmounted when `bootGone`.

**Mount point — `src/ui/GameCanvas.tsx`:**
- `GameCanvas` takes a `bootScreen?: ReactNode` prop and renders `{bootScreen}` **inside the aspect-ratio game box**, immediately after the `<canvas>` — so it is clipped to the game area and layered above it, never over the surrounding studio UI.

---

## How to add it to a new game

1. Keep a `bootProgress/bootFade/bootGone` triple in the game shell.
2. Wrap only the **critical** asset promises in a `track()` that recomputes `bootProgress` from settled-count; fire everything else un-tracked.
3. On `Promise.all` of the tracked jobs, start the intro underneath, snap to 100%, then fade + unmount on the two timeouts.
4. Render the overlay as a child of the canvas container (a `bootScreen` prop), **inside** the game box — never portalled to the host page.
