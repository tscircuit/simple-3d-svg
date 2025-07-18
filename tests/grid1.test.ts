import { test, expect } from "bun:test"
import { renderScene } from "../lib" // same import style as other tests

test("grid plane rendering", async () => {
  const scene = {
    boxes: [
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "gray",
      },
    ],
    camera: { position: { x: 5, y: 5, z: 5 }, lookAt: { x: 0, y: 0, z: 0 } },
  }

  const svg = await renderScene(scene, { showGrid: true }) // enable grid

  // basic sanity check – grid adds light-gray stroke lines
  expect(svg).toContain('stroke="#ccc"')

  // snapshot for full visual regression
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
