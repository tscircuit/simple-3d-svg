import { expect, test } from "bun:test"
import { jscadPlanner } from "jscad-planner"
import { loadJscadOperation, renderScene } from "lib"

test("loadJscadOperation evaluates primitive and CSG boolean jscad-planner operations", () => {
  const op = jscadPlanner.booleans.subtract(
    jscadPlanner.primitives.cuboid({ size: [4, 4, 4] }),
    jscadPlanner.primitives.cylinder({ radius: 1, height: 6, resolution: 16 }),
  )

  const mesh = loadJscadOperation(op)
  expect(mesh.triangles.length).toBeGreaterThan(12)
  expect(mesh.boundingBox.min.x).toBeCloseTo(-2, 4)
  expect(mesh.boundingBox.max.x).toBeCloseTo(2, 4)
  expect(mesh.boundingBox.min.y).toBeCloseTo(-2, 4)
  expect(mesh.boundingBox.max.y).toBeCloseTo(2, 4)
  expect(mesh.boundingBox.min.z).toBeCloseTo(-2, 4)
  expect(mesh.boundingBox.max.z).toBeCloseTo(2, 4)
})

test("renderScene renders jscadObjects with CSG boolean operations and optional boxes", async () => {
  const perforatedBlock = jscadPlanner.transforms.translate(
    [0, 0, 6],
    jscadPlanner.booleans.subtract(
      jscadPlanner.primitives.cuboid({ size: [3, 2, 3] }),
      jscadPlanner.transforms.rotateX(
        Math.PI / 2,
        jscadPlanner.primitives.cylinder({
          radius: 0.7,
          height: 4,
          resolution: 16,
        }),
      ),
    ),
  )

  const svg = await renderScene({
    jscadObjects: [
      {
        jscad: perforatedBlock,
        color: "teal",
      },
    ],
    camera: {
      position: { x: 4, y: 4, z: 0 },
      lookAt: { x: 0, y: 0, z: 6 },
    },
  })

  expect(svg).toContain("<svg")
  expect(svg).toContain("<polygon ")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
