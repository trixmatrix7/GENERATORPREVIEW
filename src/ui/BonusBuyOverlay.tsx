import { useEffect, useState } from 'react';
import { uiSfx } from '@/audio/uiSfx';
import { FRUIT_BUY_STAGES } from '@/game/fruitStacksMath';

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
const CW = 150;                 // card display width (PNG is 360×598)
const CH = Math.round(CW * 598 / 360);
// One place to change all bonus-buy text styling (Noski wants the fonts easy to
// swap). Change this string (or per-slot below) to restyle the cards / bet.
const FONT = "'Rubik', ui-sans-serif, system-ui, sans-serif";

// ── FRUIT STACKS: purchased FS stages (sim-calibrated costs; stage 2/3
// pre-load the pool at ×50/×100). Each card shows its tier's gift box with
// the tier's REAL minimum gift multi from the certified multiWeights:
// silver ×2–5, red ×6–25, gold ×50–500 (checked 2026-07-23). ──
const FRUIT_BUY_TIER = [
  { img: 'gift_tier1.png', min: 2 },
  { img: 'gift_tier2.png', min: 6 },
  { img: 'gift_tier3.png', min: 50 },
] as const;

export function FruitBuyRail({ betDisplay, onBuy, bonusActive = false }: { betDisplay: string; onBuy?: (stage: number) => void; bonusActive?: boolean }) {
  const [open, setOpen] = useState(false);
  // Bestätigung NACH Karten-Klick — wieder drin (Noski lieferte das Theme-Art:
  // Holzrahmen-Dialog mit gebakten ✗/✓-Kugeln; Hotspots sitzen AUF den Kugeln).
  const [confirm, setConfirm] = useState<number | null>(null);
  // Rail-left alignment: PixiApp broadcasts the logo's left edge (percent of
  // canvas width) so the buy button moves WITH the logo (Noski: same margin
  // left as the grid has right).
  const [railLeftPct, setRailLeftPct] = useState(4.2);
  useEffect(() => {
    const on = (e: Event) => setRailLeftPct(Number((e as CustomEvent).detail) || 4.2);
    window.addEventListener('slot:leftrail', on);
    return () => window.removeEventListener('slot:leftrail', on);
  }, []);
  const bet = Math.max(0.01, Number(betDisplay || '0'));
  return (
    <>
      {/* LEFT-RAIL: during a FS round the pill is replaced by BONUS ACTIVE */}
      {bonusActive ? (
        <img
          src={`${import.meta.env.BASE_URL}theme/fruitstacks/bonus_active2.webp`}
          alt="Bonus active"
          style={{ position: 'absolute', left: `${railLeftPct}%`, top: '45%', zIndex: 40, width: '16%', minWidth: 130, pointerEvents: 'none' }}
        />
      ) : (
      <button onClick={() => { uiSfx.open(); setOpen(true); }} title="Buy bonus" style={{
        position: 'absolute', left: `${railLeftPct}%`, top: '46%', zIndex: 40, width: '15%', minWidth: 124,
        padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
      }}>
        {/* Noski's button art (Holz-Plakette "BUY FREE SPINS", 2026-07-23) —
            deliberately NO price on it */}
        <img src={`${import.meta.env.BASE_URL}theme/fruitstacks/bonusbuy_btn2.webp`} alt="Buy bonus" style={{ width: '100%', display: 'block' }} />
      </button>
      )}

      {!open ? null : (
        <div onClick={() => setOpen(false)} style={{
          position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, overflow: 'auto', padding: 14,
          background: 'rgba(3,10,5,0.84)', backdropFilter: 'blur(3px)', fontFamily: FONT,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '96%' }}>
            {FRUIT_BUY_STAGES.map(st => (
              <div key={st.stage} onClick={() => { uiSfx.click(); setConfirm(st.stage); }} style={{
                position: 'relative', width: 244, height: Math.round(244 * 2400 / 1792), cursor: 'pointer',
                backgroundImage: `url(${import.meta.env.BASE_URL}theme/fruitstacks/buycard_${st.stage}.png)`,
                backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
                fontFamily: FONT,
              }}>
                {/* the cards are EMPTY frames — title / stage / gift / price overlay */}
                <div style={{ position: 'absolute', top: '27%', left: '10%', right: '10%', textAlign: 'center', color: '#fff', fontWeight: 900, fontStyle: 'italic', fontSize: 25, textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>FREE SPINS</div>
                <div style={{ position: 'absolute', top: '42.5%', left: '10%', right: '10%', textAlign: 'center', color: '#ffe9a8', fontWeight: 900, fontStyle: 'italic', fontSize: 30, textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}>{st.stage === 1 ? '15 SPINS' : st.label}</div>
                {/* tier gift box + its REAL minimum multi (replaces the old text line) */}
                <div style={{ position: 'absolute', top: '52%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img
                    src={`${import.meta.env.BASE_URL}theme/fruitstacks/${FRUIT_BUY_TIER[st.stage - 1].img}`}
                    alt="" draggable={false}
                    style={{ width: '30%', display: 'block', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.45))' }}
                  />
                  {/* das ECHTE Multi-Art (Noskis x2..x500-Pack) statt Text */}
                  <img
                    src={`${import.meta.env.BASE_URL}theme/fruitstacks/multis/x${FRUIT_BUY_TIER[st.stage - 1].min}.webp`}
                    alt={`×${FRUIT_BUY_TIER[st.stage - 1].min}`} draggable={false}
                    style={{ marginTop: -14, height: 30, filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.5))' }}
                  />
                </div>
                <div style={{ position: 'absolute', bottom: '8.5%', left: '12%', right: '12%', textAlign: 'center', color: '#ffe9a8', fontWeight: 900, fontStyle: 'italic', fontSize: 24, textShadow: '0 2px 5px rgba(0,0,0,0.85)' }}>{money(bet * st.costMult)}</div>
              </div>
            ))}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>tap outside to close</div>
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
      )}
    </>
  );
}

// ── VICE HEAT: staged buys (3sc/4sc) + 3x-FS-chance ante. PLACEHOLDER cards
// (styled frames, no PNGs yet) — the dev re-links the real card art; wiring,
// prices and the ante toggle are final. Round trigger sits bottom-left with a
// little air to the reel frame (Noski).
export interface ViceBuyStageDef { stage: number; scatters: number; costMult: number }

export function ViceBuyRail({ betDisplay, stages, anteCostMult, onBuy }: {
  betDisplay: string;
  stages: ViceBuyStageDef[];
  anteCostMult?: number;
  onBuy?: (stage: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<ViceBuyStageDef | null>(null);
  const [ante, setAnte] = useState(() => localStorage.getItem('vice:ante') === '1');
  const bet = Math.max(0.01, Number(betDisplay || '0'));
  const toggleAnte = () => {
    const next = !ante;
    setAnte(next);
    localStorage.setItem('vice:ante', next ? '1' : '0');
    uiSfx.click();
  };
  const V_FONT = "'Rubik', ui-sans-serif, system-ui, sans-serif";
  const cardBase = {
    position: 'relative' as const, width: 168, height: 236, cursor: 'pointer', borderRadius: 18,
    border: '3px solid #ff4fa3', background: 'linear-gradient(180deg,#2a1140 0%, #14082a 100%)',
    boxShadow: '0 6px 22px rgba(0,0,0,0.55), inset 0 2px 5px rgba(255,255,255,0.12)',
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    gap: 10, textAlign: 'center' as const, padding: 12, fontFamily: V_FONT,
  };
  return (
    <>
      {/* small round trigger, bottom-left with air to the reel frame */}
      <button onClick={() => { uiSfx.open(); setOpen(true); }} title="Bonus buy" style={{
        position: 'absolute', left: 120, bottom: 140, zIndex: 40, width: 58, height: 58, borderRadius: '50%',
        border: '2px solid #ffd75e', cursor: 'pointer',
        background: 'radial-gradient(circle at 34% 28%, #ff9ad0 0%, #ff3d9a 46%, #a3125e 100%)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.55), inset 0 2px 3px rgba(255,255,255,0.5), inset 0 -4px 8px rgba(0,0,0,0.35)',
        color: '#fff', fontWeight: 900, fontStyle: 'italic', fontSize: 10.5, lineHeight: 1.05,
        display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: V_FONT,
      }}>BONUS<br />BUY{ante ? <span style={{ position: 'absolute', bottom: -6, right: -8, background: '#ffd75e', color: '#3a0f24', borderRadius: 8, fontSize: 8.5, fontStyle: 'normal', padding: '1px 5px' }}>3xFS</span> : null}</button>

      {!open ? null : (
        <div onClick={() => setOpen(false)} style={{
          position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, overflow: 'auto', padding: 14,
          background: 'rgba(10,4,18,0.85)', backdropFilter: 'blur(3px)', fontFamily: V_FONT,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '96%' }}>
            {/* ANTE toggle card */}
            {anteCostMult ? (
              <div onClick={toggleAnte} style={{ ...cardBase, border: ante ? '3px solid #ffd75e' : cardBase.border }}>
                <div style={{ color: '#ff9ad0', fontWeight: 900, fontStyle: 'italic', fontSize: 17, lineHeight: 1.1 }}>3x FREE SPINS<br />CHANCE</div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>Jeder Spin kostet x{anteCostMult} — Scatter erscheinen 3x so oft</div>
                <div style={{ color: '#ffd75e', fontWeight: 900, fontSize: 16 }}>{money(bet * anteCostMult)} / Spin</div>
                <div style={{
                  padding: '4px 16px', borderRadius: 999, fontWeight: 900, fontSize: 12,
                  background: ante ? 'linear-gradient(180deg,#ffd75e,#f7a733)' : '#3c1f57', color: ante ? '#3a0f24' : '#cbb3e6',
                }}>{ante ? 'AKTIV' : 'AUS'}</div>
              </div>
            ) : null}
            {/* BUY cards */}
            {stages.map(st => (
              <div key={st.stage} onClick={() => { uiSfx.click(); setConfirm(st); }} style={cardBase}>
                <div style={{ color: '#7ff3ff', fontWeight: 900, fontStyle: 'italic', fontSize: 17, lineHeight: 1.1 }}>BUY<br />{st.scatters} SCATTER</div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{st.scatters >= 4 ? '10 Sticky-Tower-Spins' : '7 Expanding-Wild-Spins'}</div>
                <div style={{ color: '#ffd75e', fontWeight: 900, fontSize: 18 }}>{money(bet * st.costMult)}</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>{st.costMult}x Einsatz</div>
              </div>
            ))}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>tap outside to close</div>
          {confirm && (
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,4,18,0.6)' }}>
              <div style={{
                width: 300, borderRadius: 20, border: '3px solid #ff4fa3', padding: '22px 18px',
                background: 'linear-gradient(180deg,#2a1140 0%, #14082a 100%)', textAlign: 'center',
              }}>
                <div style={{ color: '#7ff3ff', fontWeight: 900, fontStyle: 'italic', fontSize: 17 }}>BUY {confirm.scatters} SCATTER</div>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 24, margin: '12px 0' }}>{money(bet * confirm.costMult)}</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button onClick={() => { uiSfx.click(); setConfirm(null); }} style={{ padding: '8px 20px', borderRadius: 10, border: '2px solid #8a7a92', background: '#241533', color: '#e0cfec', fontWeight: 800, cursor: 'pointer', fontFamily: V_FONT }}>BACK</button>
                  <button onClick={() => { uiSfx.click(); onBuy?.(confirm.stage); setConfirm(null); setOpen(false); }} style={{ padding: '8px 24px', borderRadius: 10, border: '2px solid #ffd75e', background: 'linear-gradient(180deg,#ffd75e,#f7a733)', color: '#3a0f24', fontWeight: 900, cursor: 'pointer', fontFamily: V_FONT }}>OK</button>
                </div>
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
