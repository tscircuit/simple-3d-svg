import { test, expect } from "bun:test"
import { renderScene } from "lib"

test("top image", () => {
  const svg = renderScene({
    boxes: [
      {
        center: { x: 0, y: 0, z: 5 },
        size: { x: 2, y: 2, z: 2 },
        color: "gray",
        faceImages: {
          top: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        },
      },
    ],
    camera: { position: { x: 0, y: 3, z: 0 }, lookAt: { x: 0, y: 0, z: 5 } },
  })

  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
