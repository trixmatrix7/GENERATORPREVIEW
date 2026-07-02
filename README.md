# Chain Slot — Preview Generator

The **real chain.wtf slot generator runtime, 1:1**, running standalone with the
**Fantasy spec** loaded — plus a small studio drawer for overlay tooling. This is
the environment where new animations/effects/sounds get tested against the dev's
exact code, then exported for the dev to paste into the real generator.

## What is 1:1 (verbatim from `slots_game-main`)

- `src/game/` — PixiApp, ReelSet, Reel, AnimatedSymbol, symbolMetrics,
  SymbolAtlasLoader, lucideIcon, WinTierResolver (the entire render core;
  GameCanvas has one permitted edit: an optional `config` prop, the same
  pattern as the wizard's PixiPreviewPanel)
- `src/registries/` — all 14 typed registries with the dev's real entries
- `src/config/` — gridConfig, symbols, symbolAnimations, canvasTheme(+neon),
  themes, adjustableParams **+ the Fantasy spec stamped in**
  (reels/paytable/gameConfig are the ZIP's generated files — exactly how the
  generator deploys a game; the grid auto-derives 5×5 from `VISIBLE_ROWS`)
- `src/engine/` — GameConfig, SlotEngine, WinEvaluator, holdAndWin, anchors
- `src/state/` — GameStateMachine + types
- `src/audio/` — SoundManager (Howler), defaultSoundConfig, useSoundLayer + the
  dev's audio assets in `public/audio/`
- `src/ui/` — the real in-game Sidebar (HUD), GameCanvas, SpinButton, BetInput,
  AudioControl, RecentBets
- `src/dev/` — the dev's own MockHost + WinTierTestPanel (their harness test
  surface — Small/Normal/Big/Mega Win, Hold & Win buttons)
- `src/hooks/useGameState.ts`, `src/bridge/types.ts`, `src/styles/globals.css`

**Not ported** (per scope): `src/server`, `src/generator` (pipeline + agents),
chat parsers, penpal bridge (`bridge/guest`, `useHostBridge`), i18n
(shimmed to English — `src/shims/react-i18next.tsx` mirrors `en.json`).

## Preview-only additions (clearly separated in `src/studio/`)

- **Studio drawer** (bottom-right button): the dev's 7 adjustable params via
  `applyVisualParam` (live) · background swap via `setBackgroundImage` (dev API)
  · **Add (code)**: paste a registry entry → validated against the dev
  interfaces, saved verbatim · **Export**: any real registry entry or your
  custom one as a drop-in `src/registries/` snippet — custom entries export
  **byte-for-byte lossless**.
- `visibilityTicker` — keeps GSAP running in hidden tabs (test environments).

## Run / deploy

```bash
npm install
npm run dev        # standalone (MockHost) — the dev's harness experience
npm run build      # typecheck + vite build → dist/
```

Vercel: push → import repo → framework Vite (vercel.json is set; `/assets/` and
`/audio/` are excluded from the SPA rewrite so atlas HEAD-probes work).

## The workflow

1. Vibe-code a feature (animation/effect/sound entry) → paste into
   **Studio → Add (code)** → it validates against the dev's exact registry
   interfaces and is saved verbatim.
2. Test against the real runtime (dev test panel + spins + params).
3. **Studio → Export** → copy/download the snippet → the dev pastes it into the
   matching `src/registries/*.ts` in the real generator. Zero quality loss.

The spec/math (reels, paytable, contract parity) is never modified from the
studio — changing the game means stamping a new generated config set, exactly
like the generator itself does.
