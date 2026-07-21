// Assert: after every tumble step, each cratesAfter cell holds the GIFT (id 0)
// on boardAfter — proves badges pinned to gifts ride the gravity correctly.
import { deriveFruitStacksRound } from '../src/game/fruitStacksSpin.ts';
import manifest from '../src/data/math_fruit_stacks.json' with { type: 'json' };
const CFG = {
  reelStrips: manifest.reelStrips, visibleRows: 5,
  payTiers: Object.fromEntries(Object.entries(manifest.payTable).map(([k, v]) => [Number(k), v])),
  scatterPayBps: manifest.scatterPay, multiWeights: manifest.custom.multiWeights,
  freeSpinsCount: manifest.freeSpinsCount, retriggerSpins: manifest.custom.retriggerSpins,
  freeSpinsCap: manifest.freeSpinsCap, multiPoolCap: manifest.custom.multiPoolCap,
  maxWinMultiplier: manifest.maxWinMultiplier,
};
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const hex = () => '0x' + Array.from({ length: 64 }, () => Math.floor(rnd() * 16).toString(16)).join('');
let checked = 0, bad = 0, stepsWithCrates = 0;
for (let i = 0; i < 5000; i++) {
  const round = deriveFruitStacksRound(hex(), 1000000n, CFG);
  for (const spin of [round.base, ...round.fsSpins]) {
    for (const st of spin.steps) {
      if (st.cratesAfter.length) stepsWithCrates++;
      for (const c of st.cratesAfter) {
        checked++;
        if (st.boardAfter[c.cell[0]][c.cell[1]] !== 0) bad++;
      }
    }
  }
}
console.log('checked ' + checked + ' crate positions across ' + stepsWithCrates + ' steps - mismatches: ' + bad);
process.exit(bad ? 1 : 0);
