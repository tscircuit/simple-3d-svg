import { expect, test } from "bun:test"
import { renderScene } from "lib"
import { CHECKER_2x2 } from "./fixtures/checkerboard"

test("top face image accepts an encoded png without a data url prefix", async () => {
  const encodedImage = CHECKER_2x2.replace("data:image/png;base64,", "")

  const svg = await renderScene({
    boxes: [
      {
        center: { x: 0, y: 0, z: 5 },
        size: { x: 2, y: 2, z: 2 },
        color: "gray",
        faceImages: {
          top: encodedImage,
        },
      },
    ],
    camera: { position: { x: 0, y: 3, z: 0 }, lookAt: { x: 0, y: 0, z: 5 } },
  })

  expect(svg).toContain(`href="data:image/png;base64,${encodedImage}"`)
})
