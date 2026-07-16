# Vice Heat — dev handoff package

Everything the generator needs to **rebuild this slot** — cleaned, documented,
and split into universal, addable features. Vice Heat is the reference skin;
every **feature** and **flow** here is theme-agnostic and works in any game.

> Built from the live studio (https://generatorpr.vercel.app). Old/unused files
> (dropped dancers, superseded backgrounds, legacy sheets) are removed. All
> audio is **OGG** — no wav/mp3. No video — every animation is a **spritesheet**.

## What's in the box

```
dev-handoff/
├─ README.md                 ← you are here (master index)
├─ vice-heat.preset.json     ← the one declarative file the generator loads
├─ FLOW.md                   ← the full presentation pipeline + every transition
├─ ASSET_SPECS.md            ← spritesheet/symbol dimensions, 5x5 vs 5x3, auto-crop
├─ features/                 ← each feature = self-contained, universal, addable
│  ├─ README.md              ← feature index
│  ├─ expanding-wild/        ← "add one image" wild-reel expansion
│  ├─ expanding-sticky-wild/ ← the sticky variant (towers persist the round)
│  ├─ win-marquees/          ← tiered win celebration (universal, + music)
│  ├─ coin-rain/             ← coin-rain overlay
│  ├─ tease-camera/          ← POV-dolly anticipation
│  ├─ frame-win-flash/       ← frame lights up on trigger
│  ├─ symbol-sheets/         ← per-symbol idle + win spritesheets
│  └─ boot-loader/           ← in-iframe loading screen
├─ flow/
│  └─ intro-screens/         ← custom intro/outro screens (game/fs3/fs4/outro)
├─ math/
│  ├─ RTP_VERIFICATION.md    ← reproduce & check the ~96% RTP
│  ├─ MATH_MODEL.md          ← the model + the 7 contract rules for the dev
│  ├─ simulate_vice_heat.py  ← reference MC simulator
│  └─ vice_heat_expanding.json ← the certified manifest the runtime consumes
└─ assets/                   ← drop into the generator's public/
   ├─ audio/                 ← *.ogg + sound-pack README
   ├─ introLayers.json       ← intro-screen layer layout
   └─ theme/{vice,win-tiers}/← spritesheets, symbols, frame, backgrounds, intros
```

## How the generator consumes this

1. **Assets:** copy `assets/audio/*` → `public/audio/`, `assets/theme/*` →
   `public/theme/`. Every path in the preset + docs is already public-relative.
2. **Preset:** load `vice-heat.preset.json`. It wires the grid, math manifest,
   every asset (with sheet geometry), the audio map, the feature list, and the
   flow — the same shape the studio's "Export Build" emits.
3. **Math:** the runtime reads `math/vice_heat_expanding.json`. Verify it with
   `math/RTP_VERIFICATION.md` before wiring the contract side (7 settlement
   rules in `math/MATH_MODEL.md`).
4. **Features & flow:** each `features/<x>/` is independent — turn it on/off in
   the preset's `features` block. `FLOW.md` is the ordered pipeline; each stage
   (boot → intro → base → tease → FS intro → FS → win marquees → outro) is
   addable/removable and says whether the control bar is visible.

## The game at a glance

- **5×5, 3125 ways**, all symbols pay from 3-of-a-kind. Alt grid **5×3**.
- **~96% RTP** (house-positive, industry-standard), hit 69.3%, hard **5000×**
  max-win cap. Pay floor 0.077× ($0.02 on 20¢). Full numbers in
  `math/RTP_VERIFICATION.md`.
- **Tiered free spins:** 3 scatters = **7** spins (per-spin expanding wilds);
  4 scatters = **10** sticky spins (towers persist). Max win via the 3-scatter
  simul-×10 spike.
- **Presentation:** living intro screens, POV-dolly tease, per-cell scatter win,
  frame flash, iris transitions, tiered win marquees with theme-neutral music,
  a count-up TOTAL WIN outro. All spritesheet-driven, mobile-playable.

## Still iterated in the studio

Per Noski: the **custom intro screens** and **spritesheets** keep being refined
in the studio — the current versions are included here as the Vice Heat preset
so they auto-load, and `ASSET_SPECS.md` + `flow/intro-screens/` document the
format so updated art drops straight in.
