#!/usr/bin/env bash
# HyperSpaces: deterministic own-build package, no publishing.
set -euo pipefail
root=$(pwd)
export RUSTUP_TOOLCHAIN=1.99.0
export CARGO_TARGET_DIR="$root/target"
mkdir -p hyperspaces-artifacts
cp FORK_CHANGES.md crates/loro-wasm/FORK_CHANGES.md
node scripts/hyperspaces/provenance.mjs
for round in 1 2; do
  if [[ "$round" == 2 ]]; then cargo clean --target wasm32-unknown-unknown; fi
  corepack pnpm -C crates/loro-wasm build-release
  mkdir -p "hyperspaces-artifacts/round-$round"
  corepack pnpm -C crates/loro-wasm pack --pack-destination "$root/hyperspaces-artifacts/round-$round"
done
first=$(find hyperspaces-artifacts/round-1 -name '*.tgz' -type f)
second=$(find hyperspaces-artifacts/round-2 -name '*.tgz' -type f)
cmp "$first" "$second"
cp "$first" hyperspaces-artifacts/
cp crates/loro-wasm/BUILD_PROVENANCE.json hyperspaces-artifacts/
sha256sum hyperspaces-artifacts/*.tgz > hyperspaces-artifacts/SHA256SUMS
HYPERSPACES_WASM_FUZZ_RESULT="$root/hyperspaces-artifacts/wasm-differential.json" node --expose-gc scripts/hyperspaces/wasm-differential.mjs \
  "$root/.hyperspaces-tools/node_modules/loro-unpatched" "$root/crates/loro-wasm/nodejs/index.js"
