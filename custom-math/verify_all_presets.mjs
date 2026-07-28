// CROSS-GAME parity check — the defect classes Vice Heat taught us, applied to
// every built-in.
//
// verify_preset_parity.mjs is the deep, Vice-specific gate (13 checks, including
// its audio bytes and its buy certifications). This one is deliberately shallow
// and wide: it runs only the checks that are TRUE OF ANY GAME, over all four
// exports, so a defect we already paid for once cannot quietly live on in the
// other three.
//
//   node custom-math/verify_all_presets.mjs
//
// Exit code 0 = no cross-game defect. Non-zero = at least one game would ship
// wrong.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const GAMES = [
  { key: 'vice', label: 'Vice Heat', preset: join(ROOT, 'dev-handoff', 'preset', 'vice-heat.chainwtf-preset.json') },
  { key: 'crackfarm', label: 'Crack Farm', preset: join(ROOT, 'scratchpad_presets', 'crack-farm.chainwtf-preset.json') },
  { key: 'fruitstacks', label: 'Fruit Stacks', preset: join(ROOT, 'scratchpad_presets', 'fruit-stacks.chainwtf-preset.json') },
  { key: 'sushi', label: 'Sushi Party', preset: join(ROOT, 'scratchpad_presets', 'sushi-party.chainwtf-preset.json') },
];

// Emit anything that is missing so the check always runs against fresh output.
for (const g of GAMES) {
  if (!existsSync(g.preset)) {
    execFileSync(process.execPath, [join(HERE, 'emit_vice_preset.mjs'), `--game=${g.key}`], { stdio: 'pipe' });
  }
}

const rows = [];
let failures = 0;

for (const g of GAMES) {
  const P = JSON.parse(readFileSync(g.preset, 'utf8'));
  const M = P.math?.manifest ?? {};
  const fails = [];
  const warns = [];

  // 1. D8 — the flat root. A root-reading loader that finds no reelStrips falls
  //    back to a default 5x3 game and pays completely different math.
  for (const k of ['reelStrips', 'payTable', 'rtpBps', 'gridId', 'maxWinMultiplier']) {
    if (P[k] === undefined) fails.push(`flat root is missing "${k}" — a root-reading loader silently falls back to the built-in default game`);
  }
  for (const k of ['reelStrips', 'payTable', 'rtpBps', 'gridId', 'custom']) {
    if (P[k] !== undefined && JSON.stringify(P[k]) !== JSON.stringify(M[k])) {
      fails.push(`flat root "${k}" disagrees with math.manifest.${k} — two sources of truth`);
    }
  }

  // 2. D10 — expectedMetrics must recompute to rtpBps, or the partner assembler
  //    stamps its own default over the certified figure.
  const bps = M.rtpBps, em = M.expectedMetrics?.rtpPct;
  if (bps == null) fails.push('math.manifest.rtpBps is missing');
  else if (em == null) fails.push('expectedMetrics.rtpPct is missing — the assembler will invent one');
  else if (Math.round(em * 100) !== bps) fails.push(`expectedMetrics.rtpPct ${em} recomputes to ${Math.round(em * 100)} bps, but rtpBps is ${bps}`);

  // 3. A shippable RTP. Anything at or over 100% is not a game, and anything
  //    far off 96 is either uncertified or mis-stamped.
  if (typeof bps === 'number') {
    if (bps >= 10000) fails.push(`rtpBps ${bps} = ${(bps / 100).toFixed(2)}% — AT OR ABOVE 100%. This cannot ship.`);
    else if (bps < 9400 || bps > 9750) warns.push(`rtpBps ${bps} = ${(bps / 100).toFixed(2)}% is well off the 96% house target`);
  }
  const simRounds = M.custom?.simRounds;
  if (typeof simRounds === 'number' && simRounds < 1_000_000) {
    fails.push(`the RTP comes from custom.simRtpPct over only ${simRounds.toLocaleString()} rounds — not a certification`);
  }

  // 4. Every mathBinding must resolve. A binding naming a deleted key tells the
  //    dev to implement a mechanic we retired.
  const resolve = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), M);
  for (const mech of P.mechanics ?? []) {
    for (const b of mech.mathBinding ?? []) {
      if (resolve(b) === undefined) fails.push(`mechanics[${mech.id}].mathBinding "${b}" does not exist in math.manifest`);
    }
  }

  // 5. The flow must start with the loader, and its transitions must be
  //    buildable — a style NAME is not a spec, which is why the dev build had
  //    no transitions at all.
  const stages = P.flow?.stages ?? [];
  if (!stages.length) fails.push('flow.stages is empty — the dev has no pipeline to build');
  else if (stages[0].id !== 'boot') fails.push(`flow.stages[0] is "${stages[0].id}", expected "boot" — the loading screen must come first`);
  if (!P.flow?.iris?.technique) fails.push('flow.iris carries no technique — a style name cannot be rebuilt, and that is exactly why his build has no transitions');

  // 6. Assets that are declared must exist somewhere we can hand over.
  const themeDir = join(ROOT, 'public');
  const refs = new Set();
  (function collect(o, key) {
    if (typeof o === 'string') {
      if (!/^_|InRepo$|^(note|why|rule|formula|status|comment|description)$/i.test(key ?? '')
        && /\.(webp|png|ogg)$/i.test(o) && /^\/?theme\//.test(o)) refs.add(o.replace(/^\//, ''));
      return;
    }
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) collect(o[k], Array.isArray(o) ? key : k);
  })(P, null);
  const missingArt = [...refs].filter((r) => !existsSync(join(themeDir, r)));
  for (const r of missingArt.slice(0, 6)) fails.push(`declared asset "${r}" does not exist under public/`);
  if (missingArt.length > 6) fails.push(`…and ${missingArt.length - 6} more missing assets`);

  // 7. Presentation actually described, or only named.
  const pt = P.extras?.presentationTuning ?? {};
  const nums = (() => { let n = 0; const w = (x) => { if (x && typeof x === 'object') for (const k of Object.keys(x)) w(x[k]); else if (typeof x === 'number') n++; }; w(pt); return n; })();
  if (nums < 100) warns.push(`extras.presentationTuning carries only ${nums} numbers — the dev fills the rest with his own defaults (Vice ships ~1,900)`);

  rows.push({ game: g.label, key: g.key, fails, warns, refs: refs.size, mechanics: (P.mechanics ?? []).length, bps, nums });
  failures += fails.length;
}

const w = (s, n) => String(s).padEnd(n);
console.log('');
console.log('CROSS-GAME PARITY — the defect classes Vice taught us, over every built-in');
console.log('');
console.log(`  ${w('game', 14)}${w('rtpBps', 9)}${w('mechs', 7)}${w('assets', 8)}${w('tuning#', 9)}fails`);
for (const r of rows) {
  console.log(`  ${w(r.game, 14)}${w(r.bps ?? '—', 9)}${w(r.mechanics, 7)}${w(r.refs, 8)}${w(r.nums, 9)}${r.fails.length}`);
}
console.log('');
for (const r of rows) {
  if (!r.fails.length && !r.warns.length) { console.log(`  ${r.game}: clean`); continue; }
  console.log(`  ── ${r.game} ──`);
  for (const f of r.fails) console.log(`     FAIL  ${f}`);
  for (const x of r.warns) console.log(`     warn  ${x}`);
}
console.log('');
console.log(`  ${failures} cross-game failure(s)`);
if (failures) process.exit(1);
