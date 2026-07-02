# Feature Adaptation Playbook

How a contributor's rough feature becomes a **drop-in** the dev pastes into the
real generator (`slots_game-main`) and it just works. Extracted from the dev's
own rules: `src/generator/validator/*`, `src/generator/agents/feature.ts`, the
feature-agent skill, `src/registries/ADDING_NEW_ENTRY.md`, `docs/layer-specs/*`,
and the render paths in `src/game/*`.

## The golden rule

A "feature" is a **typed entry appended to the `entries` array** of a
`src/registries/*.ts` file (each file ends with `createRegistry(entries, …)`
which builds the `id → entry` map). An object literal anywhere else is invisible.

"Works when the dev pastes it" =
1. a well-typed entry with a **unique `id`** + correct `implemented` flag, in the
   **correct file's array**;
2. **every other registry id it names** (animation / sound / effect / component)
   also exists as its own entry — a feature never embeds them, it references them
   by id, and the validator runs `registry.get(id)` on each;
3. the **invariants** hold (grid-relative anchors only, no `Math.random()` in
   outcome paths, win FX clear ≤1.5s and cancellable);
4. if the type needs render code, the **function + exact file/function/call-site**
   is provided too (not every entry renders from data alone — see §2).

## 1. Type → registry → required fields → render path

| Type | Registry file | Fields beyond the 5 base | Render path (dev implements) |
|---|---|---|---|
| Symbol/mechanic feature | `baseFeatures.ts` | `category:'symbol'\|'mechanic'`, `affectsMath:boolean`, `bindings:FileBinding[]`, `conflicts:string[]` | math read in `agents/math.ts` (branches on `affectsMath`); render via named anim ids |
| Bonus mechanic | `bonusMechanics.ts` | `triggerCondition:string`, `params:Record<string,ConstraintSet>`, `contractImpact:'none'\|'parameter-change'\|'new-function'` | only `'none'` works on-chain; others = **preview-only V1** |
| Symbol animation | `symbolAnimations.ts` | `state:'idle'\|'landing'\|'win'\|'featured'\|'static'`, `triggerCondition`, `duration`(0–2s), `easing`(GSAP), `repeat`(win=-1) | `AnimatedSymbol.playFallbackState()` — **data-only** for existing states |
| Win presentation | `winPresentation.ts` | `trigger`, `duration`(≤1.5s), `components:string[]` | `ReelSet.buildDecoration` / `src/game/effects/` |
| Grid effect | `gridEffects.ts` | `trigger`, `scope:'full-canvas'\|'full-grid'\|'reel'\|'symbol-row'\|'specific-cells'`, `duration`(0.5–1.5s), `intensity:'subtle'\|'medium'\|'strong'` | `PixiApp.spawnFlash()` / `gsap.to(sceneRoot)` — **data-only** for flash/shake |
| Canvas layer | `canvasLayers.ts` | `zIndex`(unique), `container`(matches buildScene), `blendMode` | `PixiApp.buildScene()` — **needs render code** |
| Win-screen tier | `winScreenTiers.ts` | `minMultiplier`(incl), `maxMultiplier`(excl, `Infinity` top), `components`, `duration` | `WinTierResolver.resolveWinTier` + `PixiApp.playCoinWin` (branches on `tier.id`) |
| Transition | `transitionAnimations.ts` | `from:GamePhase`, `to:GamePhase`, `duration`, `components` | `PixiApp.playTransitionCard` / `showFreeSpinOverlay` |
| Text animation | `textAnimations.ts` | `target:TextAnimationTarget`, `trigger`, `duration`(0.2–2s), `easing`, `repeat` | GSAP tween in `PixiApp.playCoinWin` / `showFreeSpinOverlay` |
| Sound event | `soundEvents.ts` | `event:string`, `trigger`, `loop:boolean`, `priority:'high'\|'medium'\|'low'` | `manager.play(id)` in `useSoundLayer.ts` / `ReelSet.audioHooks`; drop `public/audio/<id>.wav` |

Base fields (all required, non-optional): `id`, `name`, `description`,
`version` (semver), `implemented`. `compatibleGrids?` optional (omit → both).
Imports use `.js` (`from './types.js'`).

## 2. Data-only vs needs-render-code

- **Data-only** (append entry + `implemented:true`, a generic renderer consumes
  it): symbol animations on an existing `state`; grid effects that map to
  `spawnFlash`/`gsap.to(sceneRoot)`; cosmetic base features (`affectsMath:false`);
  bonus mechanics `contractImpact:'none'`; sounds whose `id` matches an existing
  dispatch site; win-tiers reusing an already-branched `tier.id`.
- **Needs render code** (entry + a function at the exact site): new canvas layer
  (`buildScene`); new win-line/sweep (`ReelSet.buildDecoration`); grid effect with
  new motion; transition card; text animation for a new target; **win-tier with a
  NEW id** (must add the id to `isBigPlus/isMegaPlus` in `PixiApp.playCoinWin` AND
  `selectWinSound`); sound with a NEW id (add dispatch + `.wav`).

## 3. What I hand back per feature (drop-in package)

- **(a)** the typed entry(ies) to paste into `src/registries/<file>.ts`, before
  the closing `] as const;` — plus sibling entries for any ids it references.
- **(b)** render-path code (if needed) with the **exact file + function + call
  site**; or "No render code — consumed by `<file:function>`".
- **(c)** any `public/audio/<id>.wav` to drop, and a note if a new chat-param is
  requested (only 7 params are live: `winLineColor, winCoinColor, ambientMotes,
  reelSpeed, backgroundMood, titleColor, winBannerColor`).
- **(d)** a pass/fail validation checklist.

## 4. Adaptation checklist (run on every feature)

1. Correct file + appended to `entries` before `] as const;`, fully-typed literal.
2. All 5 base fields; `id` unique in the file; semver; `implemented` accurate.
3. Union fields use allowed literals; array fields are arrays/records.
4. Every referenced id has its own entry (no dangling `components[]`).
5. Invariants: no `Math.random()` in outcome; win FX ≤1.5s cancellable; grid FX
   0.5–1.5s + reduced-motion guard + `if(!this.isLive) return`; win-tier bands
   non-overlapping half-open `[min,max)`; canvas `zIndex` unique.
6. `affectsMath` correct (false only if purely cosmetic).
7. `contractImpact` reality: flag `'parameter-change'`/`'new-function'` as
   preview-only in V1.
8. Render wiring present if needs-code (function + call site + id-branches).
9. `npx tsc --noEmit` passes.
10. Validator: every referenced id resolves via `registry.get(id)`.
11. Live test: run a spin in the preview and confirm it renders/plays.

## 5. Minimum input I need from you

1. **Type** (one of the 10 above). 2. **When it fires** (deterministic trigger,
not randomness). 3. **What it looks/sounds like** (enough for the type's fields).
4. **Math impact** (base features → `affectsMath`). 5. **Dependencies** (anim/
sound/effect ids it needs). 6. **Conflicts**. 7. **Grid** (5x3/5x5/both).
8. **Rough render code / asset** for needs-code types.

If 2–4 are missing I can't produce a compiling, validator-clean entry — they map
directly to non-optional interface fields.
