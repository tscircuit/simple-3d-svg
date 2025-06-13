import { test, expect } from "bun:test"
import { renderScene } from "../lib"

const coloredOBJ = `data:text/plain;base64,${btoa(`newmtl red\nKd 1 0 0\nendmtl\nnewmtl green\nKd 0 1 0\nendmtl\nv -1 0 0\nv 0 0 0\nv 0 1 0\nv -1 1 0\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nusemtl red\nf 1 3 2\nf 1 4 3\nusemtl green\nf 5 7 6\nf 5 8 7\n`)}`

test("OBJ colors override box color", async () => {
  const scene = {
    boxes: [
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        objUrl: coloredOBJ,
        scaleObjToBox: true,
      },
    ],
    camera: {
      position: { x: 0, y: 0, z: 5 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }

  const svg = await renderScene(scene)
  const fills = Array.from(svg.matchAll(/fill="rgba\(([^)]+)\)"/g)).map(
    (m) => m[1]!,
  )
  const colors = fills.map(
    (f) => f.split(/,\s*/).slice(0, 3).map(Number) as [number, number, number],
  )
  const hasRed = colors.some(([r, g, b]) => r > g && r > b)
  const hasGreen = colors.some(([r, g, b]) => g > r && g > b)
  expect(hasRed && hasGreen).toBe(true)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
