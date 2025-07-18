import { test, expect } from "bun:test"
import { renderScene } from "../lib"

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
    position: { x: -5, y: 5, z: 5 },
    lookAt: { x: 0, y: 0, z: 6 },
  },
}

test("axes guide from left", () => {
  const svg = renderScene(scene, { showAxes: true })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
