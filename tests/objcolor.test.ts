import { test, expect } from "bun:test"
import { renderScene } from "../lib"

const coloredOBJ = `data:text/plain;base64,${btoa(`newmtl red\nKd 1 0 0\nendmtl\nnewmtl green\nKd 0 1 0\nendmtl\nv -1 0 0\nv 0 0 0\nv 0 1 0\nv -1 1 0\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nusemtl red\nf 1 3 2\nf 1 4 3\nf 2 3 1\nf 3 4 1\nusemtl green\nf 5 7 6\nf 5 8 7\nf 6 7 5\nf 7 8 5\n`)}`

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
  const fills = Array.from(svg.matchAll(/fill="([^"]+)"/g)).map((m) => m[1]!)
  const toRGB = (value: string): [number, number, number] => {
    if (value.startsWith("#")) {
      if (value.length === 7) {
        const r = parseInt(value.slice(1, 3), 16)
        const g = parseInt(value.slice(3, 5), 16)
        const b = parseInt(value.slice(5, 7), 16)
        return [r, g, b]
      }
      if (value.length === 4) {
        const r = parseInt(value[1] + value[1], 16)
        const g = parseInt(value[2] + value[2], 16)
        const b = parseInt(value[3] + value[3], 16)
        return [r, g, b]
      }
      return [0, 0, 0]
    }
    const rgbaMatch = value.match(/^rgba?\(([^)]+)\)$/)
    if (rgbaMatch) {
      const [r = 0, g = 0, b = 0] = rgbaMatch[1]!
        .split(/,\s*/)
        .map(Number)
      return [r, g, b]
    }
    return [0, 0, 0]
  }
  const colors = fills.map(toRGB)
  const hasRed = colors.some(([r, g, b]) => r > g && r > b)
  const hasGreen = colors.some(([r, g, b]) => g > r && g > b)
  expect(hasRed && hasGreen).toBe(true)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
