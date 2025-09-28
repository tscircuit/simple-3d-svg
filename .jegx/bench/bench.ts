// Run with:
//   npx tsx .jegx/bench/bench.ts .jegx/bench/scene-light.json 50
//   npx tsx .jegx/bench/bench.ts .jegx/bench/scene-heavy.json 20
//   npx tsx .jegx/bench/bench.ts .jegx/bench/scene-heavy-offline.json 20

import fs from "node:fs"
import { performance } from "node:perf_hooks"
import { renderScene } from "../../lib/index.ts"

function bytesToKB(n: number) {
  return (n / 1024).toFixed(1)
}
function countElements(svg: string) {
  const m = (re: RegExp) => (svg.match(re) || []).length
  return {
    path: m(/<path\b/g),
    rect: m(/<rect\b/g),
    image: m(/<image\b/g),
    text: m(/<text\b/g),
    g: m(/<g\b/g),
    defs: m(/<defs\b/g),
    use: m(/<use\b/g),
  }
}

// Helper: support renderScene sync or async
async function renderToString(scene: unknown): Promise<string> {
  const out = (renderScene as any)(scene)
  return typeof out === "string" ? out : await out
}

async function main() {
  const scenePath = process.argv[2]
  const iterations = Number(process.argv[3] || 10)
  if (!scenePath) {
    console.error(
      "Usage: npx tsx .jegx/bench/bench.ts <scene.json> [iterations]",
    )
    process.exit(1)
  }
  if (!fs.existsSync(scenePath)) {
    console.error("Scene file not found:", scenePath)
    process.exit(1)
  }

  const scene = JSON.parse(fs.readFileSync(scenePath, "utf-8"))

  // Warmup (if objUrl, then it can fetch)
  await renderToString(scene)

  const t0 = performance.now()
  let lastSvg = ""
  for (let i = 0; i < iterations; i++) {
    lastSvg = await renderToString(scene)
  }
  const t1 = performance.now()

  const totalMs = t1 - t0
  const avgMs = totalMs / iterations
  const sizeB = Buffer.byteLength(lastSvg, "utf-8")
  const counts = countElements(lastSvg)

  console.log(
    JSON.stringify(
      {
        node: process.version,
        scenePath,
        iterations,
        totalMs: Number(totalMs.toFixed(2)),
        avgMs: Number(avgMs.toFixed(2)),
        sizeBytes: sizeB,
        sizeKB: Number(bytesToKB(sizeB)),
        counts,
      },
      null,
      2,
    ),
  )

  fs.mkdirSync(".jegx/bench/out", { recursive: true })
  const out = `.jegx/bench/out/${Date.now()}_${scenePath
    .split("/")
    .pop()
    ?.replace(".json", "")}.svg`
  fs.writeFileSync(out, lastSvg)
  console.error("SVG written:", out)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
