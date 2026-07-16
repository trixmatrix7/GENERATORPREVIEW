# Feature Handoff Index

Each subfolder here is one **self-contained, theme-agnostic** feature the dev's generator can rebuild from. *Vice Heat* is only the reference skin — every feature is described universally (driven by grid/scatter/reel state, not by any Vice-specific art), and each doc carries a settings table plus a `feature.json` snippet the generator can consume.

## Features

| Feature | One-liner |
|---|---|
| [`expanding-wild/`](./expanding-wild/) | A landed wild expands to fill its whole reel with a tower graphic and acts wild for the full column. |
| [`expanding-sticky-wild/`](./expanding-sticky-wild/) | Expanded wilds stay locked in place across subsequent (free) spins, re-presented each spin without re-rolling the math. |
| [`win-marquees/`](./win-marquees/) | Tiered win banners (WIN → BIG → MEGA → EPIC → MAX) with layered art + number plate; music ducks the ambient bed under the fanfare. |
| [`coin-rain/`](./coin-rain/) | Chroma-keyed coin-shower spritesheet that rains over the board on big-tier wins (3 sheets × 10×10 = 300 frames @ 45 fps). |
| [`tease-camera/`](./tease-camera/) | True POV dolly: the whole world (background included) pushes toward the machine centre in gated steps during a scatter tease; bounces out on a miss, locks on a hit. |
| [`frame-win-flash/`](./frame-win-flash/) | The reel frame lights up via a chroma-matted spritesheet the instant the trigger scatter lands, pixel-aligned to the frame art via a region crop. |
| [`symbol-sheets/`](./symbol-sheets/) | Per-symbol idle-loop and win spritesheets that render on the cell's exact footprint, with STATIC_LOOK / NO_IDLE opt-out guards. |
| [`boot-loader/`](./boot-loader/) | In-iframe loading screen that fills a progress bar over the real settle-count of the critical asset loads, then cross-fades into the intro. |

## How the generator consumes a feature.json

Each `feature.json` mirrors the **registry-entry shape** in `src/registries/*.ts`. Every registry file is a typed array ending in `createRegistry(entries, …)`, which builds an `id → entry` map; a feature becomes real by being appended to the correct file's `entries` array before `] as const;`.

**Base fields (on every entry, from `src/registries/types.ts`):**

| Field | Meaning |
|---|---|
| `id` | Unique within its registry file (the map key). |
| `name` | Human label. |
| `description` | What it does. |
| `version` | Semver. |
| `implemented` | `true` = live and renderable; `false` = stub. |
| `compatibleGrids?` | `['5x3','5x5']`, subset, or omitted (= all grids). |

**Then a type discriminator picks the registry + adds type-specific fields**, e.g.:
- `grid-effect` → `gridEffects.ts` — adds `trigger`, `scope` (`full-canvas`/`full-grid`/`reel`/`symbol-row`/`specific-cells`), `duration`, `intensity`. (tease-camera, frame-win-flash)
- `symbol-animation` → `symbolAnimations.ts` — adds `state`, `trigger`, `duration`, `easing`, `repeat`. (symbol-sheets)
- `win-presentation` → `winPresentation.ts` — adds `trigger`, `duration`, `components[]`. (win-marquees)
- `base-feature` → `baseFeatures.ts` — adds `category`, `affectsMath`, `bindings[]`, `conflicts[]`. (expanding-wild, sticky-wild)

**Consumption rules the generator enforces** (see `../../FEATURE_ADAPTATION.md`):
1. The entry lands in the correct registry file's array with a unique `id` and accurate `implemented`.
2. Every other registry id it references (animation / sound / effect / component) resolves via `registry.get(id)` — a feature references siblings by id, never inlines them.
3. Invariants hold: grid-relative anchors only, no `Math.random()` in outcome paths, win FX clear ≤ 1.5 s and cancellable, grid FX carry a reduced-motion guard and a live-app check.
4. `affectsMath` is `false` for anything purely cosmetic (all five docs in this batch are cosmetic/presentation, not RTP-affecting).

The extra keys in each `feature.json` here (`settings`, `asset`, `winSheets`, `region`, etc.) are the concrete render parameters the generator wires into the matching `PixiApp` / `ReelSet` call sites named in each feature's README — the declarative mirror of the imperative wiring in `src/App.tsx` (see also the export shape in `src/studio/buildPresets.ts::buildExportPreset`).
