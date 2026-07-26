# 19 — Sushi Party (Sugar Supreme PowerNudge Klon) — Ground Truth

Referenz: **Sugar Supreme PowerNudge** (Pragmatic Play). Noskis Aufnahme (650s, 30fps, 1256×684:
base game lang + 1 Buy + FS-Runde). Rules-Screenshots (Seiten 1-7) = Mechanik-Spezifikation.
Motion-Energy-Analyse: scratchpad_sushi/vid/motion.py → sushi_motion.json.

## Mechanik (aus Rules, verbindlich)

- **6×6 Grid. Cluster-Blöcke:** ein Symbol zahlt ab **5 gleichen, horizontal/vertikal verbunden**
  (nicht diagonal). Höchster Gewinn je Kombination; mehrere Blöcke addieren. Base-Einsatz × Wert.
- **PowerNudge (Kern, Base ZUFÄLLIG bei jedem Win ausgelöst):**
  1. Gewinn zahlt. 2. Alle Spalten (Reels) MIT ≥1 Gewinnsymbol fallen **1 Stelle nach unten**
  (neues Symbol oben rein). 3. Jede Gewinn-Position **markiert ihre Stelle + legt ×1-Multi an**;
  jeder weitere Win an der Stelle erhöht den Multi **+1**. 4. Wins auf Multi-Stellen: Gewinn-Multi
  = **Summe ALLER beteiligten Positions-Multis**. 5. Re-eval; endet wenn kein Win mehr.
  **Base: Multis weg am Rundenende. FS: Multis bleiben die GANZE Runde + wachsen weiter.**
- **FS:** 3/4/5/6 Scatter (überall) = **10/12/15/20** Spins. Retrigger ≥3 Scatter = **+10**.
  PowerNudge bei jeder Kombi; Multi-Stellen persistent. "Spezielle Walzen" im FS.
- **Buy:** FS-Runde für **100× Gesamteinsatz**, zufällig 3/4/5/6 Scatter.
- **Max Win 5000×** (Runde endet sofort bei Cap). **RTP 96.09%** (Buy 96.08%). Hoch-Vola.
- Min/Max Einsatz $0.20 / $240.

### Paytabelle (Base-Einsatz-Multiplikator; Tiers 5,6,7,8,9,10,11,12,13,14,15+)
high_a: 15+100 / 20 15 7.5 5 3 2.5 2 1.5 1.25 (5er) 1.0  ← das sind $ bei $1? NEIN: Werte sind ×bet? Prüfen.
- Screenshot zeigt $ bei Einsatz $1 → das sind bet-MULTIPLIKATOREN in $ (bei $1 Einsatz = ×Wert).
- high_a (Lachs-Nigiri, war Sahnetorte): 15+ =100, 14=20, 13=15, 12=7.5, 11=5, 10=3, 9=2.5, 8=2, 7=1.5, 6=1.25, 5=1.0
- high_b (Ikura): 15+=75,14=15,13=12,12=6,11=4,10=2.5,9=2,8=1.5,7=1.25,6=1,5=0.75
- high_c (Maki): 15+=50,14=10,13=8,12=4,11=3,10=2,9=1.5,8=1,7=0.75,6=0.6,5=0.5
- high_d (Garnele): 15+=40,14=8,13=6,12=3,11=2.5,10=1.5,9=1,8=0.75,7=0.5,6=0.45,5=0.4
- low_e (rot): 15+=30,14=6,13=4,12=2,11=1.5,10=1,9=0.6,8=0.5,7=0.4,6=0.35,5=0.3
- low_f (lila): 15+=20,14=5,13=3,12=1.5,11=1.25,10=0.75,9=0.6,8=0.5,7=0.3,6=0.25,5=0.2
- low_g (blau): 15+=15,14=4,13=2.5,12=1.25,11=1,10=0.6,9=0.5,8=0.4,7=0.25,6=0.2,5=0.15
- low_h (orange): 15+=10,14=3,13=2,12=1,11=0.75,10=0.5,9=0.4,8=0.3,7=0.2,6=0.15,5=0.1
(Sushi-Zuordnung high a-d / low e-h nach Wert-Rang; Noskis Symbol-Reihenfolge = Rang.)

## Timing / Gefühl (frame-vermessen, Winna-Methode ±33ms)

- **Reel-SPIN (klassisch, KEIN Drop wie Fruit Stacks!):** Dauer ~**3.27s**. **Stop-Stagger
  links→rechts ~0.33s pro Spalte** (col0 +0.00 … col5 +1.6s). Motion-Blur beim Spin, harter
  Dead-Lock-Stop (§1 Skill). Autoplay-Kadenz ~4-5s.
- **Cluster-Win:** nach Stop → Gewinner-Zellen kriegen **weiße Box/Rahmen** + Betrag-Text ($x.xx)
  auf/über dem Cluster. Betrag unten im HUD "GEWINN $x ZAHLT $y".
- **PowerNudge-Beat (42-45s vermessen):** Win-Box (~0.7s) → Gewinn zahlt → Gewinner-Zellen
  **leeren sich** (dunkel) → betroffene Spalten **rutschen 1 Zelle runter** (~0.5s) → an den
  Ex-Gewinner-Stellen erscheint **blaue Zelle mit "×N"** (Marker, x1 initial). Re-eval, Schleife.
- **FS-Multis (540-625s):** ×N-Marker (blau) **verteilt + persistent** übers Board, **wachsen**
  mit Wins (x1→x2→…→x10 gesehen). Win-Tiers als Celebration-Overlays: **NICE!** (klein-mittel),
  **MEGA!** (groß) — pinker Tier-Text auf Radial-BG + Betrag in blauer Pille.
- **Buy→FS-Flow (456-490s):** Base → "FREE SPINS KAUFEN $100" Dialog (X rot / ✓ grün) →
  Klick ✓ → FS-Board mit Scattern ("BONUS AKTIV") → **GRATULATION-Award** "10 FREE SPINS"
  (Pille mit Anzahl, "AN BELIEBIGER STELLE KLICKEN") → FS läuft. Retrigger-Award identisch
  "GRATULATION IHR GEWINN $x MIT 10 FREE SPINS" (640s).
- **Rechte Rail (Sushi = 5 Bambus-Slots):** Noski: "da sammeln sich die FS-Symbole drin".
  Sugar-Supreme-Zylinder rechts; Motion-Peaks nur in der FS-Phase (459-643s). Genaues
  Sammel-Verhalten = beim Bau mit Noski klären (evtl. Scatter-Counter für Retrigger-Fortschritt).

## MATH LOCKED (2026-07-25, zertifiziert via custom-math/sim_sushi.mjs)

**MECHANIK FINAL = NUDGE-PAY-ONCE (Noski 2026-07-25, hart korrigiert — NIE wieder Tumble!):**
Die Gewinnsymbole **verschwinden NICHT** ("die symbole verschwinden ist falsch"). Bei einer
Connection nudgen die verbundenen **Reels zusammen 1 runter** ("die reels wo locked zusammen 1
runter"): ganze Spalte shiftet 1 Zelle runter, unterste fällt raus, EIN frisches Symbol oben rein,
Gewinner bleiben (geshiftet). ×N-Multi bleibt **positions-fix**.
- **Pay-once**: eine Connection zahlt EINMAL (paid-Grid, das mit dem Nudge runter-wandert); ein
  geshifteter identischer Cluster re-zahlt NICHT — nur ein VOLLSTÄNDIG frischer Cluster (aus den
  oben reinkommenden Symbolen) zahlt. (Sonst RTP-Explosion: literal re-pay 2339%, some-fresh 347%.)
- **Zwei falsche Sackgassen (dokumentiert):** (a) Vanish-Tumble (Gewinner raus, collapse) —
  tunbar auf 96% ABER Symbole verschwinden = von Noski verworfen. (b) Walk-down-nudge mit re-pay
  = 785-2339%, untunbar.
- **FS-Multi-Increment = +5** (`fsMultiIncrement`, Base immer +1): der Nudge kaskadiert weniger als
  ein Tumble (nur 1 frisches Symbol/Spalte), also ist der **persistente FS-Multi-Grid der RTP-Hebel**.
  Zellen wachsen ×5/×10/×15/**×20**/×25 → genau die ×20, die Noski via Retrigger sah; Cluster über
  mehrere ×5-Zellen zahlt base × Summe (live gesehen: „7.50 ×25").
- Locked: LB=32 HB=1.4 SCN=1.42 FSCN=0.8 **FSDENSE=6 FSINC=5** MCAP=25. Base ~96-99% (heavy-tail),
  FS-Anteil ~78%, FS 1-in-107, Buy ~101%, Max-Win 5000× erreichbar. `sushiClusterSpin.ts`
  (playSpin: paid-Grid + nudge + multiInc-Param) certifies. Präsentation `ReelSet.playClusterTumble`
  = Nudge (Spalten zusammen 1 runter, kein Vanish).

**Gelernte Hebel (die Tuning-Reise):**
- Uniform-8-Symbole = Cluster-Minimum; SPREAD (Highs seltener) macht Lows dominant → mehr
  Cluster → RTP EXPLODIERT (falsche Richtung). Lows-dominant (LB≫HB) = viele kleine Wins,
  baut Multis (Noski: „bei vielen connections in 10 spins was hitten").
- Scatter als **absolute Count/Strip** (nicht Gewicht) — sonst schluckt die Symboldichte den
  Scatter (0 Scatter, FS nie). RTP an der 3-Scatter-Schwelle = **Klippe** (SCN 1.35→77%,
  1.42→97%, 1.5→99%); feine RTP nur über STRIP-Länge, für Preview ist ~97% Base OK.
- FS-Multi-Stacking ist **super-linear in Spins**: V(3)=77.6× V(4)=111× V(5)=173× V(6)≈260×
  (10/12/15/20 Spins). Deshalb Buy-Uniform-3-6 = 155×/166% (zu reich). **Buy muss Richtung
  3-Scatter gewichtet werden** ({3:.64,4:.29,5:.05,6:.02}) → Buy ≈ 96-98%. Retrigger SEHR
  selten (Noski, FSCN niedrig). Per-Zell-Cap ×25 (Noski sah ×20) bindet kaum, dämpft nur Extremtail.

**Locked config (src/data/math_sushi_party.json):** 6×6, cluster, STRIP=120, HB=1.5 LB=12
(HR1.3 LR1.15), SCN=1.42 (FS 1-in-~109), FSCN=0.8, FSDENSE=5.85 (nur FS-Lows), MCAP=25.
Base-RTP ~96-97% (1M @ SCN1.5 = 99%, SCN1.42 @300k = 97.3%), FS-Anteil ~73%, Buy ~98% (gewichtet),
Max-Win 5000× erreichbar (maxX bis 4897 gemessen), Hoch-Vola (heavy Multi-Tail). PAY-Werte fix
aus Rules (report oben). **Isolation (Noski 2026-07-25): Sushi-Wiring NUR hinter active-game
'sushi'/payModel 'cluster' — Vice/CrackFarm/FruitStacks byte-identisch lassen.**

## Bau-Plan (Sushi Party)
1. Math-Kern `sushiClusterSpin.ts` (pur): 6×6, Cluster-Flood-Fill (h/v, ≥5), PowerNudge-Loop
   (Win→Nudge-Spalten→Multi-Marker kumulativ→re-eval), FS (Multi-Persist), Buy. → beide Registries.
2. Cert-Sim (Node --strip-types): 96.09% Base, 96.08% Buy, Max 5000×, Vola hoch. Stratifiziert.
3. Assets: 512²-Symbole HD-Slice; fs_bend/sushi_burst .mov → webp-Sheets (native fps, Aspekt, <4096).
4. Präsentation: Spin+Stagger, Cluster-Box+Betrag, Nudge-down+×N-Marker, FS-Multi-persist,
   Win-Tiers (NICE/MEGA + eigene big/mega/epic/max/total-Assets), Buy-Dialog, FS-Award, Counter.
5. Verify jeden Bereich live (§5), dann Preset **Sushi Party**, Deploy (vercel prebuilt).
