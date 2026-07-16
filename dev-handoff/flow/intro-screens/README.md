# Feature: Custom Intro / Outro Screens (layered, element-centred)

A drop-in feature that adds **full-canvas breathing intro/outro screens** to any
generator-stamped slot: a game start screen, tiered free-spins intros, and a
total-win outro. It is **theme-agnostic** — "Vice Heat" is only the reference
skin. Every screen is a set of **pre-cropped, element-centred image layers**
placed in a fixed **1920×1080 design space**; the runtime cover-fits the design
space to the canvas and animates each layer according to its **role**.

**Sources:** `src/data/introLayers.json` (the layer sets) and
`src/game/PixiApp.ts` → `setLayeredIntro()` (loader) + `buildLayeredIntroScene()`
(assembler). This feature is consumed by the flow stages `game-intro`,
`fs-intro` (`fs3`/`fs4`), and `total-win-outro` — see `../../FLOW.md`.

---

## Why layered + element-centred (not one flat image)

Each visual element is exported as its **own transparent PNG/WEBP, already
cropped and centred on its art**, and positioned by a **centre point** (`cx`,
`cy`) in the 1920×1080 design space (plus an optional target width `tw`). This
is what lets the runtime breathe individual elements independently.

The critical rule (Noski): **only logos and symbols float; text and cards stay
static.** Floating or in-place-scaling upscaled text/card art makes it "warp
into itself" (`verzieht sich in sich`) — the pixels shimmer and captions drift
out of their card boxes. So captions and card plates are pinned as an anchor,
and only the hero art moves.

---

## Layer roles

| Role | Motion | Notes |
|------|--------|-------|
| `bg` | **Slow zoom + pan** (cover-fit) | Rest scale `s0*1.018`; breathe scale →`*1.028` (5.5 s), x drift ±12 (8 s), y drift ±6 (6.3 s), all yoyo `sine.inOut`. In the **`game`** set the `bg` layer is **skipped** — the live animated base-game background shows through instead. |
| `card` | **STATIC** | Anchors the composition; captions ride on it, so it must not drift. |
| `logo` | **Floats** | y −10 (2.6 s), scale →`*1.05` (3.4 s), rotation 0.008 (3.1 s), yoyo. The **widest logo** becomes the **hero**: stronger sway (rotation 0.022, 3.3 s, `overwrite:'auto'`) + x drift +6 (4.7 s). |
| `symbol` | **Floats (whole object only)** | y −9 (2.6 s) yoyo, random phase. **No scale/rotation** — in-place warping pixelates upscaled art. |
| `text` | **STATIC** | Captions/wordmarks — static so they never warp or leave their card box. |
| `press` | **Pulses** | alpha 0.9→0.34 (0.85 s) + scale →`*1.05` (0.85 s), yoyo — the "press to continue" heartbeat. |
| *(any other)* | **STATIC** | Treated as deco/text. |

**Scale math:** a layer's base scale is `s0 = tw / texture.width` when `tw` is
set, else `1`. All breathing scales stay **relative to `s0`** so nothing ever
pops to full texture size. Each sprite is `anchor 0.5`, positioned at
`(cx − 960, cy − 540)` inside the foreground root, and `eventMode:'none'` (taps
fall through to the overlay's full-canvas dismiss handler).

---

## Fitting: desktop cover-fit vs compact/mobile band-fit

`buildLayeredIntroScene` builds two roots:

- **`bgRoot`** — cover-fits the design space: `scale = max(sw/1920, sh/1080)`
  (cropping allowed; the bg rests slightly above cover so drift never exposes an
  edge).
- **`fgRoot`** — **contain-fits** so nothing (especially `press`) ever crops:
  `scale = min(sw/1920, sh/1080) * 0.98`.

**Compact / mobile band-fit** (`sw < 520`): a full-width contain-fit would
shrink the cards to ~0.19 on a portrait phone. Instead the fg fits the **card
band**:
- `game` (a 3-across band ≈ 1160 design-px of real content):
  `min((sw*0.98)/1160, (sh/1080)*1.4)`, and the band is nudged up
  `fgRoot.y = -52 * scale` so the enlarged cards stay vertically centred.
- `fs3` / `fs4` / `outro` (a single centred card): gentler
  `min((sw*0.98)/1500, (sh/1080)*1.4)` (a full band-fit would crop their sides).

---

## The four sets

All four live in `introLayers.json`, keyed by set name; the loader prefixes each
`file` with `import.meta.env.BASE_URL` before `Assets.load`.

| Set | Used by (flow stage) | Composition | bg layer? |
|-----|----------------------|-------------|-----------|
| `game` | Game intro (Stage 2) | Hero title logo + a **3-card feature band** (e.g. STICKY / BONUS / MAX), each card carrying its own logo/symbol/text, + a `press` prompt | **Omitted at runtime** — live base bg shows through; a 0.35 black scrim aids legibility |
| `fs3` | FS intro when scatters = 3 | Single centred card + logo + scatter `symbol` + `text` + `press` over its own `bg` | Yes |
| `fs4` | FS intro when scatters ≥ 4 | Same layout as `fs3`, the 4-scatter (sticky-tier) variant | Yes |
| `outro` | TOTAL WIN outro (Stage 8) | TOTAL WIN wordmark (`logo`) + `press` over the club `bg`; the runtime injects the **counting-up amount** into the content root | Yes |

> The `game` set is loaded **critically** (tracked in the boot progress bar); the
> `fs3`/`fs4`/`outro` sets load in the background (`void`) so they never block
> first paint. The runtime falls back gracefully when a set is missing
> (FS iris → plain text; outro → `playExitIris`).

---

## JSON schema

`introLayers.json` is an object keyed by set name; each value is an **ordered
array of layer definitions** (draw order = array order, first = back):

```json
{
  "$schema-note": "design space is fixed 1920x1080; cx/cy are the element's CENTRE",
  "<setName>": [
    {
      "file": "theme/<skin>/intro/<set>/<element>.webp",
      "role": "bg | card | logo | symbol | text | press",
      "cx": 960,
      "cy": 540,
      "tw": 300
    }
  ]
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `file` | string | yes | Path relative to the public base URL; a pre-cropped, transparent, element-centred PNG/WEBP. |
| `role` | enum | yes | `bg` \| `card` \| `logo` \| `symbol` \| `text` \| `press` — drives the motion (table above). |
| `cx` | number | yes | Element centre X in the 1920-wide design space. |
| `cy` | number | yes | Element centre Y in the 1080-tall design space. |
| `tw` | number | no | Target width in design px; sets base scale `tw / texture.width`. Omit to use the texture at native size (`scale 1`). |

Runtime loader signature (`PixiApp.setLayeredIntro`):

```ts
setLayeredIntro(
  kind: 'game' | 'fs3' | 'fs4' | 'outro',
  defs: Array<{ file: string; role: string; cx: number; cy: number; tw?: number }>,
): Promise<void>
```

### Minimal example (a new one-card FS intro)

```json
{
  "fs3": [
    { "file": "theme/aztec/intro/fs3/bg.webp",    "role": "bg",     "cx": 960, "cy": 540 },
    { "file": "theme/aztec/intro/fs3/card.webp",  "role": "card",   "cx": 960, "cy": 544 },
    { "file": "theme/aztec/intro/fs3/logo.webp",  "role": "logo",   "cx": 960, "cy": 232 },
    { "file": "theme/aztec/intro/fs3/glyph.webp", "role": "symbol", "cx": 960, "cy": 472, "tw": 296 },
    { "file": "theme/aztec/intro/fs3/text.webp",  "role": "text",   "cx": 960, "cy": 711 },
    { "file": "theme/aztec/intro/fs3/press.webp", "role": "press",  "cx": 960, "cy": 972 }
  ]
}
```

---

## How to add a new intro screen

1. **Author the elements.** Export each visual element as its own transparent
   PNG/WEBP, **cropped tight and centred on its art**. Split anything that
   should move (logos, symbols) from anything that must stay crisp (text,
   cards). Design everything against a **1920×1080** canvas.
2. **Drop the files** under `public/theme/<skin>/intro/<set>/` (or reuse an
   existing background such as the FS bg for an outro).
3. **Add an `introLayers.json` entry** under a new/existing set key, one object
   per element: set `role`, measure each element's **centre** into `cx`/`cy`,
   and add `tw` where you want a fixed target width. Order the array back→front.
4. **Wire it in the boot effect** (`App.tsx`): map the set through the base-URL
   prefix and call `pixiAppRef.setLayeredIntro('<set>', mapSet(introLayers.<set>))`.
   Use `track(...)` if it must gate first paint (like `game`), or `void` to load
   it in the background (like `fs3`/`fs4`/`outro`).
5. **Trigger it** from the matching flow stage: the `game` set auto-shows via
   `showGameIntro`; `fs3`/`fs4` are chosen by scatter count in
   `playFreeSpinsIris`; `outro` is played by `playFreeSpinsOutro`. To add a
   brand-new screen, call `buildLayeredIntroScene('<set>', sw, sh, tweens)` and
   mount it under an iris overlay following the pattern in `../../FLOW.md`.

**Role checklist when composing:** put the big wordmark as a `logo` (it auto-
becomes the hero and sways); make feature icons `symbol` (they float as whole
objects); keep every caption/number as `text` and every plate as `card` so they
stay pin-sharp; add exactly one `press` for the tap-to-continue heartbeat; add a
`bg` for FS/outro screens but omit it for a `game`-style screen that should let
the live background show through.
