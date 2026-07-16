# Expanding Sticky Wild

> Universal, theme-agnostic feature. **Vice Heat** is only the reference skin.
> This is the **sticky variant** of the Expanding Wild — read
> `../expanding-wild/README.md` first; the visuals and opening effect here are
> **byte-identical** to that feature. This doc only describes what *differs*:
> the persistence rule and the round flow. Sources: `src/dev/mockHost.ts`
> (sticky set, `stickyTowerCap`, per-spin accumulation), `src/game/ReelSet.ts`
> (`playExpandingWildReveal({ sticky: true })`), and `custom-math/README.md`.

---

## 1. How it differs from plain Expanding Wild

Plain expanding wild is **per-spin**: a reel expands, pays, and the tower clears
before the next spin. The **sticky** variant makes an expanded reel **stay fully
wild for the rest of the free-spins round**, and lets towers **accumulate** spin
after spin up to a cap.

| Aspect | Expanding Wild (per-spin) | Expanding **Sticky** Wild |
|---|---|---|
| Tower lifetime | one spin, cleared next spin | persists to end of round |
| Accumulation | none | new towers add each spin, up to `stickyTowerCap` |
| Which reels roll | all | only **uncovered** reels roll; standing towers stay put |
| Join order | n/a | **leftmost wild-carrying reel joins first** |
| Trigger | 3-scatter FS tier / hot spin | **4+ scatter FS trigger** |
| Opening effect + sounds | see expanding-wild §3–4 | **identical** (same `expandOneWildReel`, same `wild-land` / `wild-expand`) |

The key point for the generator: **do not re-author any visuals**. The sticky
feature calls the exact same reveal (`expandOneWildReel`) with the exact same
tween timeline, image contract, and sound events. The only new logic is *when a
tower is created and how long it lives*.

---

## 2. The sticky rule (exact)

From `ReelSet.playExpandingWildReveal({ sticky: true })` and the mirrored math in
`mockHost.ts`:

1. The round enters sticky mode when the **trigger board had ≥ 4 scatters**
   (`stickyMode = scatterCount >= 4`).
2. Standing towers are **kept** across spins — `startSpinKeepShowcase()` rolls
   only the uncovered reels; the presentation state clears but the towers do not.
3. Each spin, new towers grow **only where the settled window naturally shows a
   wild** — organic pacing, so some spins add none. No forced landings.
4. Towers are capped: the first **`stickyTowerCap` (= 3)** wild-carrying reels of
   the *round* become permanent towers, **leftmost first**. Once the cap is hit,
   later wilds render as ordinary 1:1 wilds on the board (they do not expand).
5. Non-sticky reels get **no per-spin expansion** during a sticky round — only
   the accumulating sticky towers expand.
6. `playExpandingWildReveal` returns **all** expanded reels (old + new) so the
   caller evaluates the full sticky board each spin (every standing tower is
   forced to WILD in all rows before ways evaluation).

### Full-house multiplier (currently OFF)

When **all** `stickyTowerCap` towers stand at once, every spin can pay
`x stickyFullBoardMultiplier`. **This is currently `1` (feature off).** The
field stays in the contract so it can be re-enabled if the round length is ever
shortened. (Per `custom-math/README.md`: at the longer 10-spin round the full
board forms almost every round, so a x2 there compounded RTP past 105%; taming
it to `1` keeps the 4-scatter tier the reliable high-average tier, avg ~276x.)

---

## 3. Flow across a sticky round (reference: Vice Heat 4+ scatter tier)

```
Trigger: settled board shows >= 4 scatters
  -> round length = stickyRoundSpins (10), hard cap stickyRoundCap (13)
  -> stickyMode = true, sticky set = {}

Each free spin:
  1. Uncovered reels roll; standing towers stay locked (startSpinKeepShowcase).
  2. For each reel L-to-R with a wild in its window, while sticky set < cap (3):
       add reel to sticky set (leftmost first) -> grow a NEW tower
       via expandOneWildReel (same land pop, clear-beat, race-out,
       lock-in squash, board slam, shine border, sounds).
  3. Every reel in the sticky set is forced fully WILD (all rows).
  4. Board (with all towers wild) runs through the real ways evaluator;
     connections present + pay normally on the uncovered reels.
  5. Towers persist into the next spin and keep breathing (idle life).

Retrigger (>= 3 scatters during the round): +retriggerSpins (3), bounded by
  stickyRoundCap (13). At most one retrigger fits.
Round ends at spin count or the hard 5000x session cap, whichever first.
```

On the very first sticky spin the set is empty, so up to `stickyTowerCap` reels
can join in one spin (leftmost first); on later spins the set only grows toward
the cap. Once 3 towers stand they simply remain for the rest of the round.

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
| `stickyTowerCap` | int | 3 | Max simultaneous towers per round (leftmost reels join first). |
| `stickyRoundSpins` | int | 10 | Free spins awarded for the sticky tier. |
| `stickyRoundCap` | int | 13 | Hard ceiling on total spins incl. retriggers. |
| `retriggerSpins` | int | 3 | Extra spins per in-round retrigger (`>= 3` scatters), bounded by `stickyRoundCap`. |
| `stickyFullBoardMultiplier` | number | 1 | Per-spin multiplier while ALL towers stand. **1 = off.** |
| `perSpinExpansionForNonStickyReels` | bool | false | Non-sticky reels do NOT expand per-spin in a sticky round. |
| `joinOrder` | enum | `leftmost-first` | Order reels join the sticky set. |
| `sound.onLand` | event id | `wild-land` | Shared with expanding-wild. |
| `sound.onExpand` | event id | `wild-expand` | Shared with expanding-wild. |

See `feature.json` in this folder for the machine-readable form.

---

## 6. Integration points (source of truth)

- `ReelSet.playExpandingWildReveal({ sticky: true, isLive, turbo })` — sticky
  orchestration; keeps standing towers, grows new ones organically up to the
  cap, returns **all** expanded reel indices.
- `ReelSet.startSpinKeepShowcase()` — rolls reels without tearing down towers.
- `PixiApp` FS loop (`src/game/PixiApp.ts`): `stickyMode = outcome.scatterCount >= 4`;
  forces every returned reel to WILD before `evaluateWins`; applies
  `applyStickyFullBoard` (currently x1).
- Math mirror: `src/dev/mockHost.ts` — `stickyFS`, `stickyReels` set,
  `stickyCap`, `stickyRoundSpins`, `stickyRoundCap`, `retriggerSpins`,
  `stickyFullBoardMultiplier`.
- Custom-math contract: `custom-math/vice_heat_expanding.json` `custom` block and
  `custom-math/README.md` (settlement rules 1–7).
