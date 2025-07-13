import { test, expect } from "bun:test"
import { renderScene } from "lib"

test("intersecting faces", () => {
  const svg = renderScene({
    boxes: [
      // Red cube
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 4, y: 4, z: 4 },
        color: "rgba(255,0,0,0.7)",
      },
      // Blue cube shifted so the two cubes intersect
      {
        center: { x: 2, y: 2, z: 2 },
        size: { x: 4, y: 2, z: 2 },
        color: "rgba(0,0,255,0.7)",
      },
    ],
    camera: {
      position: { x: 10, y: 6, z: 10 },
      lookAt: { x: 1, y: 0, z: 0 },
    },
  })

  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
