# Vice Heat — Bonus Buys + 3×-FS-Chance Ante (Stand 2026-07-28)

> **DIESES DOKUMENT WURDE AM 2026-07-28 KOMPLETT NEU GESCHRIEBEN.** Die vorherige
> Fassung war die Kalibrierung vom 2026-07-22. Sie beschreibt Mechaniken, die es im
> ausgelieferten Preset NICHT MEHR GIBT (Simul-Expand-Tabellen, Tower-Cap 4 / 3,
> Full-House-×2) und RTP-Zahlen, die vor den Tower-Multiplikatoren gemessen wurden.
> Wer danach baut, liefert ein anderes Spiel aus als das, was im Preset steht — und
> zwar eines, dessen Freispiele rund 1.5–2 Prozentpunkte zu wenig zahlen. Die alte
> Fassung steht unten unter **HISTORIE (VOID)**, damit sie niemand neu herleitet.

Source of Truth ist das ausgelieferte Preset `preset/vice-heat.chainwtf-preset.json`:
`math.manifest.custom.viceBuyStages` und `math.manifest.custom.anteBet` für die Regeln,
`math.manifest.simResults` für die Zertifizierung. Dieses MD ist nur die Erklärung dazu.
Referenz-Implementierung: `src/game/viceSpin.ts` (der Live-Rundenkern) und
`src/dev/mockHost.ts`.

## Buy Stages

`gameData = abi.encode(uint8)`: **1 = Buy 3 Scatter, 2 = Buy 4 Scatter, 3 = Ante**
(`src/dev/mockHost.ts:237,250-262`).

| Stage | Kauf | Preis (`costMult`) | Spins | Tower-Cap | zertifizierter RTP |
|---|---|---|---|---|---|
| 1 | 3 Scatter → Freispiele mit Expansion pro Spin | **100× Einsatz** | 7 (Cap 10) | 5 | **96.20%** ±0.49pp (2M Runden, Seed 90210) |
| 2 | 4 Scatter → Sticky-Tower-Freispiele | **200× Einsatz** | 10 (Cap 13) | 5 | **95.97%** ±0.56pp (2M Runden, Seed 90210) |

Spins/Caps kommen NICHT aus dem Stage-Block — die Stages überschreiben sie nicht:
`freeSpinsCount 7`, `freeSpinsCap 10`, `stickyRoundSpins 10`, `custom.stickyRoundCap 13`,
Retrigger **+3** (`retriggerSpins`), `freeSpinMultiplier 1`.

**Zertifizierung immer aus `math.manifest.simResults` lesen, nicht aus den Stage-Feldern.**
`viceBuyStages[].certifiedRtpPct` (96.17 bei Stage 1) und `certifiedRounds: 8000000` sind
Doku-Reste und decken sich mit keinem Lauf im simResults-Block. Was tatsächlich gelaufen ist:

- **Buy 3sc:** 96.20% ±0.49pp, 500 000 Runden, Seed 90210, `math/sim_vice_core.mjs`
  (fährt den Live-Rundenkern `src/game/viceSpin.ts`, zahlt also exakt das, was das Spiel zahlt).
- **Buy 4sc:** Primärlauf Live-Kern 95.85 % ±2.47pp (100k, Seed 90210) — Intervall zu breit;
  bestätigt durch den unabhängigen Simulator mit **96.075 % ±0.394pp (4M)** und durch denselben
  Live-Kern auf FRISCHEM Seed mit **96.337 % ±1.117pp (500k, Seed 553311)**. Max Win **1-in-143**
  (Fresh-Seed-Lauf: 1-in-135). Null Cap-Verletzungen, null Invarianten-Brüche in allen Läufen.
- Verteilung der gekauften 4sc-Runde (Fresh-Seed-Lauf, nicht im Preset hinterlegt):
  Median 17.1× / p90 391× / p99 3905×, Mittel 190×, Maximum = der 5000×-Deckel.
- Für Buy 3sc liegt aktuell **keine** Verteilungs- oder Max-Win-Frequenz vor. Die alten
  Zahlen (1-in-8333, Median 15.1× …) sind VOID und dürfen nicht als Ersatz dienen.

### Was die gekaufte Runde von der natürlichen unterscheidet

Nur vier Dinge — die Mechanik selbst ist identisch:

1. **Forciertes Trigger-Board** mit exakt der gekauften Scatter-Anzahl (`forceScatterStops`).
2. **Eigene FS-Strips pro Stage** (siehe unten).
3. **Stage 2: Tower-Garantie auf dem ersten Freispiel** (`guaranteedTowerOnFirstSpin`).
4. **Keine Hot Spins.** `viceSpin.ts:371` gated den Hot Spin auf `!buyStage` — die Expansion
   würde über die forcierten Scatter laufen und den Trigger löschen, für den bezahlt wurde.
   Hot Spins gibt es nur auf natürlichen und Ante-Basisspins (1-in-80).

Es gibt **keine** Simul-Expand-Tabelle und **keinen** Full-House-Multiplikator mehr:
`custom.simulExpandMultipliers` existiert im Preset nicht, `custom.stickyFullBoardMultiplier`
steht auf **1 = AUS** (und die Stages tragen keinen eigenen Wert). 1–4 volle Wild-Reels zahlen
natürliche Ways.

### Tower-Multiplikatoren ×1–×5 (gelten auch in der Kauf-Runde)

Jedes Reel, das in einem Freispiel VOLL WILD steht, bekommt ein Badge aus
`custom.towerMultiplierWeights [55,20,9,6,10]`. Eine Gewinnkombination zahlt × das **HÖCHSTE**
Badge, das sie überquert — nicht das Produkt (gemessen 187 % RTP auf der gekauften 4sc-Runde)
und nicht die Summe (Boden 90.53 %). Scatter-Pay wird nie multipliziert, auf dem Instant Max Win
liegt nichts oben drauf, Hot Spins tragen kein Badge. Ein Sticky-Tower (4sc) behält das Badge,
das er beim EINSTIEG bekommen hat; die 3sc-Runde expandiert jeden Spin neu und zieht neu.
Badge-Draw aus reserviertem Seed-Namespace `keccak(seed, 1<<200)` (`viceSpin.ts:191`) — der
Stop-Stream bleibt unberührt. Details: `features/tower-multipliers/`.
**Ohne dieses Feature zahlen die Freispiele einen Boden von 71.6 % gegen zertifizierte 96.46 %.**

### GUARANTEED TOWER — nur Buy 4 Scatter (`guaranteedTowerOnFirstSpin`)

Die 4sc-Runde wird als Tower-Runde verkauft, ihre Strips sind aber bewusst dünn, um 96 % zu
halten — **15.5 % der gekauften Runden (1 in 6.4) endeten ohne einen einzigen Tower.**

Fix: Landet das ERSTE Freispiel mit keinem einzigen expandierenden Reel, rutscht der Stop von
**Reel 0** (`guaranteedTowerReel: 0`) vorwärts auf den nächsten Stop, dessen 5-Zeilen-Fenster ein
Wild trägt — derselbe Vorwärts-Scan, der schon das gekaufte Trigger-Board setzt
(`applyGuaranteedTower`, `viceSpin.ts:171-184`). Reine Funktion der Stops: es wird KEINE neue
Randomness verbraucht und kein anderes Board bewegt sich.

Reel 0 ist nicht kosmetisch: die Engine faltet ein Wild in Spalte 0 zu HIGH_A
(`SlotGame.sol:341`), damit kostet dieser Tower ~10× weniger RTP als jeder andere.

| | vorher | jetzt |
|---|---|---|
| Runden ohne Tower | 15.49 % | **0 %** |
| Garantie feuert | — | 83.56 % der Runden |
| Tower am Rundenende 0/1/2/3/4/5 | 15.5 / 35.2 / 31.7 / 14.2 / 3.2 / 0.3 | 0 / 30.5 / 42.2 / 21.9 / 5.1 / 0.4 |
| Ø Tower am Rundenende | 1.552 | **2.028** |

Gegenfinanziert über die neu gefitteten Stage-Strips (22/17/17/17/17 → 24/16/16/16/15 Wilds).
**Preis bleibt 200×.** Gilt ausschließlich für gekaufte Runden — ein natürlicher oder Ante-4sc-
Trigger bleibt unangetastet (die Garantie ist auf das Stage-Flag gegated).

### Max Win

`maxWinMultiplier 5000`, `minWager 10000`. Es gibt genau **zwei** Wege dorthin:

1. **FULL BOARD** — 5 voll wilde Reels zahlen sofort exakt `maxWinMultiplier × Einsatz` und
   beenden die Runde (`custom.fullBoardInstantMaxWin`), in BEIDEN Bonus-Stufen, ohne dass
   irgendetwas obendrauf multipliziert wird.
2. Der laufende Deckel auf `maxWinMultiplier × Wager`.

Es gibt keinen dritten Weg — insbesondere keinen Full-House-×2-Stapel.

### Strips der Kauf-Runden

| Stage | FS-Strips | Wilds/Reel | Scatter/Reel |
|---|---|---|---|
| 1 (Buy 3sc) | eigene, 1215 Stops × 5 | 42 | 9 |
| 2 (Buy 4sc) | eigene, 2406 Stops × 5 | 24 / 16 / 16 / 16 / 15 | 18 |

**Die Stop-Arrays VERBATIM ausliefern.** Bei dieser Wild-Dichte ist die ANORDNUNG ein Hebel
erster Ordnung, die Strips lassen sich nicht aus den Wild-Zahlen regenerieren: dasselbe Multiset
in anderer Mischung maß bei Stage 1 96.19 / 92.47 / 90.56 / 92.61 %, bei Stage 2 95.88 % gegen
99.21 % (`fsStripsRule` im jeweiligen Stage-Block).

**Engine-Hinweis:** Innerhalb einer Stage sind alle 5 Strips gleich lang, aber sie sind LÄNGER als
alles andere im Spiel — Basis-Strips 40 Stops, natürliche FS-Strips 1170 Stops, Stage 1215 bzw.
2406. Die Stop-Ableitung muss pro Reel mit der GERADE GÜLTIGEN Strip-Länge rechnen, `reelLengths`
also beim Strips-Swap mitziehen. Und: **das DISPLAY muss dieselben Strips rollen, die das
Settlement auswertet** — sonst markieren die Gewinne die falschen Zellen (genau dieser Bug ist uns
in einer gekauften Runde passiert).

**Presentation-Regel:** Der Kauf erzwingt die Stops des Basis-Spins so, dass das sichtbare Board
EXAKT die gekaufte Scatter-Anzahl trägt (deterministisch aus der Randomness; das Settlement
kodiert die finalen Stops). Dadurch läuft die normale Landing-Choreo: 2 Scatter landen, der Tease
armt, der Rest droppt mit Anticipation. Das Forced Board wird VOLL ausgewertet (Scatter-Pay +
zufällige Ways-Wins zählen zum Payout, im Preis einkalkuliert) — Display == Payout. Der
Rundengewinn ist der autoritative `totalWin` aus dem Settlement.

## Ante — „3× FREE SPINS CHANCE" (`gameData = abi.encode(uint8 3)` pro Spin)

- **Kosten:** 3.25× Einsatz pro Spin (`custom.anteBet.costMult`).
- **Zertifiziert: 96.00 % ±1.16pp über 20 000 000 Runden** (`sim_vice_core.mjs`, Live-Kern,
  Seed 771177, 2026-07-28) — Hit-Frequenz 74.93 %, Ø-Streuung 20.2× Einsatz pro Runde,
  Max Win 1-in-11581, null Cap-Verletzungen.
- **Attribution (% vom Wager):** Basis 24.70 / Hot 6.84 / FS-3sc 14.48 / FS-4sc 49.98.
- **Trigger im 20M-Lauf:** 3 Scatter 1-in-20.5, 4+ Scatter 1-in-172.4, Hot Spins 1-in-80.1.
  Gegen natürlich 1-in-63.3 → 1-in-18.31 gesamt, also **×3.47**.
- **Strips (`custom.anteBet.reelStrips`, komplett im Preset):** 320 Stops = Basis-Mix ×8, mit
  VERDOPPELTEN Scattern auf den ersten drei Reels (16/16/16/8/8 gegen 8/8/8/8/8 skaliert) UND
  ANGEHOBENER Wild-Dichte 17/17/16/16/16 = 5.3 % der Stops gegen 2.5 % natürlich. Die Wild-Dichte
  ist kein Nebeneffekt, sondern der Hebel: die Freispiele der Ante rollen die GETEILTEN
  `fsReelStrips` (1170 Stops, 10 Wilds/Reel), bei fest 1-in-18 Trigger liegt das FS-Einkommen
  damit bei ~1.8× Einsatz — der Rest des 3.25×-Preises muss aus den Ante-BASISSPIELEN kommen.
- **Achtung Scatter-Dichte:** wirkt ~kubisch auf die Trigger-Chance — „3× Scatter auf den Strips"
  wäre ×17 Trigger gewesen, nicht ×3.
- **Achtung Hot-Spin-Abhängigkeit:** der Ante-Fit lehnt sich rund doppelt so stark an Hot Spins
  wie das natürliche Spiel. Mit Hot Spins 96.00 %, ohne sie ~84 %. Wenn Hot Spins je entfallen,
  MUSS die Ante neu gefittet werden (buy3/buy4 sind unberührt — Hot feuert nie auf einer
  gekauften Runde).
- **Achtung Messgröße:** ~20× Einsatz Streuung pro Runde. Ein 4M-Lauf trägt ±2.54pp — unserer las
  94.3 % und war reines Rauschen. **Die Ante nie unter ~20M Runden nachfitten.**

## UI (`src/ui/BonusBuyOverlay.tsx` → `ViceBuyRail`, ab Zeile 375)

Runder Buy-Button (66×66, `btn.png`), der UNTER dem Logo auf der linken Rail andockt — PixiApp
broadcastet die Logo-Mitte (`slot:leftrail`), der Button folgt ihr. Ist die Ante aktiv, trägt er
ein „3xFS"-Badge.

Buy-Page = ein Composite-Bild (`page_on.png` bei aktiver Ante, sonst `page_off.png`) mit drei
unsichtbaren Hotspots über den gemalten Karten: **links = Ante-Toggle** (schaltet direkt, kein
Confirm), **Mitte = Buy 3 Scatter**, **rechts = Buy 4 Scatter**. Die Preise werden zur Laufzeit
aus dem Manifest gerechnet (Einsatz × `costMult`, bei 1er-Einsatz also 100 / 200) und in die
schmale graue Pille skaliert. Flow: Karte → Confirm-Dialog → Session mit `wager = bet × costMult`.
Labels aus dem Preset: `"100X BET"` / `"200X BET"` / `"3x FREE SPINS CHANCE"`.

---

## HISTORIE (VOID) — die Fassung vom 2026-07-22

Steht hier nur, damit sie nicht versehentlich neu hergeleitet wird. **Nichts davon einbauen.**

Das alte Dokument beschrieb:

- **Simul-Expand-Multiplikatoren** — Kauf-3sc mit einer „gezähmten" Tabelle `{3:2, 4:6}` gegen
  natürliche `{3:2, 4:10}`. → `custom.simulExpandMultipliers` wurde GELÖSCHT und existiert im
  Preset nicht mehr. 1–4 Wild-Reels zahlen natürliche Ways; die Freispiel-RTP trägt heute der
  Tower-Multiplikator ×1–×5.
- **Tower-Cap 4 für die Kauf-Runde, Cap 3 natürlich.** → Der Cap ist überall **5**
  (`custom.stickyTowerCap`, und beide Stages tragen ebenfalls `stickyTowerCap: 5`).
- **„×2 auf jeden Spin, solange alle Tower stehen" als Max-Win-Motor der 4sc-Kauf-Runde.** →
  `stickyFullBoardMultiplier` steht auf **1 = AUS**. Zum 5000×-Deckel führen nur der
  Full-Board-Instant-Max-Win und der laufende Cap.
- **RTPs 94.1 % (Buy 3sc), 94.65 % (Buy 4sc), 94.9 % (Ante, 2M).** → Alle drei VOID: gemessen vor
  den Tower-Multiplikatoren, die Ante zusätzlich auf einer Rundenzahl, die das Ergebnis nicht
  trägt. Gültig sind 96.35 / 96.08 / 96.00 %.
- **Max-Win-Frequenzen 1-in-8333 (3sc) und 1-in-822 (4sc)**, samt der noch älteren
  1-in-203 / 1-in-334, und die Verteilungstabelle 15.1×/163×/2729× bzw. 107×/427×/745×. → VOID,
  sie beschreiben die Simul-/Full-House-Version.
- **Strip-Längen 56 / 76 / 2240 („ungleiche Längen").** → VOID: Stage 1 hat 1215 Stops auf allen
  5 Reels, Stage 2 hat 2406. Der `reelLengths`-Hinweis selbst bleibt richtig und steht oben.
- **`math/sims/*.py` (`retune_buy_tails.py`, `calibrate_buy4_cap4.py`, …) als „finaler Lauf".** →
  Das ist die 2026-07-22-Generation; die Scripts bleiben als Historie im Paket, zertifiziert wird
  seither mit `math/sim_vice_core.mjs`, das den Live-Rundenkern `src/game/viceSpin.ts` fährt.

Ebenfalls zurückgezogen (stand nie in diesem Dokument, betrifft aber die Zahlen darin): der
„D11"-Fix am Ways-Evaluator. Ein Wild in Spalte 0, das zu HIGH_A faltet, ist die SPEC
(`SlotGame.sol:341`). An `WinEvaluator.ts` und `SlotGame.sol` ändert sich nichts, und jede Zahl,
die aus dem „korrigierten" Evaluator stammt, ist ungültig.
