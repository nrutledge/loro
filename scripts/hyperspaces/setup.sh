#!/usr/bin/env bash
# HyperSpaces pinned build tools; run inside the recorded Rust image.
set -euo pipefail
export RUSTUP_TOOLCHAIN=1.99.0
[[ "$(node --version)" == v22.23.3 ]]
[[ "$(rustc --version)" == 'rustc 1.99.0 (b940084d7 2026-09-28)' ]]
root=$(pwd)
# The canonical container path can have a different filesystem owner.
git config --global --add safe.directory "$root"
mkdir -p .hyperspaces-tools
cp scripts/hyperspaces/tools.package.json .hyperspaces-tools/package.json
cp scripts/hyperspaces/tools.pnpm-lock.yaml .hyperspaces-tools/pnpm-lock.yaml
corepack pnpm@9.15.9 install --dir .hyperspaces-tools --ignore-workspace --frozen-lockfile
export PATH="$root/.hyperspaces-tools/node_modules/.bin:$root/.hyperspaces-tools/bin:$PATH"
rustup target add wasm32-unknown-unknown
cargo install --locked --root .hyperspaces-tools --version 0.2.100 wasm-bindgen-cli
corepack pnpm install --frozen-lockfile
if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "PATH=$PATH" >> "$GITHUB_ENV"
  echo "RUSTUP_TOOLCHAIN=$RUSTUP_TOOLCHAIN" >> "$GITHUB_ENV"
fi
