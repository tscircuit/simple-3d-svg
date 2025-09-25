# .jegx — Performance & Investigation Artifacts

This folder contains reproducible benchmarks, raw profiles, summaries, and network evidence used to diagnose and improve `@tscircuit/simple-3d-svg`.

## Layout

- `bench/`
  - `bench.ts` — Node runner that renders a scene N times and reports timing + SVG size + element counts.
  - `scene-*.json` — Benchmark scenes (`light`, `heavy`, `heavy-offline`).
  - `out/` — Last-run SVG outputs (visual reference).
- `report/`
  - `REPORT.md` — Full investigation report and conclusions.
  - `PLAN.md` — Implementation plan for perf and SVG-size improvements.
  - `light_bench.json`, `heavy_online_bench.json`, `heavy_offline_bench.json` — Baseline metrics.
  - `profiles/` — Firefox CPU profiles (large JSON; tracked with Git LFS).
  - `node-prof/` — V8 `.cpuprofile` + summarized JSON.
  - `svg/` — Reference SVGs used in the report (LFS).
  - `net_*` — `curl -I` headers and `curl -w` timing proof for OBJ downloads.
  - `system/` — Environment fingerprints (Node, npm, OS, etc).
  - `full-report.tar.gz` — Archive with all raw artifacts (LFS).

## Run the benchmarks

```bash
# Light
npx tsx .jegx/bench/bench.ts .jegx/bench/scene-light.json 50

# Heavy (online, fetches OBJ)
npx tsx .jegx/bench/bench.ts .jegx/bench/scene-heavy.json 20

# Heavy (offline, no network)
npx tsx .jegx/bench/bench.ts .jegx/bench/scene-heavy-offline.json 20

The runner:

    Warm-ups once (to allow any lazy initialization).

    Prints JSON with avgMs, totalMs, sizeBytes, and tag counts.

    Writes the last SVG to .jegx/bench/out/.

Profiling quick-start

    Node (V8): run with --cpu-prof or Chrome DevTools > “Node” target. Save .cpuprofile into .jegx/report/node-prof/, then summarize with the provided script (see REPORT.md).

    Firefox: open about:profiling, record while interacting with the heavy demo, export JSON to .jegx/report/profiles/, then summarize (see REPORT.md).

Git LFS

Large artifacts (profiles, tarball, SVGs under .jegx/report/) are tracked with Git LFS to keep the repository lean. If you clone with --depth=1 or CI, ensure git lfs install && git lfs pull is available.
Safety

All contents here are non-shipping artifacts. They are safe to delete locally and regenerate with the commands above. They do not affect library behavior or public API.
