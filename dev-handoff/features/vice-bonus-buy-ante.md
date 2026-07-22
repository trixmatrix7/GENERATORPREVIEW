# Vice Heat — Bonus Buys + 3×-FS-Chance Ante (certified FINAL 2026-07-22)

Alle Zahlen aus `math/vice_heat_expanding.json` → `custom.viceBuyStages` / `custom.anteBet`
(die Manifest-Blocks sind die Source of Truth; dieses MD ist die Erklärung).

## Buy Stages (gameData = abi.encode(uint8 stage))

| Stage | Kauf | Preis | RTP | Verteilung (Median / p90 / p99) | Max Win 5000× |
|---|---|---|---|---|---|
| 1 | 3 Scatter → 7 Expanding-Wild-Spins | **100× Einsatz** | 94.1% | 15.1× / 163× / 2729× | **1-in-8333** |
| 2 | 4 Scatter → 10 Sticky-Tower-Spins | **200× Einsatz** | 94.65% | 107× / 427× / 745× | **1-in-822** |

FINAL-Retune (Noski): 4sc hat die deutlich BESSERE Max-Win-Chance als 3sc, beide
sind seltener als die erste Kalibrierung (vorher 1-in-203 / 1-in-334) — mehr Body,
weniger Lotterie.

**Kern-Konzept (Noskis Entscheidung):** Die Preise sind SEINE Preispunkte; dafür spielt die
GEKAUFTE Runde eine eigene, zertifizierte Variante — die natürliche Runde bleibt unberührt:

- **Buy 3sc** (EV 93.1× + Forced-Board 0.95×): FS-Spins laufen auf wild-gebufften Strips
  (+1 Wild auf Reels 0, 3 und 4) und die Kauf-Runde nutzt eine gezähmte
  Simul-Expand-Tabelle **{3:2, 4:6}** statt der natürlichen {3:2, 4:10} — das
  nimmt den Cap-Tail raus (1-in-8333 statt 1-in-203) und schiebt den EV in den
  Body (Median 15× statt 12×). Die natürliche 3sc-Runde (Ø 22×, 1-in-67,
  Tabelle {3:2,4:10}) bleibt exakt wie zertifiziert.
- **Buy 4sc** (EV 187.9× + Forced-Board 1.38×): Sticky-Runde mit **Tower-Cap 4** statt 3
  und **×2 auf jeden Spin, solange alle 4 Tower stehen** — das öffnet die Decke zum
  5000×-Cap (natürliche Cap-3-Runde toppt bei ~1400× aus; Max Win jetzt 1-in-822).
  Ausbalanciert über +1 Wild auf Reel 1 und Wild-Frequenz-Verdünnung auf Reel 2
  (Strip auf 2240 Stops gepaddet; Wild-/Scatter-ANZAHL pro Strip unverändert →
  Retrigger identisch verdrahtet). Die natürliche 4sc-Runde behält Cap 3 / ×1.

Sim-Basis: 800k (Stage 1) / 300k (Stage 2) forced Rounds auf dem zertifizierten Engine-Modell
(Session-Cap 5000×, Trigger-ScatterPay inklusive). Alle Scripts + Ergebnis-JSONs liegen in
**`math/sims/`** (siehe dortiges README; `retune_buy_tails.py` ist der finale Lauf).

**Presentation-Regel:** Der Kauf erzwingt die Stops des Basis-Spins so, dass das sichtbare
Board EXAKT die gekaufte Scatter-Anzahl trägt (deterministisch aus der Randomness; Settlement
kodiert die finalen Stops). Dadurch läuft die normale Landing-Choreo: 2 Scatter landen, der
Tease armt, der Rest droppt mit Anticipation. Das Forced Board wird VOLL ausgewertet
(Scatter-Pay + zufällige Linien-Wins zählen zum Payout, im Preis einkalkuliert) — Display == Payout.
Der Rundengewinn ist der autoritative `totalWin` aus dem Settlement.

**Engine-Hinweis:** Die Buy-FS-Strips haben UNGLEICHE Längen (56 / 76 / 2240) —
Stop-Ableitung muss pro Reel mit der eigenen Strip-Länge rechnen (`reelLengths` beim
Strips-Swap mitziehen).

## Ante — „3× FREE SPINS CHANCE" (gameData = abi.encode(uint8 3) pro Spin)

- **Kosten:** 3.25× Einsatz pro Spin, zertifizierter RTP **94.9%** (2M Spins)
- **Strips:** Basis-Strips + 1 Extra-Scatter auf den ersten 3 der 5 Strips —
  komplette Ante-Strips in `custom.anteBet.reelStrips`
- **Wirkung:** natürliche Trigger-Chance 1-in-63 → **1-in-18** (×3.47)
- Achtung: Scatter-Dichte wirkt ~kubisch auf die Trigger-Chance — „3× Scatter auf
  den Strips" wäre ×17 Trigger gewesen, nicht ×3.

## UI (Platzhalter, Dev linkt finale Card-Art)

Runder BONUS-BUY-Button links neben dem Reel-Rand (58px). Buy-Page: Ante-Toggle-Karte +
2 Buy-Karten, Preise dynamisch aus dem Manifest ($100 / $200 bei $1 Einsatz).
Flow: Karte → Confirm-Dialog → Session mit wager = bet × costMult.
