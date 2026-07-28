// VICE HEAT — preset parity gate.
//
// The rule this enforces: the dev's generator rebuilds the game FROM THE PRESET
// ALONE, and his engine fills anything the preset does not declare with its own
// hardcoded default. So a silent gap does not read as "missing feature" — it
// reads as a working build that is the wrong game. His last drop had no sound at
// all, the generator's gold marquee instead of ours, its default win-line look
// drawn over a ways game, and no transitions.
//
// Every check below has failed at least once in this project.
//
//   node custom-math/verify_preset_parity.mjs [--emit]
//     --emit   re-emit the preset first (custom-math/emit_vice_preset.mjs)
//
// Exit code 0 = the package is internally consistent. Non-zero = do not ship.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const HANDOFF = join(ROOT, 'dev-handoff');
const PRESET_PATH = join(HANDOFF, 'preset', 'vice-heat.chainwtf-preset.json');
const MANIFEST_PATH = join(ROOT, 'src', 'data', 'math_vice_heat.json');

if (process.argv.includes('--emit')) {
  execFileSync(process.execPath, [join(HERE, 'emit_vice_preset.mjs')], { stdio: 'inherit' });
}

const P = JSON.parse(readFileSync(PRESET_PATH, 'utf8'));
const M = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const src = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const fails = [];
const warns = [];
const passes = [];
const fail = (group, msg) => fails.push(`${group}: ${msg}`);
const warn = (group, msg) => warns.push(`${group}: ${msg}`);
const pass = (group, msg) => passes.push(`${group}: ${msg}`);

// ── 1. LAYOUT DRIFT ─────────────────────────────────────────────────────────
// exportPresetV2Core hardcodes CELL/LAYOUT/GRIDS. It exports
// V2_LAYOUT_ASSUMPTIONS "drift-asserted against the runtime" — but nothing ever
// asserted it, so the two could diverge silently and every px in the sizing
// package would be wrong.
{
  const g = 'layout-drift';
  const core = src('src/studio/exportPresetV2Core.ts');
  const pixi = src('src/game/PixiApp.ts');
  const grid = src('src/config/gridConfig.ts');

  const num = (text, re, what) => {
    const m = text.match(re);
    if (!m) { fail(g, `could not read ${what} from the runtime — the parity gate cannot verify it`); return null; }
    return Number(m[1]);
  };
  const runtime = {
    framePad: num(pixi, /const FRAME_PAD\s*=\s*(\d+)/, 'FRAME_PAD'),
    headerH: num(pixi, /const HEADER_H\s*=\s*(\d+)/, 'HEADER_H'),
    footerH: num(pixi, /const FOOTER_H\s*=\s*(\d+)/, 'FOOTER_H'),
    sceneMargin: num(pixi, /const SCENE_MARGIN\s*=\s*(\d+)/, 'SCENE_MARGIN'),
  };
  const exported = {
    framePad: num(core, /LAYOUT\s*=\s*\{[^}]*framePad:\s*(\d+)/, 'exporter framePad'),
    headerH: num(core, /LAYOUT\s*=\s*\{[^}]*headerH:\s*(\d+)/, 'exporter headerH'),
    footerH: num(core, /LAYOUT\s*=\s*\{[^}]*footerH:\s*(\d+)/, 'exporter footerH'),
    sceneMargin: num(core, /LAYOUT\s*=\s*\{[^}]*sceneMargin:\s*(\d+)/, 'exporter sceneMargin'),
  };
  for (const k of Object.keys(runtime)) {
    if (runtime[k] == null || exported[k] == null) continue;
    if (runtime[k] !== exported[k]) fail(g, `${k}: runtime ${runtime[k]} vs exporter ${exported[k]} — the preset's sizing package is wrong`);
  }

  // The 5x5 grid shape must match too.
  const gm = grid.match(/GRID_5x5[^}]*reelCount:\s*(\d+)[^}]*visibleRows:\s*(\d+)[^}]*stripLength:\s*(\d+)/s);
  if (gm) {
    const [, reels, rows, strip] = gm.map(Number);
    if (P.grid.reels !== reels) fail(g, `grid.reels ${P.grid.reels} != runtime ${reels}`);
    if (P.grid.rows !== rows) fail(g, `grid.rows ${P.grid.rows} != runtime ${rows}`);
    const stripLen = (P.reelStrips?.[0] ?? []).length;
    if (stripLen % strip !== 0) warn(g, `base strip length ${stripLen} is not a multiple of the runtime stripLength ${strip}`);
  }
  if (!fails.some((f) => f.startsWith(g))) pass(g, 'exporter layout constants match the runtime');
}

// ── 1b. SIZING IS THE *WAYS* BRANCH, NOT THE LINES DEFAULT ─────────────────
// PixiApp picks the fit cap, the game factor and the scene margin by PAY MODEL.
// The export shipped the lines numbers (1.3 / 0.85 / 40) for every game, which
// renders Vice about 13% too small and, on a height-bound pane, blocks the
// enlargement outright.
{
  const g = 'sizing';
  const pixi = src('src/game/PixiApp.ts');
  const grab = (re, what) => { const m = pixi.match(re); if (!m) { fail(g, `could not read ${what} from PixiApp — the gate cannot verify it`); return null; } return Number(m[1]); };
  const waysMargin = grab(/const margin = compact \? \d+ : spays \? \d+ : ways \? (\d+)/, 'the ways scene margin');
  const waysCap = grab(/Math\.min\(scaleX, scaleY, spays \? [\d.]+ : ways \? ([\d.]+)/, 'the ways fit cap');
  const waysFactor = grab(/\(compact \? [\d.]+ : spays \? [\d.]+ : ways \? ([\d.]+)/, 'the ways game factor');
  const eff = P.extras?.sizing?.scaleToFit?.viceEffective;
  if (!eff) fail(g, 'extras.sizing.scaleToFit.viceEffective is missing — the dev has to infer which branch Vice takes');
  else {
    if (waysMargin != null && eff.sceneMargin !== waysMargin) fail(g, `sceneMargin: preset ${eff.sceneMargin} vs runtime ${waysMargin}`);
    if (waysCap != null && eff.cap !== waysCap) fail(g, `fit cap: preset ${eff.cap} vs runtime ${waysCap}`);
    if (waysFactor != null && eff.gameFactor !== waysFactor) fail(g, `gameFactor: preset ${eff.gameFactor} vs runtime ${waysFactor}`);
  }
  if (!fails.some((f) => f.startsWith(g))) pass(g, `ways sizing matches the runtime (cap ${waysCap}, factor ${waysFactor}, margin ${waysMargin})`);
}

// ── 1c. EVERY SHIPPED feature.json PARSES ──────────────────────────────────
{
  const g = 'feature-json';
  const dir = join(HANDOFF, 'features');
  let n = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!name.endsWith('.json')) continue;
      n++;
      try { JSON.parse(readFileSync(p, 'utf8')); }
      catch (e) { fail(g, `${relative(HANDOFF, p).replace(/\\/g, '/')} does not parse — ${String(e.message).slice(0, 80)}`); }
    }
  };
  if (existsSync(dir)) walk(dir);
  if (!fails.some((f) => f.startsWith(g))) pass(g, `${n} feature.json files parse`);
}

// ── 2. MATH BINDINGS RESOLVE ────────────────────────────────────────────────
// A mathBinding naming a key that does not exist tells the dev to implement a
// mechanic we deleted. custom.simulExpandMultipliers shipped like that.
{
  const g = 'math-bindings';
  const manifest = P.math?.manifest ?? {};
  const resolve = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), manifest);
  let checked = 0;
  for (const mech of P.mechanics ?? []) {
    for (const b of mech.mathBinding ?? []) {
      checked++;
      if (resolve(b) === undefined) fail(g, `mechanics[${mech.id}].mathBinding "${b}" does not exist in math.manifest`);
    }
  }
  if (!fails.some((f) => f.startsWith(g))) pass(g, `all ${checked} mathBinding entries resolve`);
}

// ── 3. RETIRED CONTENT ──────────────────────────────────────────────────────
// "es darf nix drin sein außer das richtige."
{
  const g = 'retired';
  // Look for a LIVE reference — a key, or a mathBinding — not for the word.
  // simResults.ruleSet legitimately says "no simulExpandMultipliers", which is a
  // correct negation and must not trip the gate.
  const banned = [
    ['simulExpandMultipliers', 'the retired simultaneous-expansion ladder'],
    ['holdAndWin', 'a Hold & Win bonus Vice never had'],
  ];
  const liveRefs = (needle) => {
    const hits = [];
    const walk = (o, path) => {
      if (o == null || typeof o !== 'object') return;
      for (const k of Object.keys(o)) {
        if (k === needle) hits.push(`${path}.${k}`);
        walk(o[k], `${path}.${k}`);
      }
    };
    walk(P, '');
    for (const mech of P.mechanics ?? []) {
      for (const b of mech.mathBinding ?? []) if (b.includes(needle)) hits.push(`mechanics[${mech.id}].mathBinding "${b}"`);
    }
    return hits;
  };
  for (const [needle, why] of banned) {
    for (const at of liveRefs(needle)) fail(g, `live reference to "${needle}" at ${at} — ${why}`);
  }
  const cap = P.custom?.stickyTowerCap;
  if (cap !== 5) fail(g, `custom.stickyTowerCap is ${cap}, expected 5 (3 and 4 are retired caps; a lower cap makes the full-board instant max win unreachable)`);
  const fullHouse = P.custom?.stickyFullBoardMultiplier;
  if (fullHouse !== 1) fail(g, `custom.stickyFullBoardMultiplier is ${fullHouse}, expected 1 (= OFF, retired)`);
  const boot = P.extras?.presentationTuning?.layout?.bootScreen;
  if (boot && (boot.title || boot.gradient || boot.barGradient)) {
    fail(g, 'extras.presentationTuning.layout.bootScreen still carries the RETIRED per-game boot screen (title/gradient/barGradient) — the loader is universal CHAIN GAMES branding now');
  }
  if (!fails.some((f) => f.startsWith(g))) pass(g, 'no retired mechanic or screen survives in the preset');
}

// ── 4. THE FLAT MATH ROOT AGREES WITH math.manifest ─────────────────────────
// The flat copies are a documented FALLBACK. If they ever disagree they become a
// second, contradictory source of truth.
{
  const g = 'flat-root';
  const keys = ['gridId', 'reelStrips', 'payTable', 'scatterPay', 'freeSpinsCount', 'freeSpinsCap',
    'freeSpinMultiplier', 'retriggerSpins', 'maxWinMultiplier', 'minWager', 'rtpBps',
    'expectedMetrics', 'custom', 'fsReelStrips'];
  for (const k of keys) {
    if (P[k] === undefined) { warn(g, `flat root is missing "${k}" — the D8 safety net does not cover it`); continue; }
    const a = JSON.stringify(P[k]);
    const b = JSON.stringify(P.math?.manifest?.[k]);
    if (a !== b) fail(g, `flat root "${k}" disagrees with math.manifest.${k} — two sources of truth`);
  }
  if (!fails.some((f) => f.startsWith(g))) pass(g, 'flat math root agrees with math.manifest key by key');
}

// ── 5. rtpBps IS THE OPERATIVE NUMBER ───────────────────────────────────────
// The partner assembler recomputes RTP_BPS from expectedMetrics.rtpPct. Seeding
// that from the design target stamped 9600 over the certified value.
{
  const g = 'rtp';
  const bps = P.math?.manifest?.rtpBps;
  const em = P.math?.manifest?.expectedMetrics?.rtpPct;
  if (bps == null) fail(g, 'math.manifest.rtpBps is missing');
  else if (em == null) fail(g, 'math.manifest.expectedMetrics.rtpPct is missing — the assembler will invent one');
  else if (Math.round(em * 100) !== bps) fail(g, `expectedMetrics.rtpPct ${em} recomputes to ${Math.round(em * 100)} bps but rtpBps is ${bps} — the assembler would stamp the wrong RTP`);
  else pass(g, `rtpBps ${bps} and expectedMetrics.rtpPct ${em} agree`);
}

// ── 6. CERTIFICATION NUMBERS DO NOT CONTRADICT EACH OTHER ───────────────────
// The buy stages once claimed 8,000,000-round certifications that never ran,
// while simResults said something else.
{
  const g = 'certification';
  const sim = M.simResults ?? {};
  const stages = M.custom?.viceBuyStages ?? [];
  const bySc = Object.fromEntries(stages.map((s) => [s.scatters, s]));
  const cmp = (label, stage, res) => {
    if (!stage || !res) return;
    if (stage.certifiedRtpPct == null) { warn(g, `${label} stage carries no certifiedRtpPct`); return; }
    const d = Math.abs(stage.certifiedRtpPct - res.rtpPct);
    if (d > 0.5) fail(g, `${label}: buy stage says ${stage.certifiedRtpPct}% but simResults says ${res.rtpPct}% (${d.toFixed(2)}pp apart) — two authoritative numbers for the same thing`);
    if (stage.certifiedRounds != null && res.rounds != null && stage.certifiedRounds > res.rounds * 2) {
      fail(g, `${label}: buy stage claims ${stage.certifiedRounds.toLocaleString()} rounds but the only evidence is ${res.rounds.toLocaleString()}`);
    }
  };
  cmp('buy3', bySc[3], sim.buy3);
  cmp('buy4', bySc[4], sim.buy4);
  const ante = M.custom?.anteBet;
  if (ante && sim.ante && Math.abs(ante.certifiedRtpPct - sim.ante.rtpPct) > 0.5) {
    fail(g, `ante: anteBet says ${ante.certifiedRtpPct}% but simResults says ${sim.ante.rtpPct}%`);
  }
  for (const [mode, r] of Object.entries(sim)) {
    if (r && typeof r === 'object' && r.maxWinCapViolations > 0) fail(g, `${mode}: ${r.maxWinCapViolations} max-win-cap violations`);
  }
  if (!fails.some((f) => f.startsWith(g))) pass(g, 'buy/ante certifications agree with simResults, zero cap violations');
}

// ── 7. ASSETS: EVERY REFERENCE RESOLVES, EVERY FILE IS REFERENCED ───────────
// chain_loader_sheet.webp and wild_multi_sheet.webp were referenced in prose but
// never shipped; win-mega.ogg was referenced and does not exist anywhere.
{
  const g = 'assets';
  const blob = JSON.stringify(P);
  const assetDir = join(HANDOFF, 'assets');
  const onDisk = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else onDisk.push(relative(assetDir, p).replace(/\\/g, '/'));
    }
  };
  if (existsSync(assetDir)) walk(assetDir);

  // Every "theme/..." or "/audio/..." string in the preset must exist on disk.
  const refs = new Set([...blob.matchAll(/"([^"]*(?:theme\/[^"]+\.(?:webp|png)|audio\/[^"]+\.ogg))"/g)].map((m) => m[1]));
  for (const r of refs) {
    const rel = r.replace(/^\/?(?:assets\/)?/, '').replace(/^\//, '');
    if (!onDisk.includes(rel)) fail(g, `the preset references "${r}" but dev-handoff/assets/${rel} does not exist`);
  }
  // And every shipped file should be referenced by something in the package.
  const pkgText = (() => {
    let t = blob;
    const walkDocs = (d) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) { if (n !== 'assets') walkDocs(p); }
        else if (/\.(md|json|txt|mjs|ts)$/.test(n)) t += readFileSync(p, 'utf8');
      }
    };
    walkDocs(HANDOFF);
    return t;
  })();
  for (const f of onDisk) {
    const base = f.split('/').pop();
    if (base === 'README.md') continue;
    if (!pkgText.includes(base)) warn(g, `dev-handoff/assets/${f} is shipped but nothing in the package references it`);
  }
  if (!fails.some((f) => f.startsWith(g))) pass(g, `${refs.size} asset references resolve; ${onDisk.length} files shipped`);
}

// ── 8. AUDIO ───────────────────────────────────────────────────────────────
{
  const g = 'audio';
  const events = P.audio?.events ?? {};
  const audioDir = join(HANDOFF, 'assets', 'audio');
  const have = existsSync(audioDir) ? readdirSync(audioDir) : [];
  let enabled = 0;
  for (const [id, ev] of Object.entries(events)) {
    const on = (ev.volume ?? 0) > 0;
    if (on) enabled++;
    if (on && !ev.file) fail(g, `event "${id}" is enabled (volume ${ev.volume}) but carries no file`);
    if (!on && ev.file) fail(g, `event "${id}" is OFF but still points at "${ev.file}" — a disabled tier must carry file:null so a preloader never chases it`);
    if (ev.file) {
      const base = ev.file.split('/').pop();
      if (!have.includes(base)) fail(g, `event "${id}" -> "${ev.file}" but dev-handoff/assets/audio/${base} does not exist`);
    }
  }
  if (enabled === 0) fail(g, 'no audio event is enabled — the build would ship silent, which is exactly what happened last time');
  const groups = P.audio?.mixing?.exclusiveGroups ?? [];
  const flat = groups.flat();
  for (const id of flat) if (!events[id]) fail(g, `exclusiveGroups names "${id}" which is not an event — the ambient duck would never release`);
  if (!fails.some((f) => f.startsWith(g))) pass(g, `${enabled} events enabled, every file present, duck group resolves`);
}

// ── 8b. THE SHIPPED .ogg BYTES ARE THE ONES THE LIVE BUILD PLAYS ───────────
// The filenames were right for months while the BYTES were two mixes stale —
// the generic dev preset instead of Noski's Vice mix, and a 66 KB sting where
// the marquee plays an 805 KB track. Every other check passed the whole time.
{
  const g = 'audio-bytes';
  try {
    execFileSync(process.execPath, [join(HERE, 'stage_vice_audio.mjs'), '--check'], { stdio: 'pipe' });
    pass(g, 'every shipped .ogg is byte-identical to what the live build resolves');
  } catch (e) {
    const out = String(e.stdout ?? '') + String(e.stderr ?? '');
    const bad = out.split('\n').filter((l) => /DRIFT|ORPHAN|MISSING/.test(l)).map((l) => l.trim());
    for (const l of bad) fail(g, l);
    if (!bad.length) fail(g, 'stage_vice_audio.mjs --check failed; run it for detail');
  }
}

// ── 9. VISUAL PARAMS ARE REAL STUDIO PARAMETERS ────────────────────────────
{
  const g = 'visual-params';
  const adj = src('src/config/adjustableParams.ts');
  const vp = P.visualParams ?? {};
  for (const id of Object.keys(vp)) {
    if (!adj.includes(`id: '${id}'`)) fail(g, `visualParams."${id}" is not a registered studio parameter — the dev cannot look up what it means`);
  }
  if (Object.keys(vp).length === 0) warn(g, 'the preset carries no visualParams at all');
  if (!fails.some((f) => f.startsWith(g))) pass(g, `${Object.keys(vp).length} visual parameters, all registered`);
}

// ── 10. THE FLOW STARTS WITH THE LOADER AND EVERY STAGE IS SPECIFIED ───────
{
  const g = 'flow';
  const stages = P.flow?.stages ?? [];
  if (!stages.length) fail(g, 'flow.stages is empty — the dev has no pipeline to build');
  else if (stages[0].id !== 'boot') fail(g, `flow.stages[0] is "${stages[0].id}", expected "boot" — the loading screen must be first`);
  else if (!stages[0].params?.logo) fail(g, 'the boot stage carries no logo spec — "style: looney-iris"-style naming is not buildable');
  const iris = P.flow?.iris ?? {};
  if (!iris.technique) fail(g, 'flow.iris carries only a style NAME with no technique — the dev build has no transitions precisely because a name is not a spec');
  for (const s of stages) {
    if (s.controlBar === undefined) warn(g, `stage "${s.id}" does not declare controlBar visibility`);
  }
  if (!fails.some((f) => f.startsWith(g))) pass(g, `${stages.length} stages, boot first, iris fully specified`);
}

// ── REPORT ─────────────────────────────────────────────────────────────────
const line = (s) => console.log(s);
line('');
line('VICE HEAT — preset parity gate');
line(`  preset   ${relative(ROOT, PRESET_PATH)}`);
line(`  manifest ${relative(ROOT, MANIFEST_PATH)}`);
line('');
for (const p of passes) line(`  ok    ${p}`);
for (const w of warns) line(`  warn  ${w}`);
for (const f of fails) line(`  FAIL  ${f}`);
line('');
line(`  ${passes.length} passed · ${warns.length} warnings · ${fails.length} failures`);
line('');
if (fails.length) {
  line('  DO NOT SHIP — every failure above is a way the dev rebuilds the wrong game.');
  process.exit(1);
}
line('  Package is internally consistent.');
