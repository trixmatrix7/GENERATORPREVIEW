# Vice Heat — Bonus Buys + 3×-FS-Chance Ante (certified FINAL 2026-07-22)

Alle Zahlen aus `math/vice_heat_expanding.json` → `custom.viceBuyStages` / `custom.anteBet`
(die Manifest-Blocks sind die Source of Truth; dieses MD ist die Erklärung).

## Buy Stages (gameData = abi.encode(uint8 stage))

| Stage | Kauf | Preis | RTP | Verteilung (Median / p90 / p99) | Max Win 5000× |
|---|---|---|---|---|---|
| 1 | 3 Scatter → 7 Expanding-Wild-Spins | **100× Einsatz** | 93.9% | 11.7× / 125× / 3960× | **1-in-203** |
| 2 | 4 Scatter → 10 Sticky-Tower-Spins | **200× Einsatz** | 95.25% | 73.5× / 358× / 3190× | **1-in-334** |

**Kern-Konzept (Noskis Entscheidung):** Die Preise sind SEINE Preispunkte; dafür spielt die
GEKAUFTE Runde eine eigene, zertifizierte Variante — die natürliche Runde bleibt unberührt:

- **Buy 3sc** (EV 92.9× + Forced-Board 0.95×): FS-Spins laufen auf wild-gebufften Strips
  (+1 Wild auf Reel 0 und Reel 4; Reel-4-Strip auf 41 Stops gepaddet als Feintrim).
  Die natürliche 3sc-Runde (Ø 22×, 1-in-67) bleibt exakt wie zertifiziert.
- **Buy 4sc** (EV 189.1× + Forced-Board 1.38×): Sticky-Runde mit **Tower-Cap 4** statt 3
  und **×2 auf jeden Spin, solange alle 4 Tower stehen** — das öffnet die Decke zum
  5000×-Cap (natürliche Cap-3-Runde toppt bei ~1400× aus). Ausbalanciert über
  Wild-Frequenz-Verdünnung: Reel 2 auf 340 Stops, Reel 1 auf 110 Stops gepaddet
  (Wild-/Scatter-ANZAHL pro Strip unverändert → Retrigger identisch verdrahtet).
  Die natürliche 4sc-Runde behält Cap 3 / ×1.

Sim-Basis: 300k (Stage 1) / 200k (Stage 2) forced Rounds auf dem zertifizierten Engine-Modell
(Session-Cap 5000×, Trigger-ScatterPay inklusive). Scripts: `custom-math/calibrate_vice_buy_fs_strips.py`,
`calibrate_buy4_cap4.py`, `confirm_buy4_final.py`, `dist_check_buy_rounds.py`.

**Presentation-Regel:** Der Kauf erzwingt die Stops des Basis-Spins so, dass das sichtbare
Board EXAKT die gekaufte Scatter-Anzahl trägt (deterministisch aus der Randomness; Settlement
kodiert die finalen Stops). Dadurch läuft die normale Landing-Choreo: 2 Scatter landen, der
Tease armt, der Rest droppt mit Anticipation. Das Forced Board wird VOLL ausgewertet
(Scatter-Pay + zufällige Linien-Wins zählen zum Payout, im Preis einkalkuliert) — Display == Payout.
Der Rundengewinn ist der autoritative `totalWin` aus dem Settlement.

**Engine-Hinweis:** Die Buy-FS-Strips haben UNGLEICHE Längen (41 / 340 / 110-gepaddet) —
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
