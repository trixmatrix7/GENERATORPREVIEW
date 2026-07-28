// Emit the Vice Heat dev preset (chainwtf-game-preset v2) WITHOUT the browser.
//
// The studio's "Export Build" button calls buildExportPreset() in the page. That
// function is pure apart from a handful of localStorage reads, so we bundle it
// for node behind a tiny localStorage/window shim and write the same JSON the
// button would download. Keeps dev-handoff/preset/ reproducible from a command
// instead of a click, so the handoff can never drift from the repo.
//
//   node custom-math/emit_vice_preset.mjs [outPath]

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

// --game=<key> emits any built-in, not just Vice. The other three have no
// handoff folder yet, so they default to scratchpad_presets/ — the point of
// emitting them is to run the same parity gate over their export before their
// packages are built, so they do not repeat Vice's defects.
const GAMES = {
  vice: { grid: '5x5', name: 'Vice Heat', out: join(ROOT, 'dev-handoff', 'preset', 'vice-heat.chainwtf-preset.json') },
  crackfarm: { grid: '5x3', name: 'Crack Farm', out: join(ROOT, 'scratchpad_presets', 'crack-farm.chainwtf-preset.json') },
  fruitstacks: { grid: '6x5', name: 'Fruit Stacks', out: join(ROOT, 'scratchpad_presets', 'fruit-stacks.chainwtf-preset.json') },
  sushi: { grid: '6x6', name: 'Sushi Party', out: join(ROOT, 'scratchpad_presets', 'sushi-party.chainwtf-preset.json') },
};
const gameArg = (process.argv.find((a) => a.startsWith('--game=')) ?? '--game=vice').slice(7);
const GAME = GAMES[gameArg];
if (!GAME) { console.error(`unknown --game=${gameArg}; known: ${Object.keys(GAMES).join(', ')}`); process.exit(2); }
const positional = process.argv.slice(2).find((a) => !a.startsWith('--'));
const OUT = resolve(positional ?? GAME.out);

// The studio reads these; everything else in the export comes from code
// defaults (the live localStorage is empty apart from audio prefs, so a fresh
// visitor and this emitter produce the same file).
const STORE = new Map(Object.entries({
  'active-game': gameArg,
  'studio-grid': GAME.grid,
  'vice:bare': '0',
}));
const localStorage = {
  get length() { return STORE.size; },
  key: (i) => [...STORE.keys()][i] ?? null,
  getItem: (k) => (STORE.has(k) ? STORE.get(k) : null),
  setItem: (k, v) => { STORE.set(k, String(v)); },
  removeItem: (k) => { STORE.delete(k); },
  clear: () => STORE.clear(),
};
globalThis.localStorage = localStorage;
globalThis.window = { localStorage, location: { reload() {} }, matchMedia: () => ({ matches: false }) };
globalThis.document = { documentElement: { style: { setProperty() {} } } };

const tmp = mkdtempSync(join(tmpdir(), 'vicepreset-'));
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, `export { buildExportPreset } from '${join(ROOT, 'src/studio/buildPresets.ts').replace(/\\/g, '/')}';\n`);
const bundle = join(tmp, 'bundle.mjs');
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node',
  outfile: bundle, logLevel: 'warning', loader: { '.json': 'json' },
  alias: { '@': join(ROOT, 'src') },
  // Vite's import.meta.env does not exist under node; the app only reads
  // BASE_URL from it (asset URL prefixes), which is '/' in the shipped build.
  define: { 'import.meta.env.BASE_URL': '"/"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' },
  // Asset imports are URLs at runtime; stub them so the bundle links.
  external: ['*.png', '*.webp', '*.ogg', '*.mp3', '*.wav'],
});

const { buildExportPreset } = await import('file://' + bundle.replace(/\\/g, '/'));
const preset = buildExportPreset(GAME.name);
writeFileSync(OUT, JSON.stringify(preset, null, 2) + '\n');

const vp = preset.visualParams ?? {};
console.log(`wrote ${OUT}`);
console.log(`  schema       ${preset.schema} ${preset.version ?? ''}`);
console.log(`  game/grid    ${preset.game?.key ?? preset.game?.id ?? '?'} / ${preset.gridId ?? '?'}`);
console.log(`  rtpBps       ${preset.rtpBps} (manifest ${preset.math?.manifest?.rtpBps})`);
console.log(`  mechanics    ${(preset.mechanics ?? []).length}`);
console.log(`  visualParams ${Object.keys(vp).length} (${Object.keys(vp).filter((k) => k.startsWith('expandWild')).length} expanded-wild)`);
console.log(`  bytes        ${JSON.stringify(preset).length}`);
