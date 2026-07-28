# Round Core — `viceSpin.ts`, the one function that decides a round

**Type:** drop-in code module (real `.ts`) · **Affects math: YES** — this *is* the math.

This is the highest-value file in the package. It is the **pure, seed-derived**
core that turns `(randomness, bet, config, stage)` into a complete round:
board, expansions, sticky towers, tower multipliers, free spins, and the credited
total. Everything else — our settlement, our decode path, our display, and the
certifying simulator — calls **this same function with the same seed**.

Port this and the payout questions stop being questions.

---

## Why it exists (the bug it makes structurally impossible)

We shipped a round where the plaque said the free spins had won **32** and the
player was credited **42**. Display and settlement were two separate
implementations of the same rules, and they drifted — the display re-rolled its
own randomness for the bonus.

`deriveViceRound()` fixed that by construction, not by patching:

```
settlement  →  deriveViceRound(seed, bet, config, stage)  →  credited total
display     →  deriveViceRound(seed, bet, config, stage)  →  the spins to replay
```

Same function, same seed, same answer. There is no second implementation left to
disagree with.

**If you take one architectural idea from this handoff, take this one.**

---

## What it computes

| | |
|---|---|
| base board | reel stops from the strips, plus the **hot spin** roll (base game only) |
| free spins | the full replay list — every spin's stops, expansions and win |
| sticky towers | which reels are standing wild, and from which spin |
| **tower multipliers** | the ×1–×5 badge each fully-wild reel is dealt |
| instant max win | 5 full wild reels → exactly `maxWinMultiplier × bet`, round ends |
| bought rounds | forced scatter counts, stage strips, the 4-scatter tower guarantee |
| credited total | capped, in integer arithmetic |

---

## The two rules that make it reproducible

### 1. Reserved seed namespaces

Every extra random decision draws from its **own** namespace, so it cannot
consume words from the reel-stop stream:

```
hot-spin roll        keccak(seed, 1 << 64)
tower multipliers    keccak(seed, 1 << 200)
free-spin seeds      keccak(seed, spinIndex)     // spinIndex <= 13
```

`2^200` can never collide with a spin index or with the hot roll. **The reels
land identically whether the tower-multiplier mechanic is on or off** — which is
exactly what lets two independently written simulators agree on a seed, and what
makes a re-certification mean anything.

Draw a badge inline from the round's stream instead and every stop after it
shifts. The game still *runs*; it just no longer matches any certified number.

### 2. Exact integer max-win test

```ts
const capAmount = capX > 0 ? BigInt(capX) * wager : 0n;
const isMax = capAmount > 0n && winAmount >= capAmount;
```

BigInt, not a float quotient with a tolerance. A skipped or mis-sized max win on
a real platform is an exploit, not a cosmetic bug — this comparison is the thing
standing between the cap and the treasury.

---

## Dependencies (all of which you already have)

```ts
import { keccak256, encodeAbiParameters } from 'viem';
import { SymbolId } from '@/config/symbols';
import type { WinResult } from '@/engine/WinEvaluator';
import type { GameConfig } from '@/engine/GameConfig';
import { evalWins } from './winEval';
```

`evalWins` is a one-line façade. For a **ways** game it is exactly your own
evaluator:

```ts
export function evalWins(board, totalWager, config) {
  return evaluateWins(board, totalWager, config);   // src/engine/WinEvaluator.ts
}
```

We route through the façade only because our studio also hosts lines/cluster/
scatter-pays games. **Do not substitute a different evaluator here** — see the
retracted D11 in `VICE_HEAT_FIXES_FOR_DEV.md`: a column-0 wild folding to
`HIGH_A` is the spec, and `SlotGame.sol:341` does it too.

---

## Integration

1. Drop `viceSpin.ts` in and point `evalWins` at your `evaluateWins`.
2. Call `deriveViceRound(randomness, bet, config, stage)` from **settlement**,
   and credit `round.totalWin`.
3. Call the **same function with the same seed** from the presentation layer and
   replay `round.fsSpins` — never re-roll for the display.
4. Read the mechanics' inputs from `preset.math.manifest.custom` (the field names
   in `ViceConfig` at the top of the file match the preset's `custom` keys one
   for one).

> ⚠️ Extra fields cannot survive an abi encode/decode boundary. If your
> settlement returns an encoded outcome, the display must **re-derive** the round
> from the seed rather than expecting the extra state to come back with it. That
> is why this function is pure.

---

## Verifying your port

`../math/sim_vice_core.mjs` is the harness that certifies this file. It bundles
`viceSpin.ts` with esbuild and runs it for millions of rounds against
`math_vice_heat.json`, checking the round invariants every time:

```
credited-sum === totalWin | totalWin <= cap | no negative credits | deterministic re-derivation
```

Zero violations in every certified run. Point it at your port and you have an
apples-to-apples check against our numbers:

```
node sim_vice_core.mjs 20000000 --mode=natural --seed=4242424
node sim_vice_core.mjs 20000000 --mode=ante    --seed=771177
node sim_vice_core.mjs  2000000 --mode=buy4    --seed=553311   # buys run rounds/4
```

Expected: natural **96.46 %** ±1.59pp · buy3 **96.20%** · buy4 **95.97%** ·
ante **96.00 %** ±1.16pp.

⚠️ `../math/sim_vice.mjs` is the *older, independent* re-implementation. It does
**not** model tower multipliers and it carries an `--eval=corrected` flag from
the retracted D11. **Do not certify against it.** It is kept only as the
second-opinion implementation that cross-checked the base game.
