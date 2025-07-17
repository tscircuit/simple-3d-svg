import { test, expect } from "bun:test"
import { renderScene } from "../lib"

test("axes guide", () => {
  const scene = {
    boxes: [],
    camera: {
      position: { x: 5, y: 5, z: 5 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }
  const svg = renderScene(scene, { showAxes: true })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
