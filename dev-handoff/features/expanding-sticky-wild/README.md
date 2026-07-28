# Expanding Sticky Wild

> Universal, theme-agnostic feature. **Vice Heat** is only the reference skin.
> This is the **sticky variant** of the Expanding Wild — read
> `../expanding-wild/README.md` first; the visuals and opening effect here are
> **byte-identical** to that feature. This doc only describes what *differs*:
> the persistence rule and the round flow. Sources: `features/round-core/viceSpin.ts`
> (the shipped settlement — sticky set, `stickyTowerCap`, badge draw, full-board
> instant max win), `src/game/ReelSet.ts` (`playExpandingWildReveal({ sticky: true })`,
> `preserveStandingTowers`) and `src/dev/mockHost.ts` (our repo-side mirror).
> **Every number below is read from the preset's `math.manifest.custom` block —
> that block is the authority, not this prose.**

---

## 1. How it differs from plain Expanding Wild

Plain expanding wild is **per-spin**: a reel expands, pays, and the tower clears
before the next spin. The **sticky** variant makes an expanded reel **stay fully
wild for the rest of the free-spins round**, and lets towers **accumulate** spin
after spin up to a cap.

| Aspect | Expanding Wild (per-spin) | Expanding **Sticky** Wild |
|---|---|---|
| Tower lifetime | one spin, cleared next spin | persists to end of round, **on screen through every roll in between** |
| Accumulation | none | new towers add each spin, up to `stickyTowerCap` (**5**) |
| Which reels roll | all | only **uncovered** reels roll; standing towers stay put |
| Join order | n/a | **leftmost wild-carrying reel joins first** |
| Multiplier badge | drawn fresh every spin | **dealt once, when the tower JOINS — kept for the round** (see `../tower-multipliers/`) |
| Trigger | 3-scatter FS tier / hot spin | **4+ scatter FS trigger** (or the 200× BUY) |
| Opening effect + sounds | see expanding-wild §3–4 | **identical** (same `expandOneWildReel`, same `wild-land` / `wild-expand`) |

The key point for the generator: **do not re-author any visuals**. The sticky
feature calls the exact same reveal (`expandOneWildReel`) with the exact same
tween timeline, image contract, and sound events. The only new logic is *when a
tower is created, how long it lives, and which badge it carries*. The badge plate
itself is also not re-authored here — it is the shared 5-frame
`wild_multi_sheet.webp` documented in `../tower-multipliers/`.

---

## 2. The sticky rule (exact)

From `ReelSet.playExpandingWildReveal({ sticky: true })` and the shipped
settlement in `features/round-core/viceSpin.ts` (mirrored in `mockHost.ts`):

1. The round enters sticky mode when the **trigger board had ≥ 4 scatters**.
   Read it from the **settled round** (`viceRound.sticky`), not by re-deriving it
   from the scatter count — a **bought** 4-scatter round is sticky *by contract*,
   and re-deriving it is exactly how a display once played a per-spin round on top
   of a settlement that was accumulating sticky towers.
2. Standing towers are **kept** across spins — `startSpinKeepShowcase()` rolls
   only the uncovered reels; the presentation state clears but the towers do not.
3. **A tower is sticky FROM LANDING.** It must stay on screen from the moment it
   locks until the round ends — *including while the other reels are rolling*. Do
   **not** tear it down at spin start and rebuild it after the board lands: the
   player watches the tower blink out every spin and reads it as losing the
   feature they were just paid for. Our fix is a `preserveStandingTowers` flag on
   `ReelSet` that suppresses the spin-start teardown for the whole sticky round
   (`src/game/ReelSet.ts:537`; set at FS entry and cleared on FS exit in
   `PixiApp.ts`).
4. Each spin, new towers grow **only where the settled window naturally shows a
   wild** — organic pacing, so some spins add none. No forced landings. (The one
   exception is the 200× buy's first spin — see §3.)
5. Towers are capped: the first **`stickyTowerCap` (= 5)** wild-carrying reels of
   the *round* become permanent towers, **leftmost first**. Once the cap is hit,
   later wilds render as ordinary 1:1 wilds on the board (they do not expand).
   On a 5-reel grid a cap of 5 means the cap **is** the full board — see rule 8.
6. Non-sticky reels get **no per-spin expansion** during a sticky round — only
   the accumulating sticky towers expand.
7. **Every sticky tower carries a ×1–×5 badge**, dealt from
   `custom.towerMultiplierWeights` `[55, 20, 9, 6, 10]` at the moment it **JOINS**,
   and kept unchanged for the rest of the round (`custom.towerMultiplierStickyRule`).
   A winning combination pays **× the HIGHEST badge among the reels it crosses** —
   not the product, not the sum. Scatter pay is never multiplied. Full rule, the
   reserved-seed-namespace draw, and the art contract: `../tower-multipliers/`.
   **Build the sticky towers without the badges and the free spins pay a 71.6%
   floor against a certified 96.46%.**
8. **All 5 reels standing wild = INSTANT MAX WIN.** `custom.fullBoardInstantMaxWin`
   is `true`: the spin pays exactly `maxWinMultiplier × bet` (5000×), **nothing is
   multiplied on top of it** (no badge, no full-house), and the round **ends** on
   that spin. This is the sticky tier's max-win route; the only other one is the
   running-total cap at `maxWinMultiplier × wager`.
9. `playExpandingWildReveal` returns **all** expanded reels (old + new) so the
   caller evaluates the full sticky board each spin (every standing tower is
   forced to WILD in all rows before ways evaluation).

### Full-house multiplier — RETIRED, ships as `1` (OFF)

`custom.stickyFullBoardMultiplier` is **`1`** in the shipped preset. The field is
still in the contract so the schema does not break, but the mechanic it once
described **does not exist in this game**. Build it as a no-op multiply by 1.

The reason it can never come back at this cap: its own gate is
`sticky && stickyReels.length >= stickyCap` — and with `stickyCap = 5` on a
5-reel grid that fires on **exactly** the spin where all 5 reels stand wild,
which is the **instant max win** (rule 8). Every earlier spin, with 1–4 towers,
never sees it at all. So a `> 1` value would only ever scale a payout that is
already `maxWinMultiplier × bet` and gets clamped straight back — dead code the
certifier still has to reason about, and a live footgun for anyone who later
moves the multiply ahead of the clamp.

> **HISTORY — do not re-derive from this.** An earlier build capped towers at
> **3** and had no instant max win. There, "all 3 towers standing" was an ordinary
> paying board that recurred almost every 10-spin round, and a ×2 on it compounded
> RTP past 105%. That is the rationale you will find in older notes and in
> `math/MATH_MODEL.md` — it was written against **cap 3**, and it is history.
> Under the shipped **cap 5 + `fullBoardInstantMaxWin`** the field is simply dead.

Any per-round average for the 4-scatter tier you find in older documents (e.g.
"avg ~276×") predates the tower multipliers and describes a different game. The
figures that describe **this** build: **4-scatter buy 95.97% ±0.56pp**, and on
natural play the 4+-scatter bonus contributes **30.66% of wager** (certified via
`custom-math/sim_vice_core.mjs`, the same core that drives the live round).

---

## 3. Flow across a sticky round (reference: Vice Heat 4+ scatter tier)

```
Trigger: settled board shows >= 4 scatters  (or the 200x BUY)
  -> round length = stickyRoundSpins (10), hard cap stickyRoundCap (13)
  -> stickyMode = true, sticky set = {}, badge map = {}

Each free spin:
  1. Uncovered reels roll; standing towers stay locked AND VISIBLE for the
     whole roll (startSpinKeepShowcase + preserveStandingTowers) - they are
     never torn down and rebuilt.
  2. For each reel L-to-R with a wild in its window, while sticky set < cap (5):
       add reel to sticky set (leftmost first) -> grow a NEW tower
       via expandOneWildReel (same land pop, clear-beat, race-out,
       lock-in squash, board slam, shine border, sounds)
       -> DEAL that tower a x1-x5 badge; it keeps it for the whole round.
  3. Every reel in the sticky set is forced fully WILD (all rows).
  4. If all 5 reels now stand wild -> INSTANT MAX WIN (maxWinMultiplier x bet),
     nothing multiplied on top, ROUND ENDS HERE.
  5. Otherwise the board (with all towers wild) runs through the real ways
     evaluator; each combination pays x the HIGHEST badge among the reels it
     crosses (scatter pay never multiplied); connections present + pay
     normally on the uncovered reels.
  6. Towers persist into the next spin, keep their badge, keep breathing
     (idle life).

BUY (200x) ONLY: if the FIRST free spin would land no tower at all, reel 0 is
  slid forward onto a wild (viceBuyStages[].guaranteedTowerOnFirstSpin,
  guaranteedTowerReel 0). A natural 4-scatter round gets no such help.
Retrigger (>= 3 scatters during the round): +retriggerSpins (3), bounded by
  stickyRoundCap (13). At most one retrigger fits.
Round ends at spin count, at the full-board instant max win, or at the running
  5000x cap - whichever comes first.
```

On the very first sticky spin the set is empty, so up to `stickyTowerCap` reels
can join in one spin (leftmost first); on later spins the set only grows toward
the cap. Because the cap is **5 on a 5-reel grid, reaching the cap and filling
the board are the same event**: the fifth tower is the instant max win and the
round stops on that spin. A round that ends short of 5 keeps its 1–4 towers
standing — badges and all — to the last spin. Measured on the 200× buy: **mean
2.03 towers at round end**.

### The 200× buy always shows a tower

`custom.viceBuyStages[]` (stage 2, `scatters: 4`, `costMult: 200`) carries
`guaranteedTowerOnFirstSpin: true` / `guaranteedTowerReel: 0`. Without it **15.5%
of bought rounds (1 in 6.4) ended having shown no tower at all** — the player paid
200× for a tower round and watched a plain board. With it that is **0%**; the
nudge fires on **83.6%** of bought rounds (i.e. whenever the first spin lands
nothing on its own). Reel 0 is the chosen reel because the ways evaluator folds a
column-0 wild into HIGH_A, which makes that tower roughly 10× cheaper than any
other — the price is unchanged at **200×** and the stage re-certified at
**95.97% ±0.56pp**. This is a **bought-round** rule only; do not apply it to a
naturally triggered 4-scatter round.

---

## 4. Opening effect + sounds

**Identical to Expanding Wild.** The sticky path calls the same
`expandOneWildReel(reelIdx, row, turbo)` — same tween timeline
(`tClear 0.32s`, `tRace 0.40s`, race-out `0.46s expo.inOut`, lock-in squash
`0.08s` + elastic settle `0.55s`, impact flash, board slam, reel-sized shine),
same image contract (one tall column PNG, width-fit 0.98, top-anchored,
bottom-crops), same idle breathing. See `../expanding-wild/README.md` §2–§3 for
the full numbers.

Sounds by event id (unchanged):

| Event id | Fires | Character |
|---|---|---|
| `wild-land` | wild visible on reel stop (`onWildLanded`) | cash-bundle drop |
| `wild-expand` | expansion reveal starts (`onWildExpand`) | bill-riffle riser + slam on lock-in |

---

## 5. Settings

Inherits every visual/audio setting from `expanding-wild` (image, open-effect,
sounds). Sticky-specific settings:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `triggerScatterCount` | int | 4 | Min scatters on the trigger board to enter sticky mode (`>=`). |
| `stickyTowerCap` | int | **5** | Max simultaneous towers per round (leftmost reels join first). Shipped as `5` at `custom.stickyTowerCap` **and** on **both** `custom.viceBuyStages[]`. On a 5-reel grid, hitting it = full board = instant max win. |
| `stickyFromLanding` | bool | true | The tower stays on screen from lock-in to round end, **including while other reels roll**. Never rebuild it after landing. |
| `stickyRoundSpins` | int | 10 | Free spins awarded for the sticky tier. |
| `stickyRoundCap` | int | 13 | Hard ceiling on total spins incl. retriggers. |
| `retriggerSpins` | int | 3 | Extra spins per in-round retrigger (`>= 3` scatters), bounded by `stickyRoundCap`. |
| `towerMultiplierWeights` | int[] | `[55,20,9,6,10]` | ×1…×5 badge weights. Badge dealt on JOIN, kept for the round; win pays × the **highest** badge crossed. See `../tower-multipliers/`. |
| `fullBoardInstantMaxWin` | bool | true | 5 wild reels pay exactly `maxWinMultiplier × bet` (5000×) and end the round. Nothing multiplies it. |
| `guaranteedTowerOnFirstSpin` | bool | true *(buy stage 2 only)* | 200× bought rounds only: nudge `guaranteedTowerReel` (0) onto a wild if spin 1 would show no tower. |
| `stickyFullBoardMultiplier` | number | 1 | **RETIRED — ships as `1` (no-op).** Field kept for schema compatibility only; see §2. |
| `perSpinExpansionForNonStickyReels` | bool | false | Non-sticky reels do NOT expand per-spin in a sticky round. |
| `joinOrder` | enum | `leftmost-first` | Order reels join the sticky set. |
| `sound.onLand` | event id | `wild-land` | Shared with expanding-wild. |
| `sound.onExpand` | event id | `wild-expand` | Shared with expanding-wild. |

See `feature.json` in this folder for the machine-readable form.

---

## 6. Integration points (source of truth)

- **Settlement (authoritative): `features/round-core/viceSpin.ts`** — the sticky
  set fill (`stickyReels`, leftmost-first, `stickyCap`), the per-join badge draw
  (`stickyMults[reel]` is written once and reused), `fullWildReelCount >= reels`
  → instant max win, and the running `maxWin` clamp that breaks the round.
- `ReelSet.playExpandingWildReveal({ sticky: true, isLive, turbo })` — sticky
  orchestration; keeps standing towers, grows new ones organically up to the
  cap, returns **all** expanded reel indices.
- `ReelSet.startSpinKeepShowcase()` — rolls reels without tearing down towers.
- `ReelSet.preserveStandingTowers` (`src/game/ReelSet.ts:254`, honoured at `:537`)
  — the flag that makes a tower sticky *from landing*; set from `stickyMode` at FS
  entry and cleared on FS exit (`src/game/PixiApp.ts:2362`, `:2227`, `:2686`).
- `ReelSet.setTowerMultiplier(Map<reel, ×N>)` — paints the badges. The display
  **never rolls them**; it reads `vSpin.towerMultipliers` off the settled spin.
- `PixiApp` FS loop (`src/game/PixiApp.ts`): `stickyMode = viceRound.sticky`
  (the settled flag — the `scatterCount >= 4` form is only the Crack Farm
  fallback); forces every returned reel to WILD before evaluation.
- `PixiApp.applyStickyFullBoard` — the retired full-house hook. It is a ×1 no-op
  and it is **not** on the Vice path at all (`if (stickyMode && !vSpin)`): a Vice
  spin replays a settled `winResult`. Do not resurrect it (§2).
- Math mirror: `src/dev/mockHost.ts` — `stickyFS`, `stickyReels` set,
  `stickyCap`, `stickyRoundSpins`, `stickyRoundCap`, `retriggerSpins`.
- Contract: the preset's `math.manifest.custom` block (in-package copy:
  `math/vice_heat_expanding.json`). `math/MATH_MODEL.md` still narrates the old
  cap-3 / full-house model in places — where it disagrees with the preset, **the
  preset wins**.
