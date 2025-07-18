import { test, expect } from "bun:test"
import { renderScene, type Scene } from "../lib"

test("origin lines", async () => {
  const scene: Scene = {
    boxes: [
      {
        center: { x: 7, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        color: "rgba(255,0,0,0.8)",
        topLabel: "X=7",
      },
      {
        center: { x: 0, y: 7, z: 0 },
        size: { x: 1, y: 1, z: 1 },
        topLabel: "Y=7",
        color: "rgba(0,128,255,0.8)",
      },
      {
        center: { x: 0, y: 0, z: 7 },
        size: { x: 1, y: 1, z: 1 },
        topLabel: "Z=7",
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
