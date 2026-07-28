# Feature Handoff Index

Each subfolder here is one **self-contained, theme-agnostic** feature the dev's generator can rebuild from. *Vice Heat* is only the reference skin — every feature is described universally (driven by grid/scatter/reel state, not by any Vice-specific art), and each doc carries a settings table plus a `feature.json` snippet the generator can consume.

Two kinds of package live here. **Behaviour & asset features** are documented
(README + `feature.json`) — the generator rebuilds them from its own registries
using the settings + geometry given. **Drop-in code modules** ship the *actual
runtime `.ts`* plus a 2–3-hook integration guide — copy the file in 1:1 and wire
the named hooks. Both are theme-agnostic and RTP-neutral (purely presentational).

## Behaviour & asset features (README + feature.json)

| Feature | One-liner |
|---|---|
| [`expanding-wild/`](./expanding-wild/) | A landed wild expands to fill its whole reel with a tower graphic and acts wild for the full column. **Add one image** — dims + auto-crop for 5×5 and 5×3 in the README. |
| [`expanding-sticky-wild/`](./expanding-sticky-wild/) | Expanded wilds stay locked in place across the free-spins round (towers accumulate, cap **5**), **sticky from the moment they land — they must stay standing while the other reels roll**; same visuals/sounds as expanding-wild. |
| [`tower-multipliers/`](./tower-multipliers/) | Each fully-wild reel carries a ×1–×5 badge; a win pays × the **highest** badge it crosses. **This carries the free-spins RTP.** ⚠️ Draw the badges from a reserved seed namespace or every certified number breaks. |
| [`win-marquees/`](./win-marquees/) | Tiered win banners (WIN → BIG → MEGA → EPIC → MAX) with layered art + number plate; theme-neutral music ducks the ambient bed under the fanfare. |
| [`coin-rain/`](./coin-rain/) | Chroma-keyed coin-shower spritesheet that rains over the board on big-tier wins (3 sheets × 10×10 = 300 frames @ 45 fps). |
| [`tease-camera/`](./tease-camera/) | True POV dolly: the whole world (background included) pushes toward the machine centre in gated steps during a scatter tease; bounces out on a miss, locks on a hit. |
| [`frame-win-flash/`](./frame-win-flash/) | The reel frame lights up via a chroma-matted spritesheet the instant the trigger scatter lands, pixel-aligned to the frame art via a region crop. |
| [`symbol-sheets/`](./symbol-sheets/) | Per-symbol idle-loop and win spritesheets that render on the cell's exact footprint, with STATIC_LOOK / NO_IDLE opt-out guards. |
| [`boot-loader/`](./boot-loader/) | ⚠️ **MISSING FROM THE DEV BUILD — and it is stage 1 of the flow.** The CHAIN GAMES logo builds in from a spritesheet while a hairline bar tracks the real settle-count of the critical asset loads; the bar **can never top out before the logo has finished**. **Universal platform branding**, identical in every game — not a per-game skin. |
| [`paylines/`](./paylines/) | Classic 10-line PAYLINES pay model (alternative to ways): leftmost-consecutive, wilds substitute, one clean line per win — plus the Crack Farm roaming-plant / sticky-plant-multiplier free-spins features. *(README only — this one is not part of Vice Heat and carries no `feature.json`.)* |

## Drop-in code modules (real `.ts` + integration guide)

| Feature | One-liner |
|---|---|
| [`round-core/`](./round-core/) | ⭐ **The highest-value file here.** `viceSpin.ts` — the pure, seed-derived function that decides a whole round (board, expansions, sticky towers, ×N badges, free spins, credited total). Settlement, display and the certifying simulator all call **this same function with the same seed**, which is what makes a display/payout mismatch structurally impossible. Also carries the reserved-seed-namespace rule and the exact BigInt max-win test. |
| [`win-line/`](./win-line/) | The white **ways-light comet** — a light beam shoots through each ways-connection, line-by-line. `WaysLightComet.ts` drops in 1:1 (needs 2 hooks: `cellCentre`, a top container). |
| [`frame/`](./frame/) | Procedural neon **frame band** (colour-tunable) for when no frame image is supplied — the bare-scaffold frame. |
| [`cell-backdrop/`](./cell-backdrop/) | Per-cell backing panels behind the symbols (colour + integration params). |
| [`reel-background/`](./reel-background/) | Tint/wash behind the reel window. |
| [`fs-background/`](./fs-background/) | Free-spins background swap hook. |

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
