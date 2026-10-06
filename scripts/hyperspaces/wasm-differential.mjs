// HyperSpaces: real concurrent WASM documents, published baseline vs patched build.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { LoroDoc: Original } = require(process.argv[2]);
const { LoroDoc: Patched } = require(process.argv[3]);
const seeds = Number(process.argv[4] || 256), steps = Number(process.argv[5] || 200);
let checkpoints = 0;
const bytes = x => Buffer.from(x);
function doc(Codec, peer) {
  const d = new Codec(); d.setPeerId(String(peer)); d.setRecordTimestamp(false);
  d.configTextStyle({ bold: { expand: 'after' } }); return d;
}
function compare(a, b, context) {
  assert.deepEqual(a.toJSON(), b.toJSON(), context);
  assert.deepEqual(a.getText('body').toDelta(), b.getText('body').toDelta(), context);
  for (const mode of ['snapshot', 'update']) {
    assert.deepEqual(bytes(a.export({ mode })), bytes(b.export({ mode })), `${context} ${mode}`);
  }
  assert.deepEqual(bytes(a.version().encode()), bytes(b.version().encode()), `${context} state vector`);
  assert.deepEqual(bytes(a.oplogVersion().encode()), bytes(b.oplogVersion().encode()), `${context} oplog vector`);
  assert.deepEqual(a.frontiers(), b.frontiers(), `${context} frontiers`);
  checkpoints++;
}
for (let seed = 1; seed <= seeds; seed++) {
  let state = BigInt(seed);
  const rng = n => {
    state = BigInt.asUintN(64, state ^ (state << 13n));
    state = BigInt.asUintN(64, state ^ (state >> 7n));
    state = BigInt.asUintN(64, state ^ (state << 17n));
    return Number(state % BigInt(n));
  };
  const corpus = ['a', 'é', '😀', '\n', 'e\u0301', '中'];
  const initial = corpus[rng(6)].repeat([1, 255, 256, 257, 4096, 16384][rng(6)]);
  const pairs = [Original, Patched].map(Codec => {
    const base = doc(Codec, 500); base.getText('body').insert(0, initial); base.commit();
    const snap = base.export({ mode: 'snapshot' }); base.free();
    return [1, 2, 3, 4].map(peer => { const d = doc(Codec, peer); d.import(snap); return d; });
  });
  const queued = [], cuts = [];
  for (let step = 0; step < steps; step++) {
    const i = rng(4), operation = rng(12);
    const text = pairs[0][i].getText('body').toString();
    const positions = [0]; for (const ch of text) positions.push(positions.at(-1) + ch.length);
    const n = positions.length - 1;
    let action;
    if (operation <= 3) {
      const at = positions[rng(n + 1)], s = corpus[rng(6)].repeat([1, 2, 7, 255, 257, 4096][rng(6)]);
      action = d => d.getText('body').insert(at, s);
    } else if ((operation === 4 || operation === 5) && n) {
      const at = rng(n), end = Math.min(n, at + 1 + rng(512));
      action = d => d.getText('body').delete(positions[at], positions[end] - positions[at]);
    } else if (operation === 6 && n) {
      const at = rng(n), end = Math.min(n, at + 1 + rng(512)), marked = rng(2) === 0;
      action = d => marked ? d.getText('body').mark({ start: positions[at], end: positions[end] }, 'bold', true)
        : d.getText('body').unmark({ start: positions[at], end: positions[end] }, 'bold');
    } else if (operation === 7) {
      const key = `k${rng(8)}`; action = d => d.getMap('meta').set(key, step);
    } else if (operation === 8) {
      const n = pairs[0][i].getList('list').length, remove = n > 0 && rng(2) === 0, at = rng(n + (remove ? 0 : 1));
      action = d => remove ? d.getList('list').delete(at, 1) : d.getList('list').insert(at, step);
    } else if (operation === 9) {
      const j = rng(4), delay = rng(3) === 0;
      const updates = pairs.map(ds => ds[j].export({ mode: 'update', from: ds[i].oplogVersion() }));
      if (delay) queued.push({ i, updates });
      else pairs.forEach((ds, v) => { ds[i].import(updates[v]); ds[i].import(updates[v]); });
    } else if (operation === 10 && queued.length) {
      const [{ i, updates }] = queued.splice(rng(queued.length), 1);
      pairs.forEach((ds, v) => ds[i].import(updates[v]));
    } else if (cuts.length) {
      const cut = cuts[rng(cuts.length)];
      pairs.forEach((ds, v) => { try { ds[i].checkout(cut[v]); } catch {} });
      compare(pairs[0][i], pairs[1][i], `${seed}/${step}/checkout`);
      pairs.forEach(ds => ds[i].checkoutToLatest());
    }
    if (action) pairs.forEach(ds => action(ds[i]));
    pairs.forEach(ds => ds[i].commit());
    if (step % 23 === 0) {
      cuts.push(pairs.map(ds => ds[i].frontiers()));
      for (let j = 0; j < 4; j++) compare(pairs[0][j], pairs[1][j], `${seed}/${step}/${j}`);
      // Cross-import both directions, then compare raw exports again.
      const reloads = [doc(Original, 700), doc(Patched, 700)];
      reloads[0].import(pairs[1][i].export({ mode: 'snapshot' }));
      reloads[1].import(pairs[0][i].export({ mode: 'snapshot' }));
      compare(...reloads, `${seed}/${step}/reload`); reloads.forEach(d => d.free());
    }
  }
  queued.forEach(({ i, updates }) => pairs.forEach((ds, v) => ds[i].import(updates[v])));
  pairs.forEach(ds => { const all = ds.map(d => d.export({ mode: 'update' })); ds.forEach(d => {
    [...all].reverse().forEach(b => d.import(b)); all.forEach(b => d.import(b));
  }); });
  for (let j = 0; j < 4; j++) compare(pairs[0][j], pairs[1][j], `${seed}/final/${j}`);
  pairs.flat().forEach(d => d.free());
  if (seed % 8 === 0) globalThis.gc?.();
  if (seed % 16 === 0) console.log(JSON.stringify({ seed, checkpoints }));
}
const result = { seeds, steps, checkpoints, equivalent: true, comparison: 'actual content, rich-text delta, snapshot/update/vector bytes, frontiers and cross-imports' };
writeFileSync(process.env.HYPERSPACES_WASM_FUZZ_RESULT || 'hyperspaces-artifacts/wasm-differential.json', JSON.stringify(result, null, 2));
console.log(result);
