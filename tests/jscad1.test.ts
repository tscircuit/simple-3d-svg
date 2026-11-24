import { expect, test } from "bun:test"
import { convertJscadOperationToMesh, renderScene } from "../lib"

test("renders jscad-planner CSG objects with scene colors and snapshot", async () => {
  const svg = await renderScene({
    boxes: [
      {
        center: { x: 0, y: -1.4, z: 0 },
        size: { x: 6, y: 0.4, z: 6 },
        color: "#2e7d32",
      },
    ],
    jscadObjects: [
      {
        color: "#3b82f6",
        jscad: {
          type: "subtract",
          shapes: [
            { type: "cube", size: 2.2, center: [-1.1, 0, 0] },
            {
              type: "cylinder",
              radius: 0.65,
              height: 3,
              center: [-1.1, 0, 0],
              resolution: 16,
            },
          ],
        },
      },
      {
        color: "#f59e0b",
        jscad: {
          type: "translate",
          vector: [1.5, 0, 0],
          shape: {
            type: "sphere",
            radius: 1,
            resolution: 14,
          },
        },
      },
    ],
    camera: {
      position: { x: 5, y: 4.5, z: 6.5 },
      lookAt: { x: 0, y: -0.2, z: 0 },
    },
  })

  expect(svg).toContain("<svg")
  expect(svg).toContain("<polygon")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("supports jscadObjects without boxes and respects colorize fallback", async () => {
  const mesh = convertJscadOperationToMesh({
    type: "colorize",
    color: [1, 0, 0],
    shape: { type: "cuboid", size: [2, 2, 2] },
  })
  expect(mesh.triangles.length).toBeGreaterThanOrEqual(12)
  expect(mesh.triangles[0]?.color).toEqual([255, 0, 0, 1])

  const svgFromColorize = await renderScene({
    jscadObjects: [
      {
        color: "gray",
        jscad: {
          type: "colorize",
          color: [1, 0, 0],
          shape: { type: "cuboid", size: [2, 2, 2] },
        },
      },
    ],
    camera: {
      position: { x: 4, y: 4, z: 4 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  })
  expect(svgFromColorize).toMatch(/fill="rgba\(255,\d+,\d+,1\)"/)
})
