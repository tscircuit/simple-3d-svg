import { test, expect } from "bun:test"
import { renderScene } from "lib"

test("jscadObjects cuboid produces shaded polygons", async () => {
  const svg = await renderScene({
    boxes: [],
    jscadObjects: [
      {
        jscad: {
          type: "cuboid",
          size: [2, 2, 2],
        },
        color: "rgba(255, 0, 0, 0.9)",
      },
    ],
    camera: { position: { x: -3, y: 4, z: 6 }, lookAt: { x: 0, y: 0, z: 0 } },
  })

  expect(svg).toContain("<svg")
  expect(svg).toContain("</svg>")
  expect(svg).toContain("<polygon")
  expect((svg.match(/<polygon/g) ?? []).length).toBeGreaterThanOrEqual(6)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("jscadObjects subtract of translated cuboids uses jscad-planner", async () => {
  const svg = await renderScene({
    boxes: [],
    jscadObjects: [
      {
        jscad: {
          type: "subtract",
          shapes: [
            { type: "cuboid", size: [2, 2, 2] },
            {
              type: "translate",
              vector: [1, 0.6, 0.6],
              shape: { type: "cuboid", size: [2, 2, 2] },
            },
          ],
        },
        color: "#4682b4",
      },
    ],
    camera: {
      position: { x: -4, y: 5, z: 8 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  })

  expect(svg).toContain("<polygon")
  expect((svg.match(/<polygon/g) ?? []).length).toBeGreaterThan(12)
  await expect(svg).toMatchSvgSnapshot(import.meta.path, "subtract")
})
