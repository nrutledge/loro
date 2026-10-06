#!/usr/bin/env bash
# HyperSpaces native suite + fixed-seed public document differential replay.
set -euo pipefail
export RUSTUP_TOOLCHAIN=1.99.0
mkdir -p hyperspaces-artifacts scripts/hyperspaces/baseline
cargo test --locked --workspace --features=test_utils,jsonpath --no-fail-fast
# Use the release source already contained in this fork's history.
git archive 45708d059d8620fb53066c9f86cefa1601e0e1c6 | tar -x -C scripts/hyperspaces/baseline
cp Cargo.lock scripts/hyperspaces/baseline/Cargo.lock
export CARGO_TARGET_DIR="$PWD/hyperspaces-target"
for variant in unpatched patched; do
  cargo build --locked --release --manifest-path "scripts/hyperspaces/$variant/Cargo.toml"
done
node scripts/hyperspaces/compare.mjs
