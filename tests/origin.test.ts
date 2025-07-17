import { test, expect } from "bun:test"
import { renderScene } from "../lib"

test("origin lines", () => {
  const scene = {
    boxes: [
      {
        center: { x: -1, y: 0, z: 6 },
        size: { x: 2, y: 2, z: 2 },
        color: "rgba(255,0,0,0.8)",
      },
      {
        center: { x: 2, y: 0, z: 8 },
        size: { x: 2, y: 2, z: 2 },
        color: "rgba(0,128,255,0.8)",
      },
    ],
    camera: {
      position: { x: 12, y: 12, z: 12 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }
  const svg = renderScene(scene, {
    showOrigin: true,
    showGrid: true,
    backgroundColor: "white",
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
