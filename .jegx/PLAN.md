# PLAN.md — Performance & SVG Size Improvements (Issue #56)

**Scope:** Achieve ≥3× interaction speed-up on heavy scenes (with OBJ) and ≥50% SVG size reduction by default (≥70% with feature flags), without breaking the public API or snapshot determinism.

**Modules touched:**

* `lib/loaders/obj.ts` (IO + parsing)
* `lib/mesh.ts`, `lib/geometry.ts`, `lib/vec3.ts` (mesh preparation)
* `lib/render-elements.ts`, `lib/render-svg.ts`, `lib/affine.ts`, `lib/color.ts` (render hot path)
* `lib/types.ts` (new options)
* `examples/dragrotate/*` (demo)
* `tests/*` and new `bench/*`, `scripts/*`

---

## 1) Public API Changes (non-breaking defaults)

### 1.1 New Options

```ts
// lib/types.ts
export interface RenderOptions {
  /** Enables asset preloading before render; defaults to false (no behavior change). */
  preloadAssets?: boolean;

  /** Numeric precision for projected coordinates (0–6). Default: 3. */
  precision?: number;

  /** Style emission: "inline" | "defs" | "hybrid" (default). */
  styleStrategy?: "inline" | "defs" | "hybrid";

  /** If true, prefer <image href="…"> over data: URIs when possible. Default: false. */
  externalImages?: boolean;

  /** Optional image downscaling (applies to face images). */
  imageScale?: number; // 0.0–1.0

  /** Optional quality hint (0–1) for downscaled images. */
  imageQuality?: number;

  /** Optional SVG post-pass hook (e.g., SVGO) to keep zero-dep core. */
  minifySvg?: (svg: string) => string;

  /** Show axes/origin keep existing flags... */
  showAxes?: boolean;
  showOrigin?: boolean;
}
```

> Defaults preserve identical output unless `precision` gets a conservative default of `3`. If strict byte-for-byte snapshots are required, tests can set `precision: 6` to mimic current behavior.

### 1.2 New Public Helpers

```ts
export async function preloadAssets(scene: Scene, options?: RenderOptions): Promise<PreloadReport>;
```

* Preloads all `objUrl` assets and builds multi-level caches so `renderScene(scene)` afterwards is free of I/O and parsing.

---

## 2) Asset Pipeline & Multi-Level Cache

### 2.1 Cache Keys and Stores (in-memory, pluggable later)

```ts
// lib/types.ts
export interface AssetCache {
  bytesByUrl: Map<string, ArrayBuffer>;
  parsedByUrl: Map<string, ParsedObj>;
  triMeshByUrl: Map<string, TriMesh>;
  projectedByKey: Map<string, ProjectedMesh>;
}

// Internal: builds a deterministic key for projection cache.
export function makeProjectionKey(params: {
  url: string; // or "inline:<hash>" if from string
  rotation: Vec3;
  translation: Vec3;
  scale: Vec3;
  focalLength: number;
  projectionSubdivision: number;
}): string;
```

* **Levels:**

  1. `objUrl → ArrayBuffer` (download once, respect `cachebust_origin`)
  2. `ArrayBuffer → ParsedObj`
  3. `ParsedObj → TriMesh` (normals, bounds)
  4. `TriMesh + camera/projection → ProjectedMesh` (if stable between frames)

### 2.2 Preload Flow

```ts
// lib/preload.ts (new)
export async function preloadAssets(scene: Scene, options?: RenderOptions): Promise<PreloadReport> { /* ... */ }
```

* Walk scene; for each `objUrl`:

  * Fetch with `fetch()` once → cache in `bytesByUrl`
  * Parse OBJ → cache in `parsedByUrl`
  * Build `TriMesh` (normals, AABB, optional index buffer) → `triMeshByUrl`
* `renderScene` consults caches; if `preloadAssets` not called, it can **lazily** populate caches (still avoids re-fetch/re-parse within the same session).

### 2.3 Strict Typing + Docstrings Example

```ts
/**
 * Preloads and prepares external assets used by the scene.
 *
 * :param scene: Scene graph containing boxes and external models.
 * :param options: Rendering and asset options.
 * :returns: A detailed report of fetched and prepared assets.
 */
export async function preloadAssets(scene: Scene, options?: RenderOptions): Promise<PreloadReport> { /* ... */ }
```

---

## 3) Geometry Optimizations

### 3.1 Backface Culling (default on)

* In `mesh.ts`, compute per-face normals.
* During projection, skip faces whose normals point away from camera (dot(normal, viewDir) ≥ 0).
* Keep a `culling: "backface" | "none"` option internally, default `"backface"`.

### 3.2 Simple Occlusion Culling (flagged, conservative)

* For large convex parts (boxes, big components), AABB-level test:

  * If a face fully lies behind another face AABB on screen and depth order suggests occlusion, skip emission.
* Off by default; add `occlusion: boolean` (internal for now, we can expose later if safe).

### 3.3 Projection Subdivision Heuristics

* If `projectionSubdivision` > 0, clamp adaptively based on projected size and FOV:

  * For small on-screen areas, reduce subdivision to avoid exploding element counts.

---

## 4) Render Hot-Path Improvements

### 4.1 Fast String Builder

* Replace repeated `+=` with a buffered builder:

```ts
class SvgStringBuilder {
  private readonly chunks: string[] = [];
  append(value: string): void { this.chunks.push(value); }
  toString(): string { return this.chunks.join(""); }
}
```

### 4.2 Fast Number Formatting

* Avoid `toFixed` in tight loops. Implement:

```ts
function formatNumber(value: number, precision: number): string {
  // Specialized fast path for common precisions (2–4), fallback otherwise.
  // Avoid trailing zeros when styleStrategy favors compact output.
  // Keep deterministic rounding.
  return value.toFixed(precision);
}
```

* Wire `precision` default to `3` (configurable).

### 4.3 Deterministic Ordering

* Sort emitted elements deterministically (e.g., by depth then stable tiebreakers).
* Maintain stable IDs/class names for snapshot tests.

---

## 5) SVG Size Reductions

### 5.1 Style Strategy

* **"hybrid" (default):** common attributes consolidated in `<defs>` + classes; rare attributes inline.
* **"inline":** preserves status quo.
* **"defs":** maximize reuse for large scenes.

Implementation: in `render-svg.ts`, gather style signatures → assign class names (`c1`, `c2`, …) → emit once in `<defs>`.

### 5.2 Numeric Precision (default `3`)

* Apply to coordinates and matrix values; ensure camera math uses full precision internally, only **serialization** trims.

### 5.3 Optional Post-Minify Hook

* If `options.minifySvg` is provided, call it before returning the final string.
* Document how to plug SVGO externally (no hard dependency).

### 5.4 External Images (opt-in)

* If `externalImages=true` and the face image source is a URL (not `data:`), emit `<image href="...">` untouched.
* For data URIs, allow optional downscale/quality via canvas (when used in browser) guarded by feature detection; on Node, leave as-is or expose a hook to provide a preprocessed buffer.

---

## 6) Benchmarks & Budgets

### 6.1 Bench Suite

* Keep your current runner (`.jegx/bench/bench.ts`).
* Add two variants per scene:

  * **Cold** (no preload, first render)
  * **Warm** (after `preloadAssets` call)

**Targets (local budgets):**

* Heavy online (warm): **≤ 25 ms** avg on your machine (close to offline).
* Heavy online (cold): dominated by network once, subsequent frames **≤ 25 ms**.

### 6.2 Size Budgets

* Heavy online: default config should reduce SVG by **≥50%** vs baseline (~3.0 MB → ≤1.5 MB).
* With `styleStrategy="defs"` + `minifySvg`: **≥70%** (≤0.9 MB) on the provided repro.

### 6.3 CI Guardrails

* Add a lightweight CI job (bun/node) that:

  * Runs benchmarks once (smaller iterations).
  * Asserts `avgMs` and `sizeBytes` thresholds (allowing headroom).
  * Fails on regressions.

---

## 7) Tests

### 7.1 Unit

* New tests for:

  * `formatNumber` rounding determinism.
  * Projection key stability `makeProjectionKey`.
  * Backface culling correctness on canonical meshes.

### 7.2 Snapshot

* Keep existing snapshots; for any deliberate change (e.g., precision=3 default), add a toggle in tests to set `precision: 6` to preserve current snapshots where necessary.

### 7.3 Visual Tolerance (optional)

* Add a generated PNG comparison test for 2–3 representative scenes (tolerance 0.5–1.0%) to ensure trimming does not introduce visible drift.

---

## 8) Demo & Video (UI bounty)

### 8.1 Demo Script

Create `examples/dragrotate/dragrotate07-preload.page.tsx`:

* Left pane: **baseline** (no preload, default options off).
* Right pane: **optimized** (call `preloadAssets`, `precision=3`, `styleStrategy="hybrid"`).
* Show:

  * ms/frame (RAF timing) overlay,
  * SVG size label (after render),
  * Toggle for `externalImages` and `minifySvg` hook (if user provides one).

### 8.2 Video Outline (30–60 s)

1. Load page, show initial heavy model.
2. Drag baseline (show stutter).
3. Click “Preload + Optimize.”
4. Drag again (smooth), show FPS/ms overlay.
5. Display SVG size A/B.

---

## 9) Implementation Order & Estimates

1. **Caching + Preload** (largest win) — 1–2 days
2. **Backface culling + projection key** — 0.5–1 day
3. **String builder + precision** — 0.5 day
4. **Style dedup ("hybrid")** — 1 day
5. **Optional hooks (minifySvg, externalImages)** — 0.5 day
6. **Benches, budgets, docs, demo, video** — 0.5–1 day

---

## 10) Pull Request Checklist

* [ ] Add `preloadAssets` and caches (with unit tests).
* [ ] Implement backface culling and deterministic ordering.
* [ ] Integrate `precision`, `styleStrategy` ("hybrid" default), and string builder.
* [ ] Provide optional `minifySvg` hook and `externalImages` support.
* [ ] Update `README.md` (new options + examples).
* [ ] Update `examples/dragrotate/*` with new demo page.
* [ ] Add/Adjust benchmarks and CI thresholds.
* [ ] Include `REPORT.md`, `PLAN.md`, bench JSONs, and the demo video.
* [ ] PR body includes: `/claim #56`.

---

## 11) Code Skeletons (strict typing + reST docstrings)

### 11.1 `preloadAssets`

```ts
// lib/preload.ts
import type { Scene, RenderOptions, AssetCache, PreloadReport } from "./types";
import { fetchArrayBuffer } from "./loaders/obj"; // new helper
import { parseObjToStructures, buildTriMesh } from "./mesh";

/**
 * Preloads external assets (OBJ) and prepares mesh caches.
 *
 * :param scene: Scene containing boxes and external models.
 * :param options: Render options controlling preload behavior.
 * :returns: Report with counts and any warnings.
 */
export async function preloadAssets(scene: Scene, options?: RenderOptions): Promise<PreloadReport> {
  const cache = getGlobalCache(); // singleton in-memory
  const urls = collectObjUrls(scene);
  const results: Array<Promise<void>> = [];

  for (const url of urls) {
    results.push((async () => {
      if (!cache.bytesByUrl.has(url)) {
        const bytes = await fetchArrayBuffer(url);
        cache.bytesByUrl.set(url, bytes);
      }
      if (!cache.parsedByUrl.has(url)) {
        const parsed = parseObjToStructures(cache.bytesByUrl.get(url)!);
        cache.parsedByUrl.set(url, parsed);
      }
      if (!cache.triMeshByUrl.has(url)) {
        const tri = buildTriMesh(cache.parsedByUrl.get(url)!);
        cache.triMeshByUrl.set(url, tri);
      }
    })());
  }

  await Promise.all(results);
  return { urlsPreloaded: urls.length };
}
```

### 11.2 Projection Cache Key

```ts
/**
 * Builds a deterministic key for reusing projected meshes.
 *
 * :param url: Source URL (or synthetic ID).
 * :param rotation: Euler radians.
 * :param translation: World translation.
 * :param scale: Scale factors per axis.
 * :param focalLength: Camera focal length.
 * :param projectionSubdivision: Subdivision factor.
 * :returns: Stable string key.
 */
export function makeProjectionKey(params: {
  url: string; rotation: Vec3; translation: Vec3; scale: Vec3;
  focalLength: number; projectionSubdivision: number;
}): string {
  const { url, rotation, translation, scale, focalLength, projectionSubdivision } = params;
  return [
    url,
    rotation.x.toFixed(6), rotation.y.toFixed(6), rotation.z.toFixed(6),
    translation.x.toFixed(6), translation.y.toFixed(6), translation.z.toFixed(6),
    scale.x.toFixed(6), scale.y.toFixed(6), scale.z.toFixed(6),
    focalLength.toFixed(6),
    projectionSubdivision
  ].join("|");
}
```

### 11.3 String Builder in `render-svg.ts`

```ts
/**
 * Serializes the current scene to SVG using a fast builder.
 *
 * :param scene: Scene graph in world coordinates.
 * :param options: Serialization and style options.
 * :returns: SVG string.
 */
export function renderScene(scene: Scene, options?: RenderOptions): string {
  const cfg = withDefaults(options);
  const b = new SvgStringBuilder();

  // emit <svg> header
  b.append(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">`);

  // defs for styles when hybrid/defs
  if (cfg.styleStrategy !== "inline") {
    const defs = computeDefsForScene(scene, cfg);
    if (defs) b.append(`<defs>${defs}</defs>`);
  }

  // project + emit
  emitProjectedScene(b, scene, cfg);

  // close
  b.append(`</svg>`);

  let svg = b.toString();
  if (cfg.minifySvg) svg = cfg.minifySvg(svg);
  return svg;
}
```

---

## 12) Communication (bounty protocol)

**Start working (GitHub comment):**

```
/attempt #56

Plan:
- Add asset preloading with multi-level caches (URL→bytes→ParsedOBJ→TriMesh→ProjectedMesh)
- Backface culling + adaptive subdivision
- Fast SVG serializer (string builder) + numeric precision (default 3)
- Style deduplication with <defs> ("hybrid" default) + optional minify hook
- Benchmarks, budgets, demo page + short video

Expected:
- ≥3× interaction speed-up on heavy scenes (with OBJ)
- ≥50% SVG size reduction by default (≥70% with flags)
```

**Submit PR body:**

* Include `/claim #56`, links to **REPORT.md** and **PLAN.md**, bench JSONs, and the demo video (UI bounty requirement).

