# Vice Heat — Game Rules / Info Screen CONTENT (for the dev)

This is the **text + pricing content** for the in-game **Rules / Info** screens (the "?" / game-rules
button). Two pages, matching the generator's rules-screen layout. Format/styling is the dev's; the
**numbers, feature copy, paytable and pricing here are authoritative** and come straight from the
shipped preset (`dev-handoff/preset/vice-heat.chainwtf-preset.json` → `math.manifest`), certified
2026-07-28 with `custom-math/sim_vice_core.mjs` — the simulator that drives the live round core, so
what it measured is what the game pays. Currency: the generator shows the player's token
(USDC in the live build). We author Vice in **€**; all values below are given as **× bet** (currency-
agnostic) with a €-on-1.00-bet example — use the multiplier, render the player's currency.

> **⛔ If a rules screen still shows RTP 95.99% or a 0.0768× minimum pay, it is the pre-rescale set and
> it is void.** The paytable was rescaled and the free spins gained the **tower multipliers ×1–×5**; a
> screen built on the old numbers under-quotes every pay on the table, misstates the RTP, and omits the
> mechanic that carries the bonus. The superseded set is kept at the bottom of this file, clearly marked
> as history, so nobody re-derives it.

Symbol id → art mapping (so the dev wires the right icons): `0` Wild (money tower) · `1` Scatter/BONUS ·
`2` high_a · `3` high_b · `4` mid_c (sports car) · `5` mid_d (money case) · `6` low_e · `7` low_f · `8` low_g.

---

## PAGE 1 — How to Play & Features

**VICE HEAT** — 5×5, **3125 ways**. High volatility. **RTP 96.46%** (natural play). **Max win 5,000× bet.**

**Ways pays:** matching symbols on **adjacent reels from the leftmost reel** pay, in any position
(no fixed lines). Every extra matching symbol on a reel multiplies the ways. Minimum **3 in a row**.

**★ Sticky Expanding Wild** *(id 0)*
Wilds **substitute for all paying symbols** (not the Scatter). **During Free Spins**, any reel that
lands a Wild **expands to a full wall of Wilds** and pays as Wild down the whole column. In the
**4-Scatter** feature those expanded reels **stick** for the rest of the round — up to all **5** reels
can stand wild at once. In the **base game** a Wild pays where it lands and does **not** expand,
except on a **Hot Spin** (below).

**★ Tower Multipliers ×1–×5** *(free spins)*
Every reel standing **fully wild during a free spin** carries a **multiplier badge from ×1 to ×5**,
shown on the tower. A winning combination pays **× the highest badge it crosses** — badges are never
added together and never multiplied with each other. A **sticky** tower keeps the badge it arrived
with for the rest of the round; in the 7-spin (3-Scatter) round the towers re-form every spin and are
dealt **fresh badges every spin**. Scatter pays are not multiplied.

**★ Free Spins** *(Scatter / BONUS, id 1)*
- **3 Scatters → 7 Free Spins** · **4 Scatters → 10 Free Spins** · **5 Scatters → 10 Free Spins.**
- **3 Scatters:** Wild reels expand **for that spin** and are dealt again on the next one.
- **4 or 5 Scatters:** every Wild reel that lands **expands and stays locked** for the rest of the round.
- **Retrigger:** landing 3 or more Scatters during free spins awards **+3 Free Spins**, up to a round
  maximum of **10** spins in the 3-Scatter feature and **13** spins in the 4/5-Scatter feature.
- There is **no flat free-spins multiplier**: the value of the feature comes from the expanding wild
  walls and their **×1–×5 tower badges**.

**★ Max Win — 5,000× bet**
Fill the grid with **5 full Wild reels** during a free spin and the round pays **5,000× bet instantly**
and ends — nothing is multiplied on top, it is already the maximum. Independently of that, a round's
total win is **capped at 5,000× bet**.

**★ Hot Spin** *(base game)*
On average **1 base-game spin in 80** turns hot: every reel holding a Wild expands to a full Wild reel
and the spin pays its ways win as normal — no badge, no extra multiplier. If all 5 reels go hot, that is
an instant **5,000× max win** in the base game. Hot Spins do not occur on a bought round.

**★ Bonus Buy** — jump straight into free spins:
| Buy | Cost (× bet) | € on €1.00 bet | Gives |
|---|---|---|---|
| **Buy 3 Scatter** | **100× bet** | **€100.00** | 7 Free Spins (expanding wilds + ×1–×5 badges) |
| **Buy 4 Scatter** | **200× bet** | **€200.00** | 10 Free Spins (sticky wilds + ×1–×5 badges), **Wild tower guaranteed** |

**Guaranteed Wild tower** on the 4-Scatter buy: if the first free spin would land no full Wild reel, one
is placed for you — a bought tower round always shows a tower.

*(Note to dev: the label must read the buy cost verbatim from `costMult` — **100× / 200×**; the preset
also ships the finished strings as `custom.viceBuyStages[].label` = `"100X BET"` / `"200X BET"`. Do not
derive the price from a single scalar buy cost — the dev engine only has one, which is exactly why the
staged buys are FIXES doc **D3**; a derived label is how a 4-scatter card ends up quoting a price the
game does not charge. The guarantee is FIXES doc **D13** / `custom.viceBuyStages[1].guaranteedTowerOnFirstSpin`,
**bought rounds only** — do not promise it on a naturally triggered round. The price is unchanged at 200×.)*

**★ Ante Bet — "3× Free Spins Chance"** (optional toggle, default OFF):
Raises the cost of **every spin to 3.25× bet** (€3.25 per spin on a €1.00 bet) and roughly **triples the
natural chance** of triggering the free-spins feature. Bonus Buy is disabled while the Ante is on.

---

## PAGE 2 — Paytable & Details

**Paytable** — pays are **per way, × bet** (the generator's per-way bps ÷ 10000). A win = per-way pay ×
number of ways × bet, and in free spins × the highest tower badge the combination crosses. The Scatter
row is the exception: it is a flat **× bet** pay, not per way. Ordered high → low:

| Symbol (id) | 3 of a kind | 4 of a kind | 5 of a kind |
|---|---|---|---|
| **Wild** (0) | 0.1243× | 0.2034× | 0.3616× |
| **high_a** (2) | 0.1243× | 0.2034× | 0.3616× |
| **high_b** (3) | 0.1198× | 0.1808× | 0.2938× |
| **mid_c** (4) | 0.1164× | 0.1582× | 0.2373× |
| **mid_d** (5) | 0.1164× | 0.1469× | 0.2147× |
| **low_e** (6) | 0.1164× | 0.1356× | 0.1808× |
| **low_f** (7) | 0.1164× | 0.1299× | 0.1638× |
| **low_g** (8) | 0.1164× | 0.1243× | 0.1469× |
| **Scatter** (1) — pays anywhere | 0.1164× | 0.2260× | 0.6780× |

*(Raw certified bps, for the dev's paytable component — `math.manifest.payTable` / `scatterPay`, verbatim:
Wild/high_a `1243/2034/3616`, high_b `1198/1808/2938`, mid_c `1164/1582/2373`, mid_d `1164/1469/2147`,
low_e `1164/1356/1808`, low_f `1164/1299/1638`, low_g `1164/1243/1469`, Scatter `1164/2260/6780`. The pay
floor is **1164 bps = 0.1164×**, not the old 768. Do not rescale, do not round to 2 decimals in the data —
render 4 decimals or the token amount.)*

**Wild** substitutes for all symbols **except Scatter**. **Scatter** pays anywhere on the grid, is added
to the round total (it is **not** a per-way pay and is **never** multiplied by a tower badge), and
triggers Free Spins at 3+. **6 or more Scatters still pay the 5-Scatter amount.** Wild and high_a share
the top pay.

**Game details**
- **RTP:** **96.46%** for natural play (certified over 20,000,000 rounds). The optional purchases are
  certified separately and disclosed separately: **Buy 3 Scatter 96.20%**, **Buy 4 Scatter 95.97%**,
  **Ante Bet 96.00%**.
- **Volatility:** High. · **Max win:** **5,000× bet** — reached either instantly, on 5 full Wild reels,
  or by the round total hitting the 5,000× cap (any excess is capped to 5,000×).
- **Grid:** 5 reels × 5 rows, **3125 ways**, left-to-right.
- **Bet range:** min bet as configured by the operator (studio reference min = 1.00).
- **Free spins** do not cost the bet; wins are added to the round total.
- **Malfunction voids all pays and plays.** All values are theoretical; actual results vary.

---

### For the dev — where this maps
- Numbers/pricing source of truth: `dev-handoff/preset/vice-heat.chainwtf-preset.json` → **`math.manifest`**
  (mirrored by `dev-handoff/math/vice_heat_expanding.json`): `payTable`, `scatterPay`,
  `custom.viceBuyStages` 100×/200× (both `stickyTowerCap` **5**; stage 2 also `guaranteedTowerOnFirstSpin`),
  `custom.anteBet.costMult` 3.25, `custom.towerMultiplierWeights` `[55,20,9,6,10]`,
  `custom.fullBoardInstantMaxWin` true, `custom.hotSpinChance1In` 80, `maxWinMultiplier` 5000,
  `minWager` 10000, `freeSpinsCount` 7 / `freeSpinsCap` 10 / `custom.stickyRoundSpins` 10 /
  `custom.stickyRoundCap` 13, `retriggerSpins` 3, `freeSpinMultiplier` 1.
- **Read the RTP from `rtpBps` = 9670.** `targetRtpPct` in the shipped preset is **96** and is display
  metadata only — the preset states this itself (`extras.rtpNote`: *"rtpBps is the operative certified RTP;
  targetRtpPct is display metadata only"*). There is **no** `targetRtpPct` 95.99 in the shipped preset;
  if your build shows one, you ingested an old manifest. The per-mode percentages on Page 2 come from
  `math.manifest.simResults` and `dev-handoff/math/RTP_VERIFICATION.md`; the `certifiedRtpPct` fields
  inside `viceBuyStages` are per-stage fit metadata, not the headline figures.
- Feature copy above matches the shipped Vice intro cards (`assets/theme/vice/intro/game/…`, positioned by
  `assets/introLayers.json`): the expanding/sticky wild card, the scatter card, the max-win card. Their
  wording is baked into the art, so if the rules screen and the intro art disagree, change both together.
  **Note:** those cards predate the tower multipliers — `intro/game/` has no ×1–×5 card, so the rules
  screen is currently the only place the badge mechanic is explained in words.
- If the rules screen has a fixed 2-page split, Page 1 = features + buys/ante pricing, Page 2 = paytable +
  RTP/max-win/terms (as laid out here).

---

### ⛔ HISTORY — superseded, do NOT ship (kept so nobody re-derives it)

Everything in this block was correct for an **earlier** build of Vice Heat and is **void** now. It is
recorded only so that an old rules screen, screenshot or spreadsheet can be recognised as stale.

- **Void RTP figures:** 95.99% (with `rtpBps` 9599 / `targetRtpPct` 95.99), and 95.91 / 95.93 / 96.11 /
  96.40 / 95.52 / 94.3 / 71.8. The 95.9x family predates the tower multipliers; the 96.11 / 96.40 pair came
  from an evaluator we wrongly believed was a fix (it was retracted — see `RTP_VERIFICATION.md`); 94.3 was
  a 4M-round point estimate inside its own noise band. **Current: 96.46% natural, `rtpBps` 9670.**
- **Void paytable** (pre-rescale, pay floor `768` bps = 0.0768×): Wild/high_a `820/1341/2385`, high_b
  `790/1192/1938`, mid_c `768/1043/1565`, mid_d `768/969/1416`, low_e `768/894/1192`, low_f `768/857/1081`,
  low_g `768/820/969`, Scatter `768/1490/4471`. Ship these and every quoted pay is roughly a third short of
  what the game actually pays.
- **Retired mechanics — never describe these to a player:** the simultaneous-expansion multiplier ladder
  (`simulExpandMultipliers` ×2 / ×10) — the key does not exist in the preset any more; the FULL HOUSE ×2
  doubling (`stickyFullBoardMultiplier` is **1** = off); sticky tower caps of **3** or **4** (the cap is
  **5**). A rules screen promising a ×10 four-reel alignment or a doubled full board promises a win the
  game cannot pay — that is a paytable-mismatch complaint waiting to happen.
