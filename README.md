# Chain Slot — Preview Generator

A **deploy-ready preview studio** that re-implements the chain.wtf slot generator's
runtime — stripped down to just the slot window — so animation presets and effects can
be tested against the dev's spec, then copy-pasted into the real generator.

Built strictly from two sources:

- **`CONTRIBUTOR_PROMPT.md`** (the dev's architecture contract) — the 12-layer compose
  order, typed registries, render-path layout, hard invariants, Pixi v8 + GSAP stack.
- **The Fantasy Slots spec ZIP** — reels, paytable, the `SlotGame.sol` math, audio
  manifest. The TS engine mirrors `SlotGame.sol` byte-for-byte (verified).

> It does **not** include the chat-config parser, the generation pipeline, or any of
> the personal Chain Games presets. Those get pasted in later via the **Add entry (code)**
> panel and, once they look right, copy-pasted by the dev into the real generator.

---

## Stack

Vite + React + TypeScript + **PixiJS v8** + GSAP + pixi-filters — the same stack as the
dev generator, so registry entries authored here drop straight in.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build → dist/
npm run preview  # serve the built bundle
```

## Deploy to Vercel

This is a standard Vite app; `vercel.json` is already set (`vite build` → `dist`).

1. Create a GitHub repo and push this folder (see "First push" below).
2. On Vercel → **Add New Project** → import the repo.
3. Framework preset auto-detects **Vite**. Build = `vite build`, output = `dist`.
4. Deploy. Every push to the repo auto-redeploys — that's how you + your colleague
   share the live preview and "vibe-code" together.

### First push (once you have the GitHub repo URL)

```bash
git init
git add -A
git commit -m "Preview generator"
git branch -M main
git remote add origin <YOUR_GITHUB_URL>
git push -u origin main
```

(An initial commit is already made, so you can skip straight to `git remote add` + `git push`.)

---

## Frozen spec ↔ overlay (the core rule)

The **spec is immutable**. The Fantasy math/contract — reels, paytable, ways evaluation,
free spins, hold & win — lives in `src/engine` + `src/config` and is **deep-frozen at load**
(`src/spec/index.ts`). Presets, the code panel, and every "overlay" category can only
**read** it; they can never edit it. Changing the actual game math means importing a new
spec (a new ZIP from the dev), not an overlay edit. The header shows a **🔒 spec frozen** badge.

Everything else is the **overlay** — swappable presets **and** pasteable code, all adapting
to the frozen spec:

| Overlay category | What you swap | Add your own via |
|---|---|---|
| **Animation preset** | the 4 symbol states + effects + params | Presets + code panel (`symbolAnimations`) |
| **Spin system** | how the board animates in (Drop · Reel Spin · Slam · Fade) | Systems selector + code panel (`spinSystems`) |
| **Win presentation** | how wins reveal (Sequential ways ↔ All-at-once) | Systems selector + code panel (`winPresentation`) |
| **Sound set** | Full / Minimal / Off | Systems selector + code panel (`soundEvents`) |
| **Effects, win screens, themes, transitions, text** | any layer entry | code panel (the matching registry) |

So: you vibe-code anything — a spin system, a win-line presentation, a sound, an animation —
paste it into **Add entry (code)**, and it's parsed → applied live → saved, **without ever
touching the spec**. Then the dev copy-pastes the entry into the real generator.

## How the studio works

- **SPIN / scenario buttons** — run deterministic outcomes (the engine mirrors the
  contract). Scenarios: Ways Win, Free Spins, Near Miss, Big/Mega Win, Hold & Win,
  Bonus Buy. Seed-driven, so every outcome is reproducible (replay from the Inspector).
- **Animation states (4)** — Idle-glow · Landing · Win-juice · Win-reset. Toggle, swap
  easing, scale speed/strength per state.
- **Presets** — Fantasy Default / Snappy / Cinematic / Minimal, plus **Save current as…**
  to persist your own. Presets bundle params + the 4 state configs + effect toggles.
- **Parameters** — live sliders (spin speed, drop timing, win pop, glow, shockwave,
  sweat slow-mo, celebration intensity).
- **Effects** — police lights, scatter orbit, sweat columns, win shockwave, win screens,
  anticipation siren.
- **Grid** — switch **5×5 (3125 ways)** ↔ **5×3 (243 ways)**. Every effect is
  grid-relative (anchors, never raw px) so it works on both.
- **Add entry (code)** — paste a typed registry entry as code. It's **parsed, applied
  live, and saved** (persisted to your browser). Same `id` overrides a default. Each
  saved entry can be copied back out verbatim for the dev. This is the shared
  authoring surface — hand a snippet to your colleague, they paste it, it's saved.

Everything you change (preset, params, grid, theme, saved entries, your name) is saved
to `localStorage` and restored on reload. The persistence layer
(`src/store/useStudio.ts`) is abstracted so a shared backend (Vercel KV / Supabase) can
replace it later for real-time multi-user sync without touching components.

---

## Project layout (mirrors the dev generator for copy-paste compatibility)

```
src/
  config/        symbols · gridConfig · gameConfig · canvasTheme · adjustableParams
  engine/        deterministic math — mirrors SlotGame.sol
    reels · paytable · ways · holdAndWin · spin · rng · anchors · scenarios
  registries/    the typed-registry contract + default entries (per layer) + presets
    types.ts · index.ts · presets.ts · parseEntry.ts · entries/*.ts
  game/          Pixi v8 render paths
    PixiApp (buildScene/compose) · ReelSet · AnimatedSymbol (4 states) · effects/ ·
    banners · particles · textures · filters · controller
  audio/         SoundManager (procedural Web-Audio cues)
  store/         useStudio (persisted) · useRuntime · derive
  ui/            Studio · StageCanvas · Controls · CodePanel
public/          game.manifest.json · audio/manifest.json  (from the spec)
```

## Engine ↔ contract parity

`src/engine` is a faithful port of `SlotGame.sol` (verified live): `deriveStops`
(`seed % 40` chain), `buildBoard`, ways evaluation (`_evaluateWins`, wild→HIGH_A fold,
left-to-right ways), free spins (18 / ×18 / cap 50, retriggers), and Hold & Win
(`_playHoldAndWin`, keccak draws via `viem`). At 5×5 it matches the contract exactly;
5×3 is the same algorithm at 3 rows (a test layout — note the math profile differs).

> The Fantasy reel strips contain no COIN symbol, so Hold & Win can't arise from a strip
> spin on-chain — the **Hold & Win** test button injects coins purely to preview that
> animation (clearly flagged in `engine/scenarios.ts`).
