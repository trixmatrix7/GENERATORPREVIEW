# 18 — Fruit Stacks Ground Truth: Winna Trillion (6×5 Scatter-Pays Tumbler)

**Quelle:** Noskis Gameplay-Aufnahme `Bildschirmaufnahme 2026-07-21 053505.mp4` (1270×806, 30fps,
~4:35) + 8 Rules-Screenshots. Methode: 1fps-Sweep (275 Frames, Montagen A/B) + 20fps-Burst auf
Win-Pop→Cascade (12,6–15,6s). **Referenz nur fürs CONSTRUCT — Design machen wir selbst.**

## 1. Grid & Layout (vermessen, Frame @7s)

- **Grid: 6 Spalten × 5 Reihen** (Noski-Zählung „links nach unten 5, oben links nach rechts 6").
- Gold-Rahmen-Box: x 325→1000, y 62→622 im 1270×806-Screen → **675×560 px** → Zelle ≈ **112×112,
  QUADRATISCH** (unsere 120×110 sind nah dran; für 6×5 eigener Preset).
- Symbole **frei schwebend, KEINE Tiles/Kacheln** — glossy Objekte direkt auf dunklem Board.
- Layout-Skelett (Noski will Dimensionen/Positionen SO): **Logo oben links**, darunter **BUY
  BONUS** + **CHANCE ×2-Toggle** (linke Rail), Grid center-rechts, **Win-Plaque als Pill oben
  MITTIG AUF dem Rahmen** (läuft live hoch: „360.00×500"), HUD unten (Balance | Total bet ▲▼ |
  Total win | Autoplay A | Spin). Rechte Rail: vertikaler Game-Name.
- Linke Rail zeigt während der Kaskade einen **Collect-Tally pro Symbol**: „8 🍋 1.00" (Anzahl +
  gezahlter Betrag je Symbolart, stapelt sich über die Kaskadenkette).

## 2. Pay-Modell: SCATTER-PAYS (pay anywhere by count)

- Symbol zahlt ab **8+ gleichen IRGENDWO** auf dem Board. Tiers: **8-9 / 10-11 / 12+**.
- Paytable (bet 2.00 FUN): Gem 20/50/100 · Blauer Stern 5/20/50 · Goldstern 4/10/30 · Herz
  3/4/24 · Melone 2/3/20 · Pflaume 1.6/2.4/16 · Zitrone 1/2/10 · Orange 0.8/1.8/8 · Kirsche
  0.5/1.5/4 → als **bet-Multiplikatoren**: top 10/25/50×, floor 0.25/0.75/2×.
- 9 zahlende Symbole + Scatter (W) + Multiplier-Symbol (Geschenkbox). **KEIN Wild.**
- Scatter zahlt SELBST: 4/5/6 Scatter = 3/5/100× bet.

## 3. TUMBLE-Kaskade (20fps-Burst vermessen)

Ablauf pro Win-Step (~2,0s gesamt):
1. **Ring-Highlight** auf allen Gewinner-Symbolen (~150ms, goldene Ringe).
2. **Pop-Burst:** Gewinner platzen in Gold-Stern-Partikel (~300ms), Betrag „+1.00" als freier
   Bold-Text am Cluster-Schwerpunkt; Win-Plaque oben tickt hoch.
3. **Gravity-Fall:** verbleibende Symbole fallen in die Lücken (~250ms, kein Bounce erkennbar),
   **neue Symbole droppen von OBEN nach** (gestaffelt, ~300ms).
4. **Re-Evaluation** → weiterer Step oder Ruhe. Eine „Spin" = Kette von Steps.
- Referenz-Partikelspray ist BUSY — Noski will es cleaner: **„Knick" beim Landen (leichte
  Squash-Biegung, KEINE Billig-Effekte), Auseinander-Ploppen beim Win.**

## 4. Multiplier-Symbol + Pool

- Geschenkbox-Symbol mit ×2…×500 (3 Bow-Farben: blau ×2-×5, rot ×6-×30, gold ×31-×500).
- Alle Multis eines Spins **SUMMIEREN** und multiplizieren den Spin-Total.
- **FS Multiplier-POOL:** Multis wandern in einen persistenten Pool (Badge rechte Rail, gesehen
  ×100→×102→×103→×104→×118…), Pool resettet NICHT zwischen FS-Spins, Cap ×500. Pool wird nur
  angewendet, wenn im Spin ein NEUES Multi-Symbol droppt (Regel-Screenshot „Multiplier Pool").
  Anwendung: (neue Multis + Pool) × Spin-Win. Fly-to-Badge-Animation Box→Pool.

## 5. Free Spins & Buys

- **4+ Scatter → 15 Free Spins**; Retrigger: 3+ Scatter in einem FS-Spin = **+5** (unbegrenzt).
- FS-Intro-Wahl: 3 Karten (Blau/Rot/Gold-Schleife) = FS ohne Start-Multi / Initial ×50 /
  Initial ×100 — dieselbe Grafik dient als **Buy-Page**: 100× / 300× / 500× bet (200/600/1000
  FUN bei bet 2). Bestätigungs-Flow wie unsere BonusBuy-Page.
- **CHANCE ×2 Ante-Toggle:** +0.50 auf 2.00 bet (= +25%) für doppelte FS-Chance.
- Marquee-Familie: BIG WIN → SUPER MEGA WIN → TOTAL WIN Count-up-Plaque am FS-Ende (374.30).

## 6. Was wir ÜBERNEHMEN vs BESSER machen (Noski-Ansage)

- ÜBERNEHMEN: Construct (Grid-Dimensionen, Layout-Positionen, Pay-Modell, Tumble-Loop,
  Pool-Regeln, Buy-Struktur, Plaque-Position).
- SELBST/BESSER: komplettes Design (BG, Rahmen, Logo, Symbole — Früchte-Theme via Higgsfield,
  s. `design/fruit-stacks/`), Landing = subtiler Squash-Knick statt nichts, Win-Pop cleaner
  als der Partikel-Spam der Referenz (saftiger Juice-Burst statt Konfetti-Spray), Audio nach
  unseren Regeln (§4 Skill — nur Noski-Sounds).
