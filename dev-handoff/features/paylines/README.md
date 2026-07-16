# Paylines pay model (10 lines, 5×3) — drop-in evaluator

A classic **PAYLINES** win model as an alternative to the engine's ways
evaluation — used by the Crack Farm reference game. Universal: any 5×3 game
can adopt it by switching its pay model to `lines`.

## Rules (contract-portable)

- **10 fixed lines** (row index per reel, row 0 = top):
  `[1,1,1,1,1] [0,0,0,0,0] [2,2,2,2,2] [0,1,2,1,0] [2,1,0,1,2]
   [0,0,1,2,2] [2,2,1,0,0] [1,0,0,0,1] [1,2,2,2,1] [0,1,1,1,2]`
- **Leftmost-consecutive**: a line pays for the longest run of the same
  effective symbol starting at reel 0; 3+ matches pay `payTable[sym][n-3]`.
- **Wilds substitute**; the effective symbol is the first non-wild along the
  line (an all-wild line evaluates as HIGH_A — same rule as the ways engine).
- **Scatter breaks a line** and never pays on lines; scatters pay ANYWHERE
  (count over the whole board), identical to the ways model, and 3+/4+ trigger
  the tiered free spins.
- **Pay basis:** `payBps` = bps of the TOTAL bet per winning line (same basis
  as the ways model's per-way pay). The paytable must be tuned for lines —
  see `math/` (crack-farm manifest: `payModel: "lines"`, `custom.paylines: 10`).
- Each winning line yields ONE combination with exactly one cell per reel —
  the win-line comet (features/win-line/) renders it as a single clean beam,
  line by line.

## Preview implementation (reference)

- `src/game/paylineEval.ts` — the evaluator (WinResult-shaped output, so the
  whole presentation stack works unchanged).
- `src/game/winEval.ts` — the façade every non-engine call site uses
  (mock settlement + display). The frozen ways engine stays byte-identical;
  the façade switches per game.
- Contract side: port `paylineEval.ts` 1:1 into the settlement (it is pure,
  deterministic, and mirrors `custom-math/simulate_crack_farm.py`).

## Crack Farm free-spins features (same manifest)

- **3 scatters — ROAMING PLANT:** every FS spin exactly ONE wild-capable reel
  (seed-derived: `seed % capableReels`) is fully wild for that spin.
- **4 scatters — STICKY PLANTS + MULTI:** wild-landing reels become permanent
  plant towers (cap `stickyTowerCap` 3, leftmost first). A shared multiplier
  starts at 1×; line wins CROSSING a tower pay × multi; each tower-crossing
  winning connection then grows it `+plantMultiIncrement` (1), capped at
  `plantMultiCap` (20). Fully-wild reels contribute no scatters.
- Round lengths: 3sc = `freeSpinsCount` (8), 4sc = `stickyRoundSpins` (6),
  caps 11, retrigger +3, hard 5000× session cap (round stops, MAX WIN screen).

Certified (6M spins, k=1.3916): **RTP 95.9%** (alt-seed 95.6%), hit 44.6%,
fs3 1-in-41 avg 6.1×, fs4 1-in-451 avg 248× (max seen 3761×; the 5000× cap is
reachable in the deep tail via multi 20× on premium lines).
Reproduce: `python custom-math/simulate_crack_farm.py 1200000 6000000`
(env: `CF_STICKY_SPINS=6 CF_TARGET_RTP=93.5`).
