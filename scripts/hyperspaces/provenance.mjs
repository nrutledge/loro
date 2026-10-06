// HyperSpaces: stable provenance included in every package.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const run = (command, args) => execFileSync(command, args, {encoding:'utf8'}).trim();
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const data = {
  source_commit: run('git', ['rev-parse', 'HEAD']),
  upstream_commit: '45708d059d8620fb53066c9f86cefa1601e0e1c6',
  rust_image: 'rust@sha256:59037199c44290f2befcdd58dcc540164763fc296950255aaefeef096a1866b0',
  rustc: run('rustc', ['--version']), node: run('node', ['--version']),
  pnpm: run('corepack', ['pnpm', '--version']), deno: run('deno', ['--version']),
  bun: run('bun', ['--version']), wasm_bindgen: run('wasm-bindgen', ['--version']),
  cargo_lock_sha256: hash('Cargo.lock'), pnpm_lock_sha256: hash('pnpm-lock.yaml'),
  tracker_sha256: hash('crates/loro-internal/src/container/richtext/tracker.rs'),
  license: 'MIT', package_version: JSON.parse(readFileSync('crates/loro-wasm/package.json')).version
};
writeFileSync('crates/loro-wasm/BUILD_PROVENANCE.json', JSON.stringify(data, null, 2)+'\n');
