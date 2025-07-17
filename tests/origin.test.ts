import { test, expect } from "bun:test"
import { renderScene, type Scene } from "../lib"

test("origin lines", async () => {
  const scene: Scene = {
    boxes: [
      {
        center: { x: 5, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        color: "rgba(255,0,0,0.8)",
        topLabel: "X=5",
      },
      {
        center: { x: 0, y: 5, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        topLabel: "Y=5",
        color: "rgba(0,128,255,0.8)",
      },
      {
        center: { x: 0, y: 0, z: 5 },
        size: { x: 1, y: 1, z: 1 },
        topLabel: "Z=5",
        color: "rgba(255,128,0,0.8)",
      },
    ],
    camera: {
      position: { x: -10, y: 10, z: -10 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }
  const svg = await renderScene(scene, {
    showOrigin: true,
    showGrid: true,
    grid: {
      plane: "xz",
    },
    backgroundColor: "white",
  })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
