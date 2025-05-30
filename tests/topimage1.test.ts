import { test, expect } from "bun:test"
import { renderScene } from "lib"
import { CHECKER_2x2 } from "./fixtures/checkerboard"

test("topimage1", () => {
  const svg = renderScene({
    boxes: [
      {
        center: { x: 0, y: 0, z: 5 },
        size: { x: 2, y: 2, z: 2 },
        color: "gray",
        faceImages: {
          top: CHECKER_2x2,
        },
      },
    ],
    camera: { position: { x: 0, y: 3, z: 0 }, lookAt: { x: 0, y: 0, z: 5 } },
  })

  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
