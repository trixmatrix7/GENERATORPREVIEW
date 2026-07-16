# 08 — PAYLINE systems (5×3 focus): rules, line sets, drop feel

> Analyst-authored (the web-research agents hit repeated API overloads; this
> is standard industry canon, cross-checked against the studio reports 01/06).

## How paylines pay — the seven rules

1. **A payline is a fixed path**: one cell per reel, defined per game. A win
   = the SAME symbol on CONSECUTIVE reels along the path, **starting at reel 1
   (leftmost)**. A gap breaks the line; reels 2-5 starting a run pay nothing.
2. **3-of-a-kind minimum** (2-oak only for select premiums in some games).
3. **Only the HIGHEST win per line pays** — never two wins on one line. With
   leading wilds both interpretations are scored (wilds AS substitute for the
   first non-wild vs. the pure wild run paying as its own/premium value) and
   the HIGHER is paid. Example (Book of Dead rule): `W W W J J` → 3-oak
   premium usually beats 5-oak Jack. ✅ implemented in `paylineEval.ts` +
   sim (2026-07-16, RTP re-certified 95.6%).
4. **Different lines pay independently** — the same symbols can be part of
   several line wins simultaneously; all are summed ("nur dasselbe Symbol
   was connected zählt PRO Linie, aber jede Linie zählt für sich").
5. **Wilds substitute for everything except scatter** (and bonus symbols).
6. **Scatter ignores lines entirely** — counts anywhere on the board, pays
   on total count, triggers the feature. Scatter breaks a line run.
7. **Line count is a bet-display convention**: 5, 9, 10, 20, 25, 243… "10
   lines" games (Book of Dead, Big Bass Bonanza) pay line wins as
   `paytable × line bet` where line bet = total bet / 10 — equivalently a
   per-line paytable in fractions of total bet (our model: payBps of TOTAL
   bet per line — same thing, pre-divided).

## The canonical 10-line set on 5×3

Numbers = row per reel (0 top, 1 middle, 2 bottom). This is the family used
by Book of Dead / Big Bass / classic Novomatic — and OUR Crack Farm set:

| # | Path | Shape |
|---|---|---|
| 1 | 1,1,1,1,1 | middle |
| 2 | 0,0,0,0,0 | top |
| 3 | 2,2,2,2,2 | bottom |
| 4 | 0,1,2,1,0 | V |
| 5 | 2,1,0,1,2 | Λ (inverted V) |
| 6 | 0,0,1,2,2 | stairs down |
| 7 | 2,2,1,0,0 | stairs up |
| 8 | 1,0,0,0,1 | top arc |
| 9 | 1,2,2,2,1 | bottom arc |
| 10 | 0,1,1,1,2 | soft diagonal |

Conventions: lines 1–3 are the rows (the most-hit lines), 4–5 the diagonals,
6–9 mirrored pairs, 10 a filler zigzag (varies per studio). 20/25-line games
add tighter zigzags (0,1,0,1,0 etc.). More lines = higher hit rate, smaller
average line win — 10 lines on 5×3 sits at ~25–45% hit rate depending on
strips (ours: 44.6%).

## Drop feel for LINE slots (vs ways)

- **Individual stops matter more**: every reel stop can complete/kill a line
  read, so line slots emphasize per-reel stop weight (hard thunk, pitch
  ladder L→R, last-reel emphasis) — exactly our crack-slam + pentatonic
  package. Ways slots read softer per-stop (the win is a fan, not a path).
- **Anticipation is reel-targeted**: with 2 scatters landed, ONLY the reels
  that can still complete the trigger slow down (ours: sequential gates ✓);
  the riser + duck carries it (✅ shipped 2026-07-16).
- **Premium 5-oak ceremony**: line slots make full-line premium hits feel
  huge via the win-line sweep + a dedicated line-win stinger; Book-of games
  add the expanding-symbol ceremony in FS.
- **Line-win presentation**: all-winners flash (~300–500ms) → then cycle
  line-by-line, ~0.8–1.2s per line, looping while idle; each line shows its
  own amount; non-winners dim 30–50%. The line draw sweeps left→right
  (our comet ✓). (All-winners flash first = 07 gap P2 #6, still open.)

## Our Crack Farm mapping

Rules 1–7 ✅ (rule 3 shipped today). Line set = canonical family ✅.
Presentation: comet line-by-line ✅, dim/frames ✅, all-winners pre-flash ❌,
per-line amount during tally ✅ (`spawnComboAmount`).
