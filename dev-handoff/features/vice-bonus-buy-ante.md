# Vice Heat — Bonus Buys + 3×-FS-Chance Ante (certified 2026-07-22)

Alle Zahlen aus `math/vice_heat_expanding.json` → `custom.viceBuyStages` / `custom.anteBet`
(die Manifest-Blocks sind die Source of Truth; dieses MD ist die Erklärung).

## Buy Stages (gameData = abi.encode(uint8 stage))

| Stage | Kauf | Preis | zertifizierter RTP | EV-Zerlegung |
|---|---|---|---|---|
| 1 | 3 Scatter → 7 Expanding-Wild-Spins | **24× Einsatz** | 95.8% | FS-Runde 22.114× + Forced-Board 0.951× |
| 2 | 4 Scatter → 10 Sticky-Tower-Spins | **295× Einsatz** | 95.7% | FS-Runde 280.943× + Forced-Board 1.381× |

Sim-Basis: 400k (Stage 1) / 200k (Stage 2) forced Rounds auf dem zertifizierten
Modell (rtpBps 9599), Session-Cap 5000×.

**Presentation-Regel:** Der Kauf erzwingt die Stops so, dass das sichtbare Board
EXAKT die gekaufte Scatter-Anzahl trägt (je Scatter-Reel genau 1 Scatter im
Fenster, alle anderen Reels scatter-frei — deterministisch aus der Randomness,
Settlement kodiert die finalen Stops). Dadurch läuft die normale Landing-Choreo:
2 Scatter landen, der Tease armt, der Rest droppt mit Anticipation. Das Board
wird VOLL ausgewertet (Scatter-Pay + zufällige Linien-Wins zählen zum Payout,
sind im Preis einkalkuliert) — Display == Payout.

**Warum nicht 100×/250×:** Das zertifizierte FS-Modell hat eine HÄUFIGE, kleine
3sc-Runde (1-in-67, Ø 22×) und eine SELTENE, große 4sc-Runde (1-in-922, Ø 281×).
Bei 100× wäre der 3sc-Buy 22% RTP (Abzocke), bei 250× wäre der 4sc-Buy 112%
(Spieler-Plus). Preise folgen dem EV: 24× / 295× → beide ~95-96%.

## Ante — „3× FREE SPINS CHANCE" (gameData = abi.encode(uint8 3) pro Spin)

- **Kosten:** 3.25× Einsatz pro Spin, zertifizierter RTP **94.9%** (2M Spins)
- **Strips:** Basis-Strips + 1 Extra-Scatter auf den ersten 3 der 5 Strips
  (gegenüber dem vorhandenen Scatter eingesetzt, ersetzt das häufigste Low) —
  komplette Ante-Strips stehen in `custom.anteBet.reelStrips`
- **Wirkung:** natürliche Trigger-Chance 1-in-63 → **1-in-18** (×3.47)
- Achtung Skalierung: Scatter-Dichte wirkt ~kubisch auf die Trigger-Chance —
  „3× Scatter auf den Strips" wäre ×17 Trigger gewesen, nicht ×3.

## UI (Platzhalter, Dev linkt finale Card-Art)

Runder BONUS-BUY-Button links unten neben dem Reel-Rand (58px, Abstand zum
Frame). Buy-Page: Ante-Toggle-Karte + 2 Buy-Karten (Preise dynamisch aus dem
Manifest). Flow: Karte → Confirm-Dialog → Session mit wager = bet × costMult.
