import { test, expect } from "bun:test"
import { renderScene } from "lib"
import { CHECKER_10x10, CHECKER_2x2 } from "./fixtures/checkerboard"

test("topimage3", () => {
  const svg = renderScene({
    boxes: [
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "gray",
        faceImages: {
          top: CHECKER_10x10,
        },
        projectionSubdivision: 10,
      },
    ],
    camera: {
      position: { x: 0, y: 1.3, z: 1.3 },
      lookAt: { x: 0, y: -1, z: 0 },
      focalLength: 0.4,
    },
  })

  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
