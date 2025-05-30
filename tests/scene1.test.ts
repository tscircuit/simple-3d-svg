import { test, expect } from "bun:test"
import { renderScene } from "lib"

test("scene1", async () => {
  const svg = await renderScene({
    boxes: [
      {
        center: { x: -1.5, y: 0, z: 6 },
        topLabel: "Hello World",
        topLabelColor: "white",
        size: { x: 2, y: 2, z: 2 },
        color: "rgba(255, 0, 0, 0.9)",
      },
      {
        center: { x: 1.5, y: 0, z: 8 },
        size: { x: 2, y: 2, z: 2 },
        color: [0, 128, 255, 0.9],
      },
    ],
    camera: { position: { x: -3, y: 4, z: 0 }, lookAt: { x: 0, y: 0, z: 6 } },
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
