# Hot Spins — the base game's own feature

**Type:** base feature · **Affects math: YES** (3.8 % of natural RTP, **6.8 % of the ante**) ·
**Universal.** Any game with expanding wilds can take it.

This is what makes a Vice round without a bonus worth watching. Without it the
base game is flat, and the **ante collapses to ~84 %**.

---

## The rule

Every **natural or ante base spin** has a **1-in-80** chance
(`custom.hotSpinChance1In`) of running hot. When it does, **every reel that has a
wild anywhere in its window expands to a full wild reel** — the same tower
expansion as the free spins, in the middle of the base game. The spin then pays
its ordinary ways win on the expanded board.

```
hotSpinChance1In      80
hotSpinExpandsWilds   true
multiplier            none — a hot spin pays its natural ways win, nothing more
badge                 none — towerMultiplierOnHotSpins is false
boughtRounds          NEVER
```

## Four details that are easy to get wrong

**1. Never on a bought round.** The expansion would run straight over the
**forced** scatters and erase the trigger the player just paid 100× or 200× for.
Gate it on "not a bought stage", not on "not in free spins".

**2. No multiplier badge.** Tower multipliers are a *free-spins* mechanic. We
measured the alternative: with badges on hot spins the same fit lands at
**103.09 %** instead of 96.36 %. `custom.towerMultiplierOnHotSpins` is `false`
and must stay false.

**3. A hot spin can suppress a bonus trigger — and that is correct.** If the
expansion covers the cells the scatters landed on, the trigger is lost. It is
certified behaviour, not a bug: in the 20 M-round ante run it happened **10,962**
times. Do not add a guard that protects scatters from the expansion; the RTP is
fitted with the suppression in place.

**4. There is a MAX WIN in the base game.** If all five reels go hot at once and
`custom.fullBoardInstantMaxWin` is set, the round pays the full `maxWinMultiplier
× bet` immediately — in the base game, with no bonus. Rare but real: **286 times
in 20 M ante rounds**. The max-win ceremony must fire there too.

## Randomness

The hot roll draws from a **reserved seed namespace** — `keccak(seed, 1 << 64)` —
so it does not consume words from the reel-stop stream. The reels land
identically whether the feature is on or off, which is what lets the certified
numbers survive toggling it.

(The tower-multiplier badges use `1 << 200` for the same reason. Neither can
collide with a free-spin index, which is ≤ 13.)

## What it contributes

| mode | hot-spin share of wager | rate |
|---|---|---|
| natural | **3.76 %** | 1-in-80 |
| ante | **6.84 %** | 1-in-80.1 measured over 20 M rounds |

The ante leans on it roughly twice as hard, because the ante's higher wild
density makes each hot spin worth more. **If hot spins are ever dropped, the ante
must be re-fitted** — it measures ~84 % without them.

## Preset keys

```json
"custom": {
  "hotSpinChance1In": 80,
  "hotSpinExpandsWilds": true,
  "towerMultiplierOnHotSpins": false,
  "fullBoardInstantMaxWin": true
}
```

Mechanic id `hot-spins`, `kind: base-feature`, `affectsMath: true`.

## Reference implementation

`features/round-core/viceSpin.ts` — the hot roll and the expansion loop sit at
the top of `deriveViceRound`, right after the stops are derived and before the
board is evaluated. Roughly:

```ts
const hot = !buyStage && !!config.hotSpinExpandsWilds && hotChance > 0
  && BigInt(spinSeed(randomness, HOT_SEED_INDEX)) % BigInt(hotChance) === 0n;
if (hot) {
  for (let reel = 0; reel < reels; reel++) {
    if (reelHasWild(evalBoard, reel)) { makeFullWild(evalBoard, reel); hotReels.push(reel); }
  }
}
const baseInstantMax = hot && hotReels.length >= reels && !!config.fullBoardInstantMaxWin;
```

## Presentation

A hot spin should read as an *event*, not as a quiet board change — the reels
land, then the wild reels expand with the same tower reveal the free spins use
(`playExpandingWildReveal`). The expansion happens **after** the board settles,
so the player sees the wilds land and then grow.
