import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { uiSfx } from '@/audio/uiSfx';
import { FRUIT_BUY_STAGES } from '@/game/fruitStacksMath';
import { SUSHI_BUY_STAGES } from '@/game/sushiMath';

/**
 * Bonus-buy / bet-multiplier page (Crack Farm) — Noski's OFFICIAL PNGs, 1:1.
 * A round trigger (ours; placeholder round shape, swap the knob image later)
 * opens the page. The card / bet-box / dialog art are the exact PNGs; the real
 * feature title + dynamic price are overlaid (the baked template text is a
 * near-invisible placeholder). Order (Noski): 3× scatter boost · plant feature
 * · buy 3-scatter · buy 4-scatter · buy 5-scatter.
 */

const BB = `${import.meta.env.BASE_URL}theme/crackfarm/bonusbuy/`;

type Card = { id: string; title: string; mult: number; kind: 'activate' | 'buy' };
const CARDS: Card[] = [
  { id: 'boost3x', title: '3× SCATTER\nBOOST',   mult: 3,   kind: 'activate' },
  { id: 'plant',   title: 'PLANT\nFEATURE',       mult: 50,  kind: 'activate' },
  { id: 'buy3',    title: 'BUY\n3 SCATTER',        mult: 100, kind: 'buy' },
  { id: 'buy4',    title: 'BUY\n4 SCATTER',        mult: 200, kind: 'buy' },
  { id: 'buy5',    title: 'BUY\n5 SCATTER',        mult: 400, kind: 'buy' },
];

const money = (n: number) => `$${n.toFixed(2)}`;
// Vice Heat prices in EUR (Noski: "3€ pro spin auf 1€") — scoped to the Vice
// buy rail; Fruit/Sushi stay on money() ($).
const moneyEur = (n: number) => `€${n.toFixed(2)}`;
const CW = 150;                 // card display width (PNG is 360×598)
const CH = Math.round(CW * 598 / 360);
// One place to change all bonus-buy text styling (Noski wants the fonts easy to
// swap). Change this string (or per-slot below) to restyle the cards / bet.
const FONT = "'Rubik', ui-sans-serif, system-ui, sans-serif";

// ── FRUIT STACKS: purchased FS stages (sim-calibrated costs; stage 2/3
// pre-load the pool at ×50/×100). Karten-Inhalte sind seit dem Buy-Page-Pack
// (2026-07-24) komplett GEBAKED — der Preis steht im Bestätigungs-Dialog. ──

export function FruitBuyRail({ betDisplay, onBuy, bonusActive = false }: { betDisplay: string; onBuy?: (stage: number) => void; bonusActive?: boolean }) {
  const [open, setOpen] = useState(false);
  // Bestätigung NACH Karten-Klick — wieder drin (Noski lieferte das Theme-Art:
  // Holzrahmen-Dialog mit gebakten ✗/✓-Kugeln; Hotspots sitzen AUF den Kugeln).
  const [confirm, setConfirm] = useState<number | null>(null);
  // Rail-left alignment: PixiApp broadcasts the logo's left edge (percent of
  // canvas width) so the buy button moves WITH the logo (Noski: same margin
  // left as the grid has right). Value is now the logo CENTRE % (rail centres on
  // it via translateX(-50%)); ~12 is a sensible pre-broadcast default.
  const [railLeftPct, setRailLeftPct] = useState(12);
  useEffect(() => {
    // Read the sticky value first (PixiApp broadcast may have fired before mount).
    const sticky = (window as unknown as { __slotLeftRail?: number }).__slotLeftRail;
    if (typeof sticky === 'number') setRailLeftPct(sticky);
    const on = (e: Event) => setRailLeftPct(Number((e as CustomEvent).detail) || 12);
    window.addEventListener('slot:leftrail', on);
    return () => window.removeEventListener('slot:leftrail', on);
  }, []);
  // Während einer Win-Marquee blenden sich die DOM-Rails aus — DOM läge
  // sonst immer ÜBER dem Canvas-Marquee (Noski: "muss dahinter sein").
  const [marqueeOn, setMarqueeOn] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setMarqueeOn(Boolean((e as CustomEvent).detail));
    window.addEventListener('slot:marquee', on);
    return () => window.removeEventListener('slot:marquee', on);
  }, []);
  const bet = Math.max(0.01, Number(betDisplay || '0'));
  return (
    <>
      {/* LEFT-RAIL: during a FS round the pill is replaced by BONUS ACTIVE */}
      {bonusActive ? (
        <img
          src={`${import.meta.env.BASE_URL}theme/fruitstacks/bonus_active2.webp`}
          alt="Bonus active"
          style={{ position: 'absolute', left: `${railLeftPct}%`, transform: 'translateX(-50%)', top: '45%', zIndex: 40, width: '16%', minWidth: 130, pointerEvents: 'none', opacity: marqueeOn ? 0 : 1, transition: 'opacity 0.25s ease' }}
        />
      ) : (
      <button onClick={() => { uiSfx.open(); setOpen(true); }} title="Buy bonus" style={{
        position: 'absolute', left: `${railLeftPct}%`, transform: 'translateX(-50%)', top: '46%', zIndex: 40, width: '15%', minWidth: 124,
        padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
        opacity: marqueeOn ? 0 : 1, pointerEvents: marqueeOn ? 'none' : 'auto', transition: 'opacity 0.25s ease',
      }}>
        {/* Noski's button art (Holz-Plakette "BUY FREE SPINS", 2026-07-23) —
            deliberately NO price on it */}
        <img src={`${import.meta.env.BASE_URL}theme/fruitstacks/bonusbuy_btn2.webp`} alt="Buy bonus" style={{ width: '100%', display: 'block' }} />
      </button>
      )}

      {!open ? null : (
        <div onClick={() => setOpen(false)} style={{
          position: 'absolute', inset: 0, zIndex: 60, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(6,3,14,0.72)', fontFamily: FONT,
          animation: 'buyBackdropIn 0.22s ease-out both',
        }}>
          {/* NOSKIS BUY-PAGE (2026-07-24): eigener Screen — Bokeh-Bg, Logo,
              3 Holz-Karten (Inhalte GEBAKED: 15 FREE SPINS / INITIAL
              MULTIPLIER ×0/×50/×100 + BUY-Button), PRESS TO CONTINUE unten.
              Karten-Positionen aus dem Komposit vermessen (Interieur-Zentren
              555 / 965 / 1365 auf 1920). Karte antippen → Bestätigungs-
              Dialog (Preis), PRESS TO CONTINUE / außerhalb → schließen. */}
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', aspectRatio: '1920 / 1080', height: '100%', maxWidth: '100%', overflow: 'hidden', borderRadius: 12, containerType: 'size', animation: 'buyPageIn 0.34s cubic-bezier(0.22, 1.28, 0.42, 1) both' }}>
            <img
              src={`${import.meta.env.BASE_URL}theme/fruitstacks/intro/game/bg_intro2.webp`}
              alt="" draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <img
              src={`${import.meta.env.BASE_URL}theme/fruitstacks/buypage/logo.webp`}
              alt="Buy Free Spins" draggable={false}
              style={{ position: 'absolute', left: '50%', top: '18.1%', transform: 'translate(-50%, -50%)', width: '16.5%' }}
            />
            {FRUIT_BUY_STAGES.map((st, i) => (
              <button
                key={st.stage}
                onClick={() => { uiSfx.click(); setConfirm(st.stage); }}
                title={money(bet * st.costMult)}
                style={{
                  position: 'absolute', left: `${[28.9, 50.3, 71.1][i]}%`, top: '56.7%',
                  transform: 'translate(-50%, -50%)', width: '22%',
                  padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
                }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}theme/fruitstacks/buypage/card${st.stage}.webp`}
                  alt={st.label} draggable={false} style={{ width: '100%', display: 'block' }}
                />
                {/* PREIS (Noskis rote Markierung: unter dem ×N) — dieselbe
                    Zahl-Schrift wie das Win-Marquee (Baloo 2, aufrecht) */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: '84.7%', textAlign: 'center',
                  fontFamily: "'Baloo 2', 'Rubik', ui-sans-serif, sans-serif", fontWeight: 800,
                  fontSize: '4.2cqh', color: '#ffe9a0', lineHeight: 1,
                  textShadow: '0 0 4px #1a0e02, 2px 2px 0 #1a0e02, -2px 2px 0 #1a0e02, 2px -2px 0 #1a0e02, -2px -2px 0 #1a0e02, 0 4px 8px rgba(0,0,0,0.55)',
                  pointerEvents: 'none',
                }}>{money(bet * st.costMult)}</div>
              </button>
            ))}
            {/* X oben rechts zum Verlassen (Noski) — Gold-Ring im Theme-Look;
                PRESS TO CONTINUE unten wieder raus ("macht kein sinn"). */}
            <button
              aria-label="Schließen"
              onClick={() => { uiSfx.click(); setOpen(false); }}
              style={{
                position: 'absolute', right: '2.2%', top: '4%', width: '6.4cqh', height: '6.4cqh',
                borderRadius: '50%', border: '0.45cqh solid #f2ab31', cursor: 'pointer',
                background: 'radial-gradient(circle at 35% 30%, #7a4a22 0%, #4a2a12 70%)',
                color: '#ffe9a0', fontWeight: 900, fontSize: '3.4cqh', lineHeight: 1,
                fontFamily: "'Baloo 2', 'Rubik', ui-sans-serif, sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(0,0,0,0.55), inset 0 2px 3px rgba(255,255,255,0.25)',
              }}
            >✕</button>
          {confirm && (
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(3,6,12,0.66)', zIndex: 5 }}>
              {/* Noskis Dialog-Art: Holzrahmen + Tafel + gebakte ✗/✓-Kugeln.
                  Art-Aspekt 1558×1015; Hotspots exakt auf den Kugeln vermessen:
                  ✗ Zentrum (37.3%, 82.9%), ✓ Zentrum (62.7%, 82.7%), r≈11% W. */}
              <div style={{ position: 'relative', width: 'min(520px, 88%)', aspectRatio: '1558 / 1015', fontFamily: FONT }}>
                <img
                  src={`${import.meta.env.BASE_URL}theme/fruitstacks/buy_confirm_frame.webp`}
                  alt="" draggable={false}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                />
                {/* Tafel-Pille: NUR der Kaufpreis (Noski) */}
                <div style={{ position: 'absolute', left: '18%', right: '18%', top: '38%', height: '26%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ color: '#fff', fontWeight: 900, fontSize: 32, textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
                    {money(bet * FRUIT_BUY_STAGES[confirm - 1].costMult)}
                  </div>
                </div>
                {/* unsichtbare Hotspots AUF den gebakten Kugeln */}
                <button
                  aria-label="Abbrechen"
                  onClick={() => { uiSfx.click(); setConfirm(null); }}
                  style={{ position: 'absolute', left: '25.3%', top: '65%', width: '24%', height: '34%', background: 'transparent', border: 'none', cursor: 'pointer' }}
                />
                <button
                  aria-label="Kaufen"
                  onClick={() => { uiSfx.click(); onBuy?.(confirm); setConfirm(null); setOpen(false); }}
                  style={{ position: 'absolute', left: '50.7%', top: '65%', width: '24%', height: '34%', background: 'transparent', border: 'none', cursor: 'pointer' }}
                />
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </>
  );
}

// ── SUSHI PARTY: single purchased FS stage (×100 bet → FREE SPINS). Modeled
// 1:1 on FruitBuyRail (same left-rail button / bonus-active pill / buy-page /
// confirm dialog), but the buy page shows ONE centered card (only one stage in
// SUSHI_BUY_STAGES) and all art points at theme/sushiparty/ instead of
// theme/fruitstacks/. Signature/props identical to FruitBuyRail. ──

export function SushiBuyRail({ betDisplay, onBuy, bonusActive = false }: { betDisplay: string; onBuy?: (stage: number) => void; bonusActive?: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  // Rail-left alignment: PixiApp broadcasts the logo's left edge (percent of
  // canvas width) so the buy button moves WITH the logo (same as FruitBuyRail).
  const [railLeftPct, setRailLeftPct] = useState(4.2);
  useEffect(() => {
    const on = (e: Event) => setRailLeftPct(Number((e as CustomEvent).detail) || 4.2);
    window.addEventListener('slot:leftrail', on);
    return () => window.removeEventListener('slot:leftrail', on);
  }, []);
  // Während einer Win-Marquee blenden sich die DOM-Rails aus (DOM läge sonst
  // über dem Canvas-Marquee).
  const [marqueeOn, setMarqueeOn] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setMarqueeOn(Boolean((e as CustomEvent).detail));
    window.addEventListener('slot:marquee', on);
    return () => window.removeEventListener('slot:marquee', on);
  }, []);
  const bet = Math.max(0.01, Number(betDisplay || '0'));
  const st = SUSHI_BUY_STAGES[0];
  const price = money(bet * st.costMult);
  // ── SELF-CONTAINED styled buy UI (no baked art — sushiparty ships no buypage
  //    pack; a wood/gold/red panel in the theme palette instead of broken imgs). ──
  const wood = 'linear-gradient(180deg,#8a5528 0%,#5a3316 46%,#3a2010 100%)';
  const woodInset = '0 2px 0 rgba(255,225,160,0.25) inset, 0 -3px 8px rgba(0,0,0,0.5) inset';
  const gold = '#ffe6a8';
  const goldStroke = '0 0 4px #180c02, 2px 2px 0 #180c02, -2px 2px 0 #180c02, 2px -2px 0 #180c02, -2px -2px 0 #180c02';
  return (
    <>
      {/* LEFT-RAIL: during a FS round the pill is replaced by BONUS ACTIVE */}
      {bonusActive ? (
        <div style={{
          position: 'absolute', left: `${railLeftPct}%`, top: '45%', zIndex: 40, width: '15%', minWidth: 126,
          padding: '10px 6px', textAlign: 'center', borderRadius: 14, background: wood,
          border: '2px solid #f2ab31', boxShadow: `${woodInset}, 0 5px 14px rgba(0,0,0,0.5)`,
          fontFamily: "'Baloo 2','Rubik',ui-sans-serif,sans-serif", fontWeight: 900, letterSpacing: 0.4,
          color: gold, fontSize: 15, lineHeight: 1.05, textShadow: goldStroke,
          pointerEvents: 'none', opacity: marqueeOn ? 0 : 1, transition: 'opacity 0.25s ease',
        }}>BONUS<br />ACTIVE</div>
      ) : (
      <button onClick={() => { uiSfx.open(); setOpen(true); }} title="Buy Free Spins" style={{
        position: 'absolute', left: `${railLeftPct}%`, top: '46%', zIndex: 40, width: '15%', minWidth: 126,
        padding: '11px 6px', borderRadius: 14, background: wood, border: '2px solid #f2ab31',
        cursor: 'pointer', boxShadow: `${woodInset}, 0 5px 14px rgba(0,0,0,0.5)`,
        fontFamily: "'Baloo 2','Rubik',ui-sans-serif,sans-serif", fontWeight: 900, color: gold,
        fontSize: 15, lineHeight: 1.05, letterSpacing: 0.4, textShadow: goldStroke,
        opacity: marqueeOn ? 0 : 1, pointerEvents: marqueeOn ? 'none' : 'auto', transition: 'opacity 0.25s ease',
      }}>🍣 BUY<br />FREE SPINS</button>
      )}

      {!open ? null : (
        <div onClick={() => { setConfirm(null); setOpen(false); }} style={{
          position: 'absolute', inset: 0, zIndex: 60, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(6,3,14,0.72)', fontFamily: FONT,
          animation: 'buyBackdropIn 0.22s ease-out both',
        }}>
          {/* Styled buy card (single stage). Tap BUY → price confirm → purchase. */}
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', width: 'min(360px, 82%)', padding: '26px 24px 22px',
            borderRadius: 22, background: wood, border: '3px solid #f2ab31',
            boxShadow: '0 18px 50px rgba(0,0,0,0.6), 0 0 0 6px rgba(0,0,0,0.25)',
            textAlign: 'center', animation: 'buyPageIn 0.34s cubic-bezier(0.22,1.28,0.42,1) both',
            containerType: 'inline-size',
          }}>
            {/* X close */}
            <button aria-label="Schließen" onClick={() => { uiSfx.click(); setOpen(false); }} style={{
              position: 'absolute', right: 12, top: 12, width: 34, height: 34, borderRadius: '50%',
              border: '2px solid #f2ab31', cursor: 'pointer', color: gold, fontWeight: 900, fontSize: 17,
              background: 'radial-gradient(circle at 35% 30%, #7a4a22 0%, #4a2a12 70%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
            <div style={{ fontFamily: "'Baloo 2','Rubik',ui-sans-serif,sans-serif", fontWeight: 900, fontSize: 24, color: gold, textShadow: goldStroke, letterSpacing: 0.5 }}>BUY FREE SPINS</div>
            <div style={{ fontSize: 52, margin: '10px 0 2px' }}>🍣</div>
            <div style={{ fontFamily: "'Baloo 2','Rubik',ui-sans-serif,sans-serif", fontWeight: 800, fontSize: 17, color: '#ffd0c2', textShadow: goldStroke }}>
              GUARANTEED FREE SPINS
            </div>
            <div style={{ fontSize: 12.5, color: '#e8c79a', margin: '4px 0 16px', lineHeight: 1.35 }}>
              3–6 scatters → 10–20 spins.<br />Multipliers persist &amp; grow all round.
            </div>
            {confirm === null ? (
              <button onClick={() => { uiSfx.click(); setConfirm(st.stage); }} style={{
                width: '100%', padding: '13px 0', borderRadius: 14, cursor: 'pointer', border: '2px solid #ffd75e',
                background: 'linear-gradient(180deg,#e0442c,#a41d12)', color: '#fff', fontWeight: 900,
                fontFamily: "'Baloo 2','Rubik',ui-sans-serif,sans-serif", fontSize: 19, letterSpacing: 0.5,
                textShadow: '0 2px 4px rgba(0,0,0,0.55)', boxShadow: '0 4px 0 #6e1109, 0 8px 16px rgba(0,0,0,0.45)',
              }}>BUY&nbsp;&nbsp;{price}</button>
            ) : (
              <div>
                <div style={{ color: gold, fontWeight: 900, fontSize: 15, marginBottom: 12, textShadow: goldStroke }}>
                  Confirm purchase for {price}?
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button aria-label="Abbrechen" onClick={() => { uiSfx.click(); setConfirm(null); }} style={{
                    flex: 1, padding: '11px 0', borderRadius: 12, cursor: 'pointer', border: '2px solid #8a6a3a',
                    background: 'linear-gradient(180deg,#6a4224,#3c2412)', color: '#f0d8b0', fontWeight: 800, fontSize: 15,
                    fontFamily: "'Baloo 2','Rubik',ui-sans-serif,sans-serif",
                  }}>✕ CANCEL</button>
                  <button aria-label="Kaufen" onClick={() => { uiSfx.click(); onBuy?.(st.stage); setConfirm(null); setOpen(false); }} style={{
                    flex: 1.4, padding: '11px 0', borderRadius: 12, cursor: 'pointer', border: '2px solid #ffd75e',
                    background: 'linear-gradient(180deg,#3fae4a,#1c7a2a)', color: '#fff', fontWeight: 900, fontSize: 15,
                    fontFamily: "'Baloo 2','Rubik',ui-sans-serif,sans-serif", textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    boxShadow: '0 4px 0 #114d19, 0 8px 14px rgba(0,0,0,0.4)',
                  }}>✓ BUY {price}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── VICE HEAT: staged buys (3sc/4sc) + 3x-FS-chance ante — Noski's REAL baked
// art (image + invisible-hotspot pattern, mirrors FruitBuyRail/SushiBuyRail).
// The round trigger (btn.png), the full 3-card buy page (page_on/off.png — ON/
// OFF composite driven by the ante toggle) and the confirm dialogs (approve_3/
// _4.png) are all baked PNGs; transparent hotspots sit over the baked cards and
// BACK/OK pills. Prices/labels (100X/200X BET, x3.25) are baked into the art, so
// no text is overlaid. Trigger sits bottom-left with air to the reel frame.
const VBB = `${import.meta.env.BASE_URL}theme/vice/bonusbuy/`;
// Vice Heat display font for the overlaid € prices (the baked card art carries
// only the ×N multiplier — 100X/200X BET — not the money amount Noski wants).
const V_FONT = "'Rubik', ui-sans-serif, system-ui, sans-serif";

// The ante ("3× FREE SPINS CHANCE") raises the per-spin cost to bet × 3.25 and
// is a DELIBERATE opt-in — it MUST start OFF every session (Noski: "bei
// Aktivierung muss Standard OFF sein"), never revive a stale localStorage '1'
// across a reload. Reset once per page load (module flag), then let an
// in-session toggle survive component remounts.
let viceAnteResetThisLoad = false;
function broadcastAnte(on: boolean, costMult: number): void {
  // Sticky global (a late-mounting ControlBar reads it) + live event, so the
  // bottom control bar shows the raised per-spin cost while the ante is ON.
  (window as unknown as { __viceAnte?: { on: boolean; costMult: number } }).__viceAnte = { on, costMult };
  window.dispatchEvent(new CustomEvent('slot:ante', { detail: { on, costMult } }));
}

export interface ViceBuyStageDef { stage: number; scatters: number; costMult: number }

/**
 * A € price centred inside a Vice buy-card's grey pill. The pill is only ~8.8%
 * of the art width, so a long value ("€3.25", big-bet "€1000.00") would spill
 * out the sides. FitPrice fixes the box to the pill width (8.4%, a hair inside)
 * and scales the text down to fit — so it never sticks out left/right, at any
 * bet amount or currency length. Anchors to the ART-BOX (top 56% = pill centre).
 */
function FitPrice({ leftPct, textStyle, value }: { leftPct: number; textStyle: CSSProperties; value: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const box = boxRef.current, span = spanRef.current;
    if (!box || !span) return;
    const fit = () => {
      const avail = box.clientWidth;
      const natural = span.scrollWidth;
      if (natural > 0) setScale(Math.min(1, avail / natural));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [value]);
  return (
    <div ref={boxRef} style={{
      position: 'absolute', left: `${leftPct}%`, top: '55.5%', width: '8.4%',
      transform: 'translate(-50%, -50%)', display: 'flex', justifyContent: 'center',
      alignItems: 'center', pointerEvents: 'none',
    }}>
      <span ref={spanRef} style={{ ...textStyle, display: 'inline-block', transform: `scale(${scale})`, transformOrigin: 'center' }}>{value}</span>
    </div>
  );
}

export function ViceBuyRail({ betDisplay, stages, anteCostMult, onBuy }: {
  betDisplay: string;
  stages: ViceBuyStageDef[];
  anteCostMult?: number;
  onBuy?: (stage: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<ViceBuyStageDef | null>(null);
  // Rail-left alignment: PixiApp broadcasts the left-rail logo's centre (percent of
  // canvas width) so the round buy button docks UNDER the logo (same as Fruit/Sushi).
  const [railLeftPct, setRailLeftPct] = useState(8);
  useEffect(() => {
    const sticky = (window as unknown as { __slotLeftRail?: number }).__slotLeftRail;
    if (typeof sticky === 'number') setRailLeftPct(sticky);
    const on = (e: Event) => setRailLeftPct(Number((e as CustomEvent).detail) || 8);
    window.addEventListener('slot:leftrail', on);
    return () => window.removeEventListener('slot:leftrail', on);
  }, []);
  const [ante, setAnte] = useState(() => {
    if (!viceAnteResetThisLoad) {
      viceAnteResetThisLoad = true;
      try { localStorage.setItem('vice:ante', '0'); } catch { /* ignore */ }
      return false;
    }
    return localStorage.getItem('vice:ante') === '1';
  });
  // Broadcast on mount + whenever the ante (or its cost) changes, so the control
  // bar + sticky global always reflect the real per-spin cost.
  useEffect(() => { broadcastAnte(ante, anteCostMult ?? 0); }, [ante, anteCostMult]);
  const toggleAnte = () => {
    const next = !ante;
    setAnte(next);
    try { localStorage.setItem('vice:ante', next ? '1' : '0'); } catch { /* ignore */ }
    uiSfx.click();
  };
  // 3-scatter → middle card, 4-scatter → right card (fall back by index).
  const buy3 = stages.find(s => s.scatters === 3) ?? stages[0];
  const buy4 = stages.find(s => s.scatters === 4) ?? stages[1] ?? stages[0];
  const bet = Math.max(0.01, Number(betDisplay || '0'));
  // Text style for the € prices — FitPrice positions + scales them so they never
  // spill past the narrow grey pill (measured 8.8% of art width). Font is a base
  // only; FitPrice shrinks it to the pill on any bet amount / currency length.
  const priceTextStyle: CSSProperties = {
    fontFamily: V_FONT, fontWeight: 900, fontStyle: 'italic', fontSize: '2.7cqh',
    color: '#ffffff', letterSpacing: 0.3, whiteSpace: 'nowrap', lineHeight: 1,
    textShadow: '0 0 4px #1a0016, 2px 2px 0 #1a0016, -2px 2px 0 #1a0016, 2px -2px 0 #1a0016, -2px -2px 0 #1a0016, 0 4px 10px rgba(0,0,0,0.6)',
  };
  return (
    <>
      {/* round trigger (btn.png) — docked UNDER the left-rail logo (Noski) */}
      <button onClick={() => { uiSfx.open(); setOpen(true); }} title="Bonus buy" style={{
        position: 'absolute', left: `${railLeftPct}%`, transform: 'translateX(-50%)', top: '47%', zIndex: 40, width: 66, height: 66,
        padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
        filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.55))',
      }}>
        <img src={`${VBB}btn.png`} alt="Bonus buy" draggable={false} style={{ width: '100%', height: '100%', display: 'block' }} />
        {/* active ante badge (the page ON state is the primary signal) */}
        {ante ? <span style={{ position: 'absolute', bottom: -6, right: -8, background: '#ffd75e', color: '#3a0f24', borderRadius: 8, fontSize: 8.5, fontWeight: 900, padding: '1px 5px' }}>3xFS</span> : null}
      </button>

      {!open ? null : (
        <div onClick={() => { setConfirm(null); setOpen(false); }} style={{
          position: 'absolute', inset: 0, zIndex: 60, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,4,18,0.85)', backdropFilter: 'blur(3px)',
          animation: 'buyBackdropIn 0.22s ease-out both',
        }}>
          {/* BUY PAGE composite: page_on.png when ante, page_off.png otherwise.
              Three invisible hotspots measured from page_on.png alpha columns:
              LEFT card x 20.7-38.6%, MIDDLE 41.0-59.0%, RIGHT 61.3-79.3%;
              card band y 27.9-72.7% (each card ~18% wide, ~44.8% tall). */}
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', height: '100%', maxWidth: '100%', containerType: 'size', animation: 'buyPageIn 0.34s cubic-bezier(0.22, 1.28, 0.42, 1) both' }}>
           {/* ART-BOX — exactly the region objectFit:contain paints the art into.
               Every overlay (hotspots, € prices, close ✕) anchors to THIS box, not
               the outer frame. The outer box is the Vice game-stage shape (~0.97,
               tall) but the art is 1.778 (wide) → it letterboxes top/bottom by a
               lot. A plain top:% on the outer box therefore dropped the € price
               well BELOW the grey pill. margin:auto + inset:0 + aspectRatio
               reproduces exactly where the art lands, so top:% is art-relative. */}
           <div style={{ position: 'absolute', inset: 0, margin: 'auto', aspectRatio: '1920 / 1080', maxWidth: '100%', maxHeight: '100%' }}>
            <img
              src={`${VBB}${ante ? 'page_on' : 'page_off'}.png`}
              alt="Bonus buy" draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
            />
            {/* LEFT card → ante toggle (composite swaps ON/OFF; no confirm) */}
            {anteCostMult ? (
              <button aria-label="3x free spins chance" onClick={toggleAnte}
                style={{ position: 'absolute', left: '20.7%', top: '27.9%', width: '18%', height: '44.8%', background: 'transparent', border: 'none', cursor: 'pointer' }} />
            ) : null}
            {/* MIDDLE card → buy 3 scatter */}
            <button aria-label="Buy 3 scatter" onClick={() => { uiSfx.click(); setConfirm(buy3); }}
              style={{ position: 'absolute', left: '41%', top: '27.9%', width: '18%', height: '44.8%', background: 'transparent', border: 'none', cursor: 'pointer' }} />
            {/* RIGHT card → buy 4 scatter */}
            <button aria-label="Buy 4 scatter" onClick={() => { uiSfx.click(); setConfirm(buy4); }}
              style={{ position: 'absolute', left: '61.3%', top: '27.9%', width: '18%', height: '44.8%', background: 'transparent', border: 'none', cursor: 'pointer' }} />
            {/* Real € PRICES centred in each card's grey pill (measured centre
                x: LEFT 29.7% · MIDDLE 50% · RIGHT 70.3%, y 56%). FitPrice scales
                the text down to the pill width so it never spills out the sides. */}
            {anteCostMult ? (
              <FitPrice leftPct={29.7} textStyle={priceTextStyle} value={moneyEur(bet * anteCostMult)} />
            ) : null}
            <FitPrice leftPct={50} textStyle={priceTextStyle} value={moneyEur(bet * buy3.costMult)} />
            <FitPrice leftPct={70.3} textStyle={priceTextStyle} value={moneyEur(bet * buy4.costMult)} />
            {/* close ✕ (top-right, above the card band) */}
            <button aria-label="Close" onClick={() => { uiSfx.click(); setConfirm(null); setOpen(false); }}
              style={{ position: 'absolute', right: '2.4%', top: '4%', width: '5.4cqh', height: '5.4cqh', borderRadius: '50%', border: '0.4cqh solid #ffd75e', cursor: 'pointer', background: 'radial-gradient(circle at 35% 30%, #ff6bb0 0%, #a3125e 70%)', color: '#fff', fontWeight: 900, fontSize: '3cqh', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
           </div>
          </div>

          {/* tap-outside affordance (the backdrop click closes the page) */}
          {!confirm && (
            <div style={{ position: 'absolute', bottom: '2.4%', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: "'Rubik', ui-sans-serif, system-ui, sans-serif", pointerEvents: 'none' }}>tap outside to close</div>
          )}

          {/* CONFIRM dialog: approve_3.png (3sc) / approve_4.png (else). Baked
              BACK (cancel) + OK (confirm) pills — hotspots measured from the art:
              BACK x 22.8-48.4% / OK x 51.7-77.2%, both y 63.7-80.0%. */}
          {confirm && (
            <div onClick={e => { e.stopPropagation(); uiSfx.click(); setConfirm(null); }} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,4,18,0.6)', zIndex: 5 }}>
              <div onClick={e => e.stopPropagation()} style={{ position: 'relative', aspectRatio: '1920 / 1080', height: '86%', maxWidth: '96%', containerType: 'size', animation: 'buyPageIn 0.28s cubic-bezier(0.22, 1.28, 0.42, 1) both' }}>
                <img
                  src={`${VBB}${confirm.scatters === 3 ? 'approve_3' : 'approve_4'}.png`}
                  alt="Confirm purchase" draggable={false}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                />
                {/* purchase € price in the empty band between the title and the
                    baked BACK / OK pills (art shows only "BUY N SCATTER"). */}
                <div style={{ position: 'absolute', left: '50%', top: '60%', transform: 'translate(-50%, -50%)', fontFamily: V_FONT, fontWeight: 900, fontStyle: 'italic', fontSize: '5.4cqh', color: '#ffd75e', letterSpacing: 0.5, whiteSpace: 'nowrap', pointerEvents: 'none', textShadow: '0 0 4px #1a0016, 2px 2px 0 #1a0016, -2px 2px 0 #1a0016, 2px -2px 0 #1a0016, -2px -2px 0 #1a0016, 0 4px 10px rgba(0,0,0,0.6)' }}>{moneyEur(bet * confirm.costMult)}</div>
                {/* BACK (cancel) */}
                <button aria-label="Back" onClick={() => { uiSfx.click(); setConfirm(null); }}
                  style={{ position: 'absolute', left: '22.8%', top: '63.7%', width: '25.6%', height: '16.3%', background: 'transparent', border: 'none', cursor: 'pointer' }} />
                {/* OK (confirm / buy) */}
                <button aria-label="Confirm buy" onClick={() => { uiSfx.click(); onBuy?.(confirm.stage); setConfirm(null); setOpen(false); }}
                  style={{ position: 'absolute', left: '51.7%', top: '63.7%', width: '25.5%', height: '16.3%', background: 'transparent', border: 'none', cursor: 'pointer' }} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function BonusBuyOverlay({ betDisplay, onBuy }: { betDisplay: string; onBuy?: (id: string, kind: Card['kind']) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Card | null>(null);
  const bet = Math.max(0.01, Number(betDisplay || '0'));

  const cardClick = (c: Card) => {
    if (c.kind === 'activate') {
      setActive(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; });
      onBuy?.(c.id, c.kind);
    } else setConfirm(c);
  };

  return (
    <>
      {/* ── ROUND TRIGGER (ours; placeholder round shape) ── */}
      <button onClick={() => { uiSfx.open(); setOpen(true); }} title="Bonus buy" style={{
        position: 'absolute', left: 14, bottom: 14, zIndex: 40, width: 62, height: 62, borderRadius: '50%',
        border: 'none', cursor: 'pointer', background: 'radial-gradient(circle at 34% 28%, #8dff5a 0%, #4bbf1f 46%, #2b7d10 100%)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.55), inset 0 -4px 8px rgba(0,0,0,0.35)',
        color: '#0b2a06', fontWeight: 900, fontStyle: 'italic', fontSize: 11, lineHeight: 1.02,
        display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        fontFamily: "'Rubik', ui-sans-serif, system-ui, sans-serif",
      }}>BONUS<br />BUY</button>

      {!open ? null : (
        <div onClick={() => setOpen(false)} style={{
          position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, overflow: 'auto', padding: 14,
          background: 'rgba(4,6,10,0.82)', backdropFilter: 'blur(3px)',
          fontFamily: "'Rubik', ui-sans-serif, system-ui, sans-serif",
        }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: '98%' }}>
            {/* BET box (PNG) with dynamic bet value overlaid */}
            <div style={{ position: 'relative', width: 190, height: Math.round(190 * 478 / 400), backgroundImage: `url(${BB}betbox.png)`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}>
              <div style={{ position: 'absolute', top: '52%', left: '18%', right: '18%', height: '13%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#f2f3f5,#e6e9ec)', borderRadius: 8 }}>
                <span style={{ color: '#15171c', fontWeight: 900, fontStyle: 'italic', fontSize: 18, fontFamily: FONT }}>{money(bet)}</span>
              </div>
            </div>

            {/* 5 feature cards (exact PNG frames) */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {CARDS.map(c => {
                const on = active.has(c.id);
                return (
                  <div key={c.id} onClick={() => cardClick(c)} style={{
                    position: 'relative', width: CW, height: CH, cursor: 'pointer',
                    backgroundImage: `url(${BB}${c.kind === 'buy' ? 'card_d' : 'card_a'}.png)`,
                    backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
                  }}>
                    {/* editable TITLE covers the baked template title (top of card) */}
                    <div style={{ position: 'absolute', top: '3.5%', left: '5%', right: '5%', height: '15%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#f4f5f7,#e9ecef)', borderRadius: 7 }}>
                      <span style={{ color: '#15171c', fontWeight: 900, fontStyle: 'italic', fontSize: 12, lineHeight: 1.02, textAlign: 'center', whiteSpace: 'pre-line', fontFamily: FONT }}>{c.title}</span>
                    </div>
                    {/* dynamic PRICE covers the baked "$3.00" (~71% down the card) */}
                    <div style={{ position: 'absolute', top: '68.5%', left: '14%', right: '14%', height: '7%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#eef0f2,#e4e7ea)', borderRadius: 6 }}>
                      <span style={{ color: '#15171c', fontWeight: 900, fontStyle: 'italic', fontSize: 15, fontFamily: FONT }}>{money(bet * c.mult)}</span>
                    </div>
                    {on && <div style={{ position: 'absolute', inset: '2% 4% 3%', borderRadius: 16, boxShadow: '0 0 0 3px #ff9d2e', pointerEvents: 'none' }} />}
                  </div>
                );
              })}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>tap outside to close</div>
          </div>

          {/* Confirmation dialog (exact PNG) */}
          {confirm && (
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,6,10,0.6)' }}>
              <div style={{ position: 'relative', width: 320, height: Math.round(320 * 528 / 500), backgroundImage: `url(${BB}dialog.png)`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }}>
                <div style={{ position: 'absolute', top: '49%', left: '28%', right: '28%', height: '9%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#f2f3f5,#e6e9ec)', borderRadius: 8 }}>
                  <span style={{ color: '#15171c', fontWeight: 900, fontStyle: 'italic', fontSize: 20 }}>{money(bet * confirm.mult)}</span>
                </div>
                {/* BACK / OK click regions over the baked buttons */}
                <div onClick={() => setConfirm(null)} style={{ position: 'absolute', left: '6%', bottom: '6%', width: '42%', height: '18%', cursor: 'pointer' }} />
                <div onClick={() => { onBuy?.(confirm.id, confirm.kind); setConfirm(null); setOpen(false); }} style={{ position: 'absolute', right: '6%', bottom: '6%', width: '42%', height: '18%', cursor: 'pointer' }} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
