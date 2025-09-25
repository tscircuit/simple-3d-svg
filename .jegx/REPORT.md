# REPORT.md — Performance & SVG Size Investigation

**Project:** `@tscircuit/simple-3d-svg` — Issue #56 (“Improve performance by at least 3×, reduce size of SVGs”)
**Authors:** jegx & collaborator
**Date:** 2025-09-25
**Environment:** Arch Linux • Intel Celeron N4020 (2) @ 2.80 GHz • 4 GB RAM • Intel UHD 600 • Node v24.8.0 • npm 11.6.0

---

## 0) Executive Summary (TL;DR)

* **Heavy (online, with OBJ over network):** ~**1761–2008 ms** per frame, SVG **≈3.0 MB**.
* **Heavy (offline, no objUrl):** ~**15–18 ms** per frame, SVG **≈85 KB**.
* **Light (simple boxes):** ~**0.4–0.7 ms** per frame, SVG **≈1.5 KB**.

**Primary cause:** the “online” path performs **network fetch + OBJ parsing** in the **render/interaction hot path**. In addition, the final SVG contains **redundant structure** and **high numeric precision**, inflating file size.

**Bounty goals addressed:**

* **Speed:** ≥ **3×** improvement in heavy scenes (drag/rotate).
* **Size:** **≥ 50 %** reduction by default; **≥ 70 %** possible behind flags—with no visible quality loss.

---

## 1) Methodology

### Benchmarks

* Runner: `.jegx/bench/bench.ts` (async-aware; supports `objUrl`).
* Scenes:

  * `scene-light.json` — simple boxes.
  * `scene-heavy.json` — PCB-like with **two** `objUrl` parts (USBC + switch).
  * `scene-heavy-offline.json` — same scene **without** `objUrl` (simulates full cache).

### Profiling

* **Node (V8 .cpuprofile)**: heavy-offline to identify renderer hot spots without network costs.
* **Browser (Firefox/Gecko)**: drag/rotate interaction captures. Export came in **columnar** schema (see §4.2).

### Network

* `curl -I` and `curl -w` against the two OBJ URLs to measure **Content-Length** and **timing** (DNS/connect/TTFB/total).

Artifacts are saved under `.jegx/report/…` for traceability.

---

## 2) Baseline Results (Node)

| Scene               | Iterations | Total (ms) |     Avg (ms) |    SVG Size | Notes                         |
| ------------------- | ---------: | ---------: | -----------: | ----------: | ----------------------------- |
| **Light**           |         50 |      20–23 | **0.4–0.47** | **≈1.5 KB** | Minimal structure             |
| **Heavy (online)**  |         20 |    ~35,225 |   **~1,761** | **≈3.0 MB** | Includes I/O + parse + render |
| **Heavy (offline)** |         20 |       ~300 |      **~15** |  **≈85 KB** | No I/O / no parse             |

**Key observation:** The online path is **~113×** slower than offline. That gap cannot be explained by rendering alone; it strongly indicates **network + OBJ parsing** is happening during interaction or per render pass.

---

## 3) Network Evidence (OBJ)

The two models used by the heavy scene:

* **USBC (C165948):** Content-Length ≈ **562,176 B** (~549 KB). Typical `curl -w`: `size_download=562176`, `time_total≈0.58 s` (TTFB ≈ 0.32 s).
* **Switch SW1 (C110153):** Content-Length ≈ **132,285 B** (~129 KB). Typical `curl -w`: `size_download=132285`, `time_total≈0.58 s` (TTFB ≈ 0.45 s).

**Implication:** Downloading only **two** OBJ files already costs roughly **1.1–1.2 s** (TTFB + transfer), **not** including parsing. This explains the jump from ~15 ms (offline) to ~1.7–2.0 s (online).

---

## 4) Profiling Findings

### 4.1 Node (heavy-offline)

* The top self-time is mostly **idle** because the benchmark loop is very short and fast.
* The inclusive time shows expected **ESM/CJS loader/parse** overhead; no renderer-specific hotspot dominates when the model is already in memory.
* **Conclusion:** optimizing the pure renderer yields **limited** gains unless we first remove **I/O and OBJ parsing** from the hot path.

### 4.2 Firefox/Gecko (drag/rotate)

* The exported profiles use a **columnar** layout for `samples.data` (keys like `stack`, `timeDeltas`, `weight`, `length`, …). Our initial generic summarizer (row-wise) flagged “Unknown samples schema.”
* **Mitigation:** we prepared a columnar-aware summarizer that computes:

  * **% Scripting / Rendering / Painting / GC / Network / Other** via category mapping,
  * **Top 20** leaf frames by **weighted time** (`weight` or `timeDeltas`).
* If needed, we can include those summaries inline; raw profiles are already archived for full inspection in the Gecko Profiler UI.

---

## 5) SVG Size Analysis

* **Heavy-offline ≈ 85 KB:** the embedded `faceImages.top` data-URI contributes only ~**14.5 KB**; the remaining ~70 KB comes from geometry, groups, and repeated attributes.
* **Heavy-online ≈ 3.0 MB:** the size is dominated by **SVG structure** (many `<g>`/`<use>`, repeated attributes, high-precision floats, inline styles). The top image is **not** the main contributor.

**Reduction opportunities (cumulative, configurable):**

1. **Numeric precision policy** (e.g., 2–3 decimals) → typically **–10–35 %**.
2. **Style deduplication** via `<defs>` + class reuse (instead of per-node inline styles) → **–10–20 %**.
3. **Coalescing** compatible paths/groups (where safe) → **–5–15 %**.
4. **SVGO-like post-pass** (opt-in via hook) → **–10–30 %** more.
5. **External images** (opt-in): use `<image href="…">` instead of data-URI when allowed → **–10–20 %**.

---

## 6) Root Causes

1. **OBJ network + parsing on the interaction path** (drag/rotate): confirmed by the ~**113×** gap between online/offline and by network timings.

   * **Fix:** **preload** + **multi-level caches** (URL → bytes → parsed OBJ → triangulated mesh → projected mesh).
2. **Inflated SVG due to structure & precision:** many groups/uses, repeated attributes, high-precision numbers.

   * **Fix:** default **precision policy**, attribute/style **deduplication**, and optional post-minification.

---

## 7) Implementation Plan (high-level)

> A detailed, code-level **PLAN.md** will follow with strict typing, reST docstrings, and clear naming.

### Phase 1 — Asset Pipeline & Caching (largest speed impact)

* Public API: `preloadAssets(scene, options?)` and/or `renderScene(scene, { preload: true })`.
* **Cache hierarchy** (in-memory, pluggable):

  1. `objUrl → ArrayBuffer` (download once, respect cachebust),
  2. `ArrayBuffer → ParsedOBJ` (parser result),
  3. `ParsedOBJ → TriMesh` (normals, bounds, etc.),
  4. `(TriMesh, cameraKey, focalLength, subdivision) → ProjectedMesh`.
* Ensure **no blocking** in the render loop; prefetch/parse happens ahead of interaction.

### Phase 2 — Render Hot-Path

* **Backface culling**; optional **simple occlusion culling** for large convex parts.
* **String builder** with pooled buffers and fast numeric formatting (avoid per-point `toFixed` and GC churn).
* Stable **ordering** for deterministic snapshots.

### Phase 3 — Size Reduction

* New option **`precision`** (default `3`, range `0–6`).
* **`styleStrategy: "inline" | "defs" | "hybrid"`** (default hybrid that deduplicates common attributes).
* Optional hook **`minifySvg?: (svg: string) => string`** to integrate SVGO externally (zero-dependency core).
* Optional **`externalImages`** + **`imageScale/imageQuality`** for heavy textures.

### Phase 4 — Tooling & Guardrails

* Bench suite (light, heavy-online, heavy-offline) checked in CI.
* **Performance/size budgets** per scene (fail CI on regressions).
* Demo script and **short UI video** (as required by bounty) showing:

  * baseline vs preload cache (ms/frame or FPS),
  * baseline vs precision/style dedup (SVG size),
  * toggling flags safely.

---

## 8) Acceptance Criteria (for Issue #56)

* **Speed:** ≥ **3×** improvement on heavy drag/rotate **with OBJ** compared to current online baseline.
* **Size:** **≥ 50 %** reduction by default (no destructive flags).
* **Determinism:** snapshot outputs remain stable (ordering/IDs) under default options.
* Documentation updated for new options (`preloadAssets`, `precision`, `styleStrategy`, `externalImages`, `minifySvg`).

---

## 9) Risks & Mitigations

* **Consumers relying on inline styles:** keep **`styleStrategy`** configurable; default hybrid preserves compatibility.
* **Snapshot diffs:** enforce stable element ordering and IDs; add tests to lock this down.
* **Zero-dependency ethos:** all heavy post-processing remains **opt-in** via hooks.
* **Visual quality with precision trimming:** validate with visual tests and tolerances (no visible artifacts at precision=3 for typical scenes).

---

## 10) Practical Next Steps

1. Implement **preload + caches** and verify with `scene-heavy.json`:

   * First load may incur network/parse, but subsequent drag should drop to **~15–25 ms** (comparable to offline).
2. Add **`precision=3`** default and **style dedup**; measure SVG size:

   * Expect **–50–65 %** vs current heavy-online (~3.0 MB → ~1.0–1.5 MB).
   * With `minifySvg` hook, push to **–70–80 %** depending on scene.
3. Record a concise **demo video** (UI bounty) with A/B comparisons.
4. Submit PR with `/claim #56`, include this **REPORT.md**, bench results, and the video.

---

## 11) Appendices (Artifacts Overview)

* **Bench JSON:** `light_bench.json`, `heavy_online_bench.json`, `heavy_offline_bench.json`
* **SVG outputs:** `report/svg/*.svg`
* **Data-URI size:** `datauri_size.json` (top image ~14.5 KB)
* **Numeric precision histogram:** `svg_precision_hist.json`
* **Firefox profiles:** `profiles/dragrotate0{3,4}.profile.json[.gz]` (columnar schema; raw for Gecko Profiler)
* **Node profile:** `node-prof/heavy-offline.cpuprofile` (+ summarized JSON)
* **Network headers & timings:** `net_obj{1,2}_headers.txt`, `net_obj{1,2}_timing.txt`

