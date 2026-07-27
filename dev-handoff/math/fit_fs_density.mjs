// Fine-tune the TOP-LEVEL fsReelStrips wild density to land natural RTP on target.
//
// WHY THIS LEVER: after the evaluator fix, the retired simul ladder and the new
// hot spins, natural measured 94.67% +/-1.10 (30M rounds) against a 96.00% target.
// The paytable is shared by every mode, so scaling it would drag the freshly
// calibrated buys (96.04 / 95.77) up with it. The top-level fsReelStrips are used
// by NATURAL free spins and the ante's free spins ONLY — buy3/buy4 carry their own
// fsReelStrips — so nudging their wild density moves natural without touching the
// buys at all.
//
// METHOD: repeat each 120-stop strip x10 (1200 stops, 10 wilds, 10 scatters), then
// DROP `pad` filler stops, taking them from whichever paying symbol is currently
// most over-represented so the symbol mix stays put. Density = 10/(1200-pad).
// Scatters ride along; on FS strips they only affect retriggers, never the trigger
// rate (that comes from the base strips), so a couple of percent there is noise.
//
//   node custom-math/fit_fs_density.mjs <pad>          -> writes the manifest
//   node custom-math/fit_fs_density.mjs --restore      -> puts the original back
import fs from 'node:fs';

const MATH = 'C:/Users/noski/Downloads/GENERATOR PREVIEW/src/data/math_vice_heat.json';
const BAK = 'C:/Users/noski/Downloads/GENERATOR PREVIEW/custom-math/.fsReelStrips.original.json';
const WILD = 0, SCATTER = 1;

const m = JSON.parse(fs.readFileSync(MATH, 'utf8'));

// Keep one pristine copy of the certified 120-stop strips to fit from.
if (!fs.existsSync(BAK)) fs.writeFileSync(BAK, JSON.stringify(m.fsReelStrips));
const ORIG = JSON.parse(fs.readFileSync(BAK, 'utf8'));

if (process.argv[2] === '--restore') {
  m.fsReelStrips = ORIG;
  fs.writeFileSync(MATH, JSON.stringify(m, null, 2) + '\n');
  console.log('restored original fsReelStrips:', ORIG.map(s => s.length).join('/'));
  process.exit(0);
}

const pad = Number(process.argv[2] ?? 0);
const REP = 10;

function build(orig) {
  const rep = [];
  for (let i = 0; i < REP; i++) rep.push(...orig);          // x10, mix preserved exactly
  // Drop `pad` filler stops, always from the symbol that is furthest above its
  // share right now — keeps every paying symbol's proportion intact.
  const target = {};
  for (const s of rep) target[s] = (target[s] ?? 0) + 1;
  const ideal = {};
  const total = rep.length;
  for (const k of Object.keys(target)) ideal[k] = target[k] / total;

  const pool = rep.slice();
  for (let d = 0; d < pad; d++) {
    const cnt = {};
    for (const s of pool) cnt[s] = (cnt[s] ?? 0) + 1;
    let worst = null, worstExcess = -Infinity;
    for (const k of Object.keys(cnt)) {
      const id = Number(k);
      if (id === WILD || id === SCATTER) continue;           // never thin wilds/scatters
      if (cnt[k] <= 1) continue;
      const excess = cnt[k] / pool.length - ideal[k];
      if (excess > worstExcess) { worstExcess = excess; worst = id; }
    }
    if (worst === null) break;
    pool.splice(pool.lastIndexOf(worst), 1);
  }
  return pool;
}

// deterministic shuffle so runs are reproducible
function shuffle(a, seed) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const built = ORIG.map((strip, r) => shuffle(build(strip), 20260727 + r * 7919));
m.fsReelStrips = built;
fs.writeFileSync(MATH, JSON.stringify(m, null, 2) + '\n');

const wc = s => s.filter(x => x === WILD).length;
const sc = s => s.filter(x => x === SCATTER).length;
const dens = s => (100 * wc(s) / s.length);
const origDens = 100 * wc(ORIG[0]) / ORIG[0].length;
console.log(`pad ${pad}  ->  ${built.map(s => s.length).join('/')} stops`);
console.log(`   wilds ${built.map(wc).join('/')}   scatters ${built.map(sc).join('/')}`);
console.log(`   wild density ${dens(built[0]).toFixed(4)}%  (was ${origDens.toFixed(4)}%)  = x${(dens(built[0]) / origDens).toFixed(4)}`);
// mix check
const mix = st => { const c = {}; for (const s of st) if (s !== WILD && s !== SCATTER) c[s] = (c[s] ?? 0) + 1; const t = Object.values(c).reduce((a, b) => a + b, 0); return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, (100 * v / t).toFixed(2)])); };
console.log('   mix reel0 orig:', JSON.stringify(mix(ORIG[0])));
console.log('   mix reel0 new :', JSON.stringify(mix(built[0])));
