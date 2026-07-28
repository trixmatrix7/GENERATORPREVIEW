// VICE HEAT — stage the dev-handoff audio from what the LIVE build actually plays.
//
// dev-handoff/assets/audio/ was populated by hand and went two mixes stale
// without anything noticing: the filenames were right, so every check passed —
// but the BYTES were the generic ULTRA_CLEAN dev preset, not Noski's Vice mix.
// win-screen-music shipped as a 66 KB library sting where the live build plays
// an 805 KB track, and the count-up durations (2.6-5.6 s) are tuned to that
// track. A dev building from the package would have hit every cue with a
// different sound and had silence through most of the marquee.
//
// So the folder is no longer curated. It is DERIVED:
//
//   devId  --VICE_AUDIO_CONTRACT-->  sourceId
//   sourceId --viceSoundPreset.picks--> a real file under public/
//            (falling back to the registry default /audio/<sourceId>.ogg)
//   copy those bytes to dev-handoff/assets/audio/<devId>.ogg
//
// which is exactly the resolution order src/App.tsx uses at boot, so what ships
// is what plays. Disabled events (volume 0) ship no file at all.
//
//   node custom-math/stage_vice_audio.mjs [--check]
//     --check   report drift and exit non-zero; copy nothing

import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PUBLIC = join(ROOT, 'public');
const DEST = join(ROOT, 'dev-handoff', 'assets', 'audio');
const CHECK = process.argv.includes('--check');

const core = readFileSync(join(ROOT, 'src', 'studio', 'exportPresetV2Core.ts'), 'utf8');
const preset = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'viceSoundPreset.json'), 'utf8'));

// The devId -> sourceId contract, read from the exporter so the two cannot drift.
const contractBlock = core.match(/const VICE_AUDIO_CONTRACT[\s\S]*?\n\];/);
if (!contractBlock) { console.error('could not find VICE_AUDIO_CONTRACT in exportPresetV2Core.ts'); process.exit(2); }
const CONTRACT = [...contractBlock[0].matchAll(/devId:\s*'([^']+)',\s*sourceId:\s*'([^']+)'/g)]
  .map(([, devId, sourceId]) => ({ devId, sourceId }));

const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex');

/** The live runtime's resolution order for a source event. */
function resolveSource(sourceId) {
  const pick = preset.picks?.[sourceId];
  if (pick) {
    const p = join(PUBLIC, pick.replace(/^\//, ''));
    return existsSync(p) ? { path: p, via: `viceSoundPreset.picks["${sourceId}"]` } : { missing: pick };
  }
  const dflt = join(PUBLIC, 'audio', `${sourceId}.ogg`);
  return existsSync(dflt) ? { path: dflt, via: 'registry default /audio/<id>.ogg' } : { missing: `audio/${sourceId}.ogg` };
}

const rows = [];
const keep = new Set();
let drift = 0;

for (const { devId, sourceId } of CONTRACT) {
  const vol = preset.volumes?.[sourceId];
  const enabled = vol == null ? null : vol > 0;
  if (enabled === false) {
    rows.push({ devId, state: 'off', note: `volume 0 — ships no file` });
    continue;
  }
  const r = resolveSource(sourceId);
  if (r.missing) { rows.push({ devId, state: 'MISSING', note: `live source ${r.missing} not found` }); drift++; continue; }
  keep.add(`${devId}.ogg`);
  const dest = join(DEST, `${devId}.ogg`);
  const srcHash = md5(r.path);
  const same = existsSync(dest) && md5(dest) === srcHash;
  if (!same) {
    drift++;
    if (!CHECK) copyFileSync(r.path, dest);
  }
  rows.push({
    devId, state: same ? 'ok' : (CHECK ? 'DRIFT' : 'restaged'),
    src: relative(PUBLIC, r.path).replace(/\\/g, '/'),
    via: r.via, md5: srcHash.slice(0, 8), bytes: statSync(r.path).size, vol,
  });
}

// EVENTS NOISKI PICKED THAT THE PARTNER RUNTIME NEVER DISPATCHES.
// They are part of his mix and they play on our build; the dev's engine has no
// dispatch site for them, so they are silent in his build until he adds one.
// Ship them anyway — the alternative is that the day he wires the beat, the
// sound is missing and he substitutes his own.
const CONTRACT_SOURCES = new Set(CONTRACT.map((c) => c.sourceId));
const EXTRAS = Object.keys(preset.picks ?? {})
  .filter((id) => !CONTRACT_SOURCES.has(id) && (preset.volumes?.[id] ?? 0) > 0);

for (const id of EXTRAS) {
  const r = resolveSource(id);
  if (r.missing) { rows.push({ devId: id, state: 'MISSING', note: `live source ${r.missing} not found` }); drift++; continue; }
  keep.add(`${id}.ogg`);
  const dest = join(DEST, `${id}.ogg`);
  const srcHash = md5(r.path);
  const same = existsSync(dest) && md5(dest) === srcHash;
  if (!same) { drift++; if (!CHECK) copyFileSync(r.path, dest); }
  rows.push({
    devId: id, state: same ? 'ok' : (CHECK ? 'DRIFT' : 'restaged'),
    src: relative(PUBLIC, r.path).replace(/\\/g, '/'), via: 'not dispatched by the partner runtime',
    md5: srcHash.slice(0, 8), bytes: statSync(r.path).size, vol: preset.volumes?.[id],
  });
}

// Anything left in the folder that the contract does not produce is either the
// UI sfx (which the tuning block references by name) or a leftover.
const UI = new Set(['ui-click.ogg', 'ui-spin.ogg', 'ui-open.ogg', 'README.md']);
const orphans = readdirSync(DEST).filter((f) => !keep.has(f) && !UI.has(f));
for (const f of orphans) {
  drift++;
  if (!CHECK) unlinkSync(join(DEST, f));
}

const w = (s, n) => String(s).padEnd(n);
console.log('');
console.log('VICE HEAT — dev-handoff audio staging');
console.log(`  ${CHECK ? 'checking' : 'staging into'} ${relative(ROOT, DEST)}`);
console.log('');
for (const r of rows) {
  if (r.state === 'off') { console.log(`  ${w(r.state, 9)} ${w(r.devId, 20)} ${r.note}`); continue; }
  if (r.state === 'MISSING') { console.log(`  ${w(r.state, 9)} ${w(r.devId, 20)} ${r.note}`); continue; }
  console.log(`  ${w(r.state, 9)} ${w(r.devId, 20)} vol ${w(r.vol ?? '?', 6)} ${w(r.md5, 10)} ${w(r.bytes + ' B', 10)} ${r.src}`);
}
for (const f of orphans) console.log(`  ${w(CHECK ? 'ORPHAN' : 'removed', 9)} ${f} — not produced by the contract`);
console.log('');
if (CHECK && drift) {
  console.log(`  ${drift} file(s) drifted from the live mix — run without --check to restage.`);
  process.exit(1);
}
console.log(drift ? `  ${drift} file(s) restaged.` : '  already in sync with the live mix.');
