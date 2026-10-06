# HyperSpaces Loro build

MIT: the original LICENSE and copyright notices are retained. This fork is an
independent HyperSpaces build; it does not imply upstream endorsement.

Base: published loro-crdt 1.16.4 gitHead
`45708d059d8620fb53066c9f86cefa1601e0e1c6`; Rust crate versions remain
1.16.2. The server must use this full fork revision, including its in-tree
`generic-btree`, so both runtimes compile identical CRDT sources.

Modified files are listed here and source/build scripts carry HyperSpaces
comments where their format permits. No wire format or admission behavior is
changed by the leaf-remapping patch.

- `crates/loro-internal/src/container/richtext/tracker.rs`: sort/deduplicate
  final leaf remapping entries. Rope mutation has completed before remapping;
  repeated final leaf IDs have the same span and distinct spans are disjoint.
- `crates/loro/tests/hyperspaces_leaf_remap.rs`: real deep-concurrent and
  shallow-checkpoint/large-incoming regression cases, including later edits.
- `crates/loro-wasm/deno.lock`: freeze the build-script dependency graph.
- `Cargo.lock`: record the own-build WASM package version; preserve the
  upstream resolved dependency graph.
- `package.json`: pin pnpm 9.15.9.
- `crates/loro-wasm/Cargo.toml`: match the own-build WASM package version.
- `crates/loro-wasm/package.json`: invoke TypeScript through Corepack; identify
  this build and include fork changes/provenance in the packed MIT package.
- `crates/loro-wasm/scripts/build.ts`: locked Cargo calls, Deno 2 command API,
  fail closed on bindgen failure, local debug-map references, and removal of
  inherited GitHub comment posting. Deno runs use a frozen explicit lock.
- `.gitignore`: ignore generated own-build outputs.
- `.changeset/hyperspaces-leaf-remap.md`: record the behavioral fix.
- `.github/workflows/*`: remove inherited registry/release/sponsor workflows;
  one own-repository CI builds/tests pinned sources and uploads artifacts only.
- `scripts/hyperspaces/*`: pinned tool installation, real API differential
  tests, deterministic package build, provenance and checksum verification.

Release review: Neil reviews the local patch and evidence before integration.
No upstream issue, PR, comment, push or fork-button operation is authorized.
CI is never rerun; a corrected commit gets its own new normal run. No automatic
merge or registry publication is configured.
