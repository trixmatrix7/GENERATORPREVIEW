# Vice Heat — Game Rules / Info Screen CONTENT (for the dev)

This is the **text + pricing content** for the in-game **Rules / Info** screens (the "?" / game-rules
button). Two pages, matching the generator's rules-screen layout. Format/styling is the dev's; the
**numbers, feature copy, paytable and pricing here are authoritative** and come straight from the
certified math (`math_vice_heat.json`, RTP 95.99%). Currency: the generator shows the player's token
(USDC in the live build). We author Vice in **€**; all values below are given as **× bet** (currency-
agnostic) with a €-on-1.00-bet example — use the multiplier, render the player's currency.

Symbol id → art mapping (so the dev wires the right icons): `0` Wild (money tower) · `1` Scatter/BONUS ·
`2` high_a · `3` high_b · `4` mid_c (sports car) · `5` mid_d (money case) · `6` low_e · `7` low_f · `8` low_g.

---

## PAGE 1 — How to Play & Features

**VICE HEAT** — 5×5, **3125 ways**. High volatility. **RTP 95.99%.** **Max win 5,000× bet.**

**Ways pays:** matching symbols on **adjacent reels from the leftmost reel** pay, in any position
(no fixed lines). Every extra matching symbol on a reel multiplies the ways. Minimum **3 in a row**.

**★ Sticky Expanding Wild** *(id 0)*
Whenever a Wild lands, its **entire reel expands to a full wall of Wilds** and pays as Wild across the
grid. Wilds **substitute for all paying symbols** (not the Scatter). Expanded Wild reels **stick** for
the rest of a free-spins feature.

**★ Free Spins** *(Scatter / BONUS, id 1)*
- **3 Scatters → 7 Free Spins** · **4 Scatters → 10 Free Spins** · **5 Scatters → 10 Free Spins.**
- In free spins, every Wild reel that lands **expands and stays locked** for the rest of the round.
- **Retrigger:** landing more Scatters during free spins awards **+3 Free Spins**.
- The multiplier value of the feature comes from the **expanding wild walls**, not a flat multiplier.

**★ Bonus Buy** — jump straight into free spins:
| Buy | Cost (× bet) | € on €1.00 bet | Gives |
|---|---|---|---|
| **Buy 3 Scatter** | **100× bet** | **€100.00** | 7 Free Spins (expanding wilds) |
| **Buy 4 Scatter** | **200× bet** | **€200.00** | 10 Free Spins (sticky expanding wilds) |

*(Note to dev: label must read the buy cost verbatim from `costMult` — **100× / 200×**. The live build
currently shows "300× bet" on the 4-scatter card; that is a derived-label bug, see FIXES doc §4b.)*

**★ Ante Bet — "3× Free Spins Chance"** (optional toggle, default OFF):
Raises the cost of **every spin to 3.25× bet** (€3.25 per spin on a €1.00 bet) and roughly **triples the
natural chance** of triggering the free-spins feature. Bonus Buy is disabled while the Ante is on.

---

## PAGE 2 — Paytable & Details

**Paytable** — pays are **per way, × bet** (the generator's per-way bps ÷ 10000). A win = per-way pay ×
number of ways × bet. Ordered high → low:

| Symbol (id) | 3 of a kind | 4 of a kind | 5 of a kind |
|---|---|---|---|
| **Wild** (0) | 0.0820× | 0.1341× | 0.2385× |
| **high_a** (2) | 0.0820× | 0.1341× | 0.2385× |
| **high_b** (3) | 0.0790× | 0.1192× | 0.1938× |
| **mid_c** (4) | 0.0768× | 0.1043× | 0.1565× |
| **mid_d** (5) | 0.0768× | 0.0969× | 0.1416× |
| **low_e** (6) | 0.0768× | 0.0894× | 0.1192× |
| **low_f** (7) | 0.0768× | 0.0857× | 0.1081× |
| **low_g** (8) | 0.0768× | 0.0820× | 0.0969× |
| **Scatter** (1) — pays anywhere | 0.0768× | 0.1490× | 0.4471× |

*(Raw certified bps, for the dev's paytable component: Wild/high_a `820/1341/2385`, high_b `790/1192/1938`,
mid_c `768/1043/1565`, mid_d `768/969/1416`, low_e `768/894/1192`, low_f `768/857/1081`, low_g `768/820/969`,
Scatter `768/1490/4471`.)*

**Wild** substitutes for all symbols **except Scatter**. **Scatter** pays anywhere on the grid and
triggers Free Spins (3+). Wild and high_a share the top pay.

**Game details**
- **RTP:** 95.99% (certified). · **Volatility:** High. · **Max win:** 5,000× bet (a round is capped at
  5,000× total; any excess is capped to 5,000×).
- **Grid:** 5 reels × 5 rows, **3125 ways**, left-to-right.
- **Bet range:** min bet as configured by the operator (studio reference min = 1.00).
- **Free spins** do not cost the bet; wins are added to the round total.
- **Malfunction voids all pays and plays.** All values are theoretical; actual results vary.

---

### For the dev — where this maps
- Numbers/pricing source of truth: `dev-handoff/math/vice_heat_expanding.json` = `src/data/math_vice_heat.json`
  (`payTable`, `scatterPay`, `custom.viceBuyStages` 100×/200×, `custom.anteBet.costMult` 3.25,
  `maxWinMultiplier` 5000, `freeSpinsCount` 7 / `freeSpinsCap` 10, `retriggerSpins` 3, `targetRtpPct` 95.99).
- Feature copy above mirrors the intro-card wording already shipped in the Vice intro art
  (`assets/vice-heat/intro/...`: "EXPANDS & STICKS FOR EXTRA SPINS", "3+ SCATTER START THE FEATURE",
  "WIN UP TO 5000X").
- If the rules screen has a fixed 2-page split, Page 1 = features + buys/ante pricing, Page 2 = paytable +
  RTP/max-win/terms (as laid out here).
