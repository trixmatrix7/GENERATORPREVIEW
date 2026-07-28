# Conformance — nothing but this

Every other document here says what to **add**. This one says what must **not be
there**, because that is what actually went wrong in the last build: our sound
system was missing entirely, the generator's own gold marquee showed up instead
of ours, its default win-line look was drawn over a ways game, and a bonus we
never asked for was sitting in the contract.

Read this one first if you only read one.

---

## The rule

> **The preset is authoritative. Deny by default.**
> If a behaviour, sound, overlay or mechanic is not declared in
> `vice-heat.chainwtf-preset.json`, it must not render, play or fire.

The failure mode is not "our feature is missing". It is "our feature is missing
**and** the engine quietly substituted its own". A generic default that renders
looks like a working build, so nobody notices until someone compares it against
the reference — and a substituted default in the *math* path does not even look
wrong, it just pays differently.

Three consequences:

1. **Additive is not enough.** Consuming our marquee art while the procedural
   plaque still draws gives you two marquees, or one on top of the other.
   Whatever our config replaces has to be switched **off**.
2. **Silence is a bug, not a default.** A missing sound binding degrades to
   graceful silence, so an unimplemented event and a broken one are
   indistinguishable at runtime. Every event listed in §3 must be *audibly*
   verified, not just "wired".
3. **Anything in the engine that Vice never asked for is a defect**, even when
   it cannot currently fire — see the phantom Hold & Win in §2.

---

## 1. What must be OURS, and what must be GONE

| # | Area | Engine default that must be **OFF** | What must render instead | Where it is specified |
|---|---|---|---|---|
| 1 | **Win marquee** | The procedural plaque: `buildWinBanner()` Graphics calls, the hardcoded `0xFFD23F` gold, and the hardcoded `'BIG WIN!'` / `'MEGA WIN!'` labels | Our five-tier layered art (`win` → `big` → `mega` → `epic` → `max`) + number plate, with the ambient bed ducking under the fanfare | `extras.presentationTuning.winPresentation.marquee.tierArt` (note the `winPresentation` level — the shorter path is `undefined`), `assets.winTiers`, mechanic `win-marquees`, `features/win-marquees/` |
| 2 | **Win presentation** | The hardcoded gold payline look — **and its line/dot decoration**. Vice is a WAYS game; the engine's `WIN_LINE_COLOR` gold underlay (`0xFFC53D`, stroke 11, dot ring 3) must not be drawn | The **immersive dance**: winning symbols leap, wiggle and slam back, staggered 0.07 s, with the rest of the board held at full brightness (`dimAlpha: 1` — Vice does **not** dim) | `extras.presentationTuning.winPresentation.waysImmersive`, mechanic `ways-light` |
| 2b | **Transitions** | Instant cuts between every stage | The **iris** system — a black field with a circular hole that closes and opens, bookending every stage change, at tempo `S = 1.3` | `flow.iris` + every stage's `transitionIn`/`transitionOut` in `FLOW.md` |
| 2c | **Win numbers** | The engine's own amount rendering | Our count-up on our plate: durations `[2.6, 3.6, 4.6, 5.6]` s by tier, holds `[1, 1.2, 1.4, 1.8]` s, marquee `sizeMul 0.624`, and the tier/plate geometry below | `extras.presentationTuning.winPresentation.marquee` (`config`, `geometry`) |
| 3 | **Boot** | Nothing — there is no loading screen at all today | The CHAIN GAMES loader, **first**, before anything else renders | `flow.stages[0]`, `features/boot-loader/` |
| 4 | **Game intro** | Instant jump into the reels, no transition | Layered breathing title screen + iris-from-black | `flow.stages[1]`, `flow/intro-screens/` |
| 5 | **FS counters** | Bottom text | Our neon **FREE SPINS** + **TOTAL WIN** plaques | `assets`, `features/` layout notes, `FLOW.md` stage 7 |
| 6 | **Audio** | Engine defaults / silence | Our 12-event flat mix at Noski's exact levels — see §3 | `audio.events` |
| 7 | **Control bar** | 260 px **left sidebar** | **Bottom** bar, 12.5 % of the box width, with the grid centred and the logo in the left letterbox | `extras.sizing.machineBox`, section D of `VICE_HEAT_FIXES_FOR_DEV.md` |
| 8 | **Anticipation** | Generic `nearMissTease` boolean | Our universal-anticipation: POV world dolly in gated steps, bounce-out on a miss, lock on a hit | mechanic `universal-anticipation`, `features/tease-camera/` |
| 9 | **Symbols** | Static art only | Per-symbol idle loops + win sheets on the cell's exact footprint | `assets.spritesheets`, `features/symbol-sheets/` |
| 10 | **Bonus set** | A **COIN (id 9) Hold & Win** that triggers on 6+ coins, baked into the contract | **Nothing.** Vice has no Hold & Win. Our strips contain no id 9 so it can never fire — but it must not be in a Vice build at all | D9 in `VICE_HEAT_FIXES_FOR_DEV.md` |
| 11 | **Math profile** | Silent fallback to the **Fantasy 5×3 default** when `reelStrips` is undefined | Our manifest — and the fallback should **throw**, not substitute | D8 / `PRESET_FORMAT.md` §0 |

### The one that is worth a guard rail

Item 11 is the dangerous one. A fallback that silently swaps the math is the
only failure on this list that changes what the game **pays** while looking
completely normal. Make it fatal:

```ts
if (!profile?.reelStrips?.length) {
  throw new Error('math profile has no reelStrips — refusing to fall back to a default');
}
```

---

## 2. Do not ship

- **Hold & Win / COIN id 9.** Not part of Vice. Remove or hard-disable it for
  this build rather than relying on our strips never producing the symbol.
- **A simul-expand multiplier ladder.** `custom.simulExpandMultipliers` is
  **deleted**. 1–4 wild reels pay natural ways; only 5 full wild reels pay the
  instant max win. If you find that key anywhere, it is from an old drop.
- **Any evaluator change.** See the retracted D11. `WinEvaluator.ts` and
  `SlotGame.sol:341` stay exactly as they are.
- **Any other game's theme, sounds, mechanics or math.** This package contains
  only Vice Heat.

---

## 3. Audio — the part that was entirely missing

The engine vocabulary is **fixed** at 12 registry keys and files resolve **flat**
as `/audio/<id>.ogg`. Unknown ids are dropped silently at compile; missing
bindings are graceful silence at runtime. That is why the last build shipped with
no sound and nothing complained.

Our export already speaks that contract — every file is referenced flat, keyed by
your registry id, and the `.ogg` files ship in `assets/audio/`.

| event | volume | must be audible on |
|---|---|---|
| `ambient-music` | 0.35 | the base game, looping, ducked under the marquee |
| `win-screen-music` | 0.95 | every win marquee |
| `connect-symbol` | 0.53 | every winning ways connection |
| `coin-chime` | 0.53 | the coin ceremony |
| `spin-start` | 0.47 | every spin |
| `reel-stop` | 0.16 | every reel landing |
| `scatter-land` | 0.55 | every scatter that lands |
| `free-spin-trigger` | 0.59 | the trigger |
| `win-small` / `win-normal` / `win-big` / `win-mega` | **0** | nothing — deliberately off, the marquee music covers these |

**Two keys have historically been the ones that break.** `win-screen-music` and
`connect-symbol` both went silent because they existed under different names on
each side. If either logs *"unavailable — running silently"*, the win screen and
the win connections have no sound and the build is not conformant.

**`marqueeDucksAmbient`** pairs `ambient-music` with `win-screen-music` as an
exclusive group. Verify the duck **releases** — if the group is still keyed on an
old name, the ambient bed never comes back and it reads as detached, hanging
marquee music.

**Five events our mix uses that your runtime never dispatches:** `fs-retrigger`,
`tease-riser`, `tease-miss`, `wild-land`, `wild-expand`. They play on our build
and are silent on yours until those events are fired. Not a blocker — but decide
with us whether those beats are in scope, rather than discovering them later.

---

## 4. Acceptance checklist

Run this against a build. Every row needs **both** halves — ours present *and*
theirs absent.

| # | Check | Ours present | Theirs absent |
|---|---|---|---|
| 1 | Boot | CHAIN GAMES logo builds in, bar fills **behind** it and tops out only when the logo finishes | — (there was nothing before) |
| 2 | Intro | layered title screen, iris-from-black into the reels | no instant jump to the reels |
| 3 | Base win | winning symbols leap/wiggle/slam, staggered 0.07 s, board stays bright | **no gold payline graphics, no line underlay, no dot rings** anywhere |
| 3b | Transitions | every stage change is iris-bookended | no instant cuts |
| 3c | Win numbers | count-up on our plate at our durations, our plate geometry | no engine-default amount rendering |
| 4 | Marquee | our tier art + number plate | no procedural gold plaque, no `BIG WIN!` / `MEGA WIN!` text |
| 5 | Sound | all 8 enabled events audible (§3) | no engine default sounds, and **no silence** |
| 6 | Marquee music | ambient ducks under the fanfare **and comes back** | no hanging/detached music |
| 7 | FS counters | neon FREE SPINS + TOTAL WIN plaques | no bottom text counters |
| 8 | Control bar | bottom bar, grid centred, logo in the left letterbox | no 260 px left sidebar |
| 9 | Tease | POV dolly in gated steps, bounce-out on a miss | no generic near-miss flash |
| 10 | Symbols | idle loops + win sheets on the cell footprint | no static-only board |
| 11 | Bonus set | free spins only | **no Hold & Win**, no coin collection |
| 12 | Math | `reelStrips` from our manifest; 5×5 grid | no Fantasy 5×3 fallback — it should have thrown |
| 13 | Buys | 100× / 200× read from `costMult` | no computed price (the "300×" bug) |
| 14 | Retrigger | **+3** spins | not +7 |
| 15 | Free spins | towers carry ×1–×5 badges, sticky ones keep theirs all round and stay standing **while the other reels roll** | no un-multiplied bonus, no towers blinking out each spin |

### The one-number check

With the mechanics in, run the certifying harness against your own port:

```
node math/sim_vice_core.mjs 20000000 --mode=natural --seed=4242424
```

Expect **96.46 %** ±1.59pp. If you land near **72 %**, the free-spins mechanics
are not running. If you land near **a third of target**, `custom{}` is being
dropped entirely. See `features/round-core/` — that is the file to port.
