# 16 — PAYLINES-Systeme CROSS-STUDIO VIDEO GROUND TRUTH

Quelle: pay lines.zip — The Dog House + Big Bass Splash (Pragmatic/Reel Kingdom),
Savage Santa (Colorful Play/Stakelogic), Wild Storm Extras (Stakelogic) + Report 14.
Methode wie Report 15. **Kernbefund: es gibt ZWEI Paylines-Familien.**

## 1. DIE ZWEI FAMILIEN

**Familie BEAM (Colorful Play / Stakelogic — Wild Storm, Savage Santa):**
- ~0,5–0,6s Stille → sequentieller Per-Line-Pass, EIN Durchlauf, danach neutral.
- **Dünner (~3px) Beam edge-to-edge über ALLE Reels** durch Zell-Mitten (gerade/V/Sinus je
  Linie), Sweep <0,2s, **Beam-Leben nur ~0,35s — fadet WÄHREND das Label noch zählt.**
- Nicht-Gewinner dimmen 40–50%, Gewinner recoloren weiß/hell + wiggeln + ~1,2× größer.
- Betrag als **freier Outline-Text OHNE Kasten** auf der Linie (Farbe theme-spezifisch:
  WS cyan-Beam/weißer Text, Santa GOLD-Beam/roter Text — **Beam-Farbe = Theme, Anatomie =
  Studio-Signatur**).
- Multi-Label: orange „xN"-Suffix tickt durch GANZE Zahlen bis zum Tower-Multi (Badge blitzt
  synchron), dann kollabiert das Label und zählt zum PRODUKT hoch. **Fertige Line-Labels
  bleiben stehen und STAPELN mit dem nächsten.**

**Familie NO-LINE (Pragmatic — Dog House, Big Bass):**
- **GAR KEIN Beam/Strich/Frame — nichts** zwischen Zellen, weder Base noch FS.
- Gewinner-Symbole **pulsen in place** (Dark-Flicker ~150ms → Relight 1,1–1,25× + Glitter,
  Charakter-Wiggle/Tail-Wag), EIN simultaner Puls pro Linie (kein Per-Symbol-Cascade).
- **Nicht-Gewinner werden NICHT gedimmt** — Board bleibt voll hell (Dim nur beim Marquee).
- **Betrag NUR in der Bottom-HUD-Leiste**: „LINIE 4 ZAHLT $0,50 × 5 = $2,50" (Basis × Multi =
  Ergebnis) + Symbol-Icon-Reihe als Linien-Identität; NIE Text auf dem Board.
- GEWINN-Meter tickt eased mit (auch Sub-Einsatz-Wins), akkumuliert über die Linien.
- Cadence ~1,3–1,6s/Linie (Dog House); Big Bass presst mehrere Wins als Bottom-Text-Karussell
  mit Pip-Dots statt echtem Per-Line-Loop.

## 2. Was Crack Farm nutzt + bestätigte Korrektheit

Crack Farm = **Familie BEAM** (Noski: „will das wie wild storm"). Unsere Umsetzung ist
bestätigt richtig gegen die Extra-Aufnahmen:
- Edge-to-edge über alle 5 Reels ✓ (Report 14 D1, gebaut).
- 0,45s Stille + sequentieller Single-Pass + neutrale Ruhe ✓ (gebaut).
- xN-Tick-up durch ganze Zahlen → Produkt + Badge-Puls ✓ (D5, gebaut — genau die WS-Anatomie).
- **NEU bestätigt:** Beam-Leben (~0,35s) ist KÜRZER als das Label — unser Comet läuft einmal
  durch, Label bleibt: passt. **Offen bleibt D4 (Label-Stacking): fertige Beträge sollen
  STEHEN bleiben statt zu faden.**

## 3. NEUE, umsetzbare Deltas (über Report 14 hinaus)

| # | Delta | Quelle | Aufwand | Nutzen |
|---|-------|--------|---------|--------|
| P1 | **Label-Stacking (D4)**: fertige Linien-Beträge bleiben sichtbar stehen, während die nächste Linie spielt (2 Beträge gleichzeitig) | WS+Santa | mittel | mittel |
| P2 | **Beam kürzer als Label**: Beam ~0,35s faden lassen, Label/Betrag länger halten (aktuell koppeln wir beide an den Step) | WS-Extra | klein | Feinschliff |
| P3 | **Winner-Wiggle** (leichtes Rock/Rotation ~±3° zusätzlich zum Enlarge) — beide Beam-Studios machen das | WS+Santa | klein | mittel |
| P4 | **Bottom-HUD-Formel** „LINIE n ZAHLT base × mult = total" als zweite Lesart (Pragmatic-Stärke: Zahl-Klarheit) — optional als HUD-Zeile | Pragmatic | mittel | optional |
| P5 | **Deferred-Badge-Reveal am Stop**: Multi-Badge poppt ~0,3s NACH dem Reel-Lock während andere Reels noch drehen (Micro-Suspense) | Dog House | klein | mittel (FS) |
| P6 | **Beam-Farbe theme-fitten**: Crack Farm sollte einen GRÜNEN/Slime-Beam nutzen (WS cyan, Santa gold = per-Theme-Regel), nicht den geerbten Default | Santa | klein | mittel |

## 4. Marquee-Deltas (Tier-Systeme quer)

- **Wild Storm/Colorful Play:** wortloser Licht-Burst 0,5s → Tier-Wort → Ease-Tally ~2,2s
  exakt → Auto-Exit ~3,5s. NICE-Schwelle **~15×** (12× kein Marquee, 19× ja); Tiers grün→…
- **Pragmatic (Dog House/Big Bass):** Tier-Wort SOFORT final (kein BIG→MEGA-Ladder), Plaque
  landet ZUERST, DANN dimmt der Hintergrund (kein wortloser Pause-Burst); Tally-Dauer
  **skaliert mit Win-Größe** (linear ~2× Einsatz/s, $105 = ~29s!), **kein** fixes 2,2s/
  Auto-Exit — Exit per Shrink/Fade. Coins: NICE sparse, SUPERB voller Regen.
- Lehre: unser Marquee folgt der WS-Kurve (fix, auto-exit) — das ist die schnellere, modernere
  Variante; Pragmatics längenskalierende Tally ist eine Alternative für „schwere" Big-Win-Momente.

## 5. Feature-Choreografien (Referenz für spätere Crack-Farm-Features)

- **Big Bass Fisherman-Collect:** Wild landet → 0,8s Pause → jede Geldfisch-Wert-RIBBON fliegt
  EINZELN (nearest-first, ~0,5s Abstand) zum Wild, dessen Fuß-Ribbon summiert live, Fisher
  macht Pose je Ankunft → Schluss-Sparkle nach oben ins Sammel-Canoe. **Exakt das Muster für
  unser mögliches „Slime Harvest"-3sc-Feature** (Kanister-Werte → fliegendes Schwein).
- **Dog House FS-Wheel:** Barrel-Minigame zählt die Spins aus (3→7→9→13) vor dem Round-Start.
- **Savage Santa Expanding Sticky + Shotgun-Multi:** 1×1-Kopf → 1s Hold → Full-Reel-Tower
  (~0,7s), sticky; danach zielt Santa mit Schrotflinte auf ein anderes Wild → Crosshair-Lock →
  Multi collected. (Choreo-Idee für Tower-Multi-Übertragung.)
- **Dog House Sticky-Wild-Stacking:** zwei gestapelte Stickies verschiedener Werte auf einem
  Reel (3× über 2×), Multis addieren pro Linie. (Deckt sich mit unserer Tower-Cap-2-Regel.)

## 6. Schärfe/Art quer (bestätigt Report 11/14)

Beide Pragmatic-Titel: fette Outlines, Symbol füllt 90–95%, eigene farbige Plate-Frames pro
Charakter, flacher Low-Detail-Reel-Hintergrund (damit Blur sauber liest), Partikel NUR bei
Wins. Theme-Wechsel Base→FS über PALETTE + Beleuchtung (Tag→Nacht), nicht über UI. Genau
unser Ansatz — Crack Farm ist auf Kurs.

## 7. Empfehlung Reihenfolge (nach Noski-Freigabe)

P6 (grüner Beam, trivial) → P3 (Wiggle) → P1/D4 (Label-Stacking) → P2 → P5 (FS). P4 nur wenn
Noski die Pragmatic-Zahlklarheit will. Alles Familie-BEAM-konform = bleibt „wie Wild Storm".
