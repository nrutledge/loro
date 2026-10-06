// HyperSpaces differential check: compare actual exports, not only hashes.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const [seeds = '1000', steps = '200'] = process.argv.slice(2);
const processes = ['unpatched', 'patched'].map(v => spawn(
  `${process.env.CARGO_TARGET_DIR}/release/loro-${v}-1164-validation`,
  [seeds, steps], { stdio: ['ignore', 'pipe', 'inherit'] }));
const exits = processes.map(p => new Promise(resolve => p.on('exit', resolve)));
const readers = processes.map(p => createInterface({ input: p.stdout })[Symbol.asyncIterator]());
let checkpoints = 0;
try {
  while (true) {
    const rows = await Promise.all(readers.map(r => r.next()));
    assert.equal(rows[0].done, rows[1].done);
    if (rows[0].done) break;
    const values = rows.map(row => JSON.parse(row.value));
    assert.deepEqual(values[0], values[1], `checkpoint ${checkpoints}`);
    for (const key of ['snapshot', 'updates', 'oplog_vv', 'state_vv', 'frontiers']) {
      assert.deepEqual(Buffer.from(values[0][key], 'hex'), Buffer.from(values[1][key], 'hex'));
    }
    checkpoints++;
  }
  assert.deepEqual(await Promise.all(exits), [0, 0]);
  const result = { seeds: Number(seeds), steps: Number(steps), checkpoints, equivalent: true };
  writeFileSync('hyperspaces-artifacts/native-differential.json', JSON.stringify(result, null, 2));
  console.log(result);
} finally { processes.forEach(p => { if (p.exitCode === null) p.kill(); }); }
