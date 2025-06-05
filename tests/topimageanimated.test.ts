import { test, expect } from "bun:test"
import { renderScene } from "lib"
import { CHECKER_10x10, CHECKER_2x2 } from "./fixtures/checkerboard"

test.skip("topimage4", async () => {
  for (let i = 0; i < 11; i++) {
    const svg = await renderScene({
      boxes: [
        {
          center: { x: 0, y: 0, z: 0 },
          size: { x: 2, y: 2, z: 2 },
          color: "red",
          faceImages: {
            top: CHECKER_10x10,
          },
          projectionSubdivision: i,
        },
      ],
      camera: {
        position: { x: -1, y: 1.3, z: 1.3 },
        lookAt: { x: 0, y: -1, z: 0 },
        focalLength: 0.4,
      },
    })

    Bun.write(`topimage4-${i}.svg`, svg)
  }
})
