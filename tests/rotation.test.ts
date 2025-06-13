import { test, expect } from "bun:test"
import { renderScene } from "../lib"

const pyramidSTL = `data:text/plain;base64,${btoa(`solid pyramid
facet normal 0.0 0.0 -1.0
  outer loop
    vertex 0.0 0.0 0.0
    vertex 1.0 0.0 0.0
    vertex 0.5 0.866 0.0
  endloop
endfacet
facet normal 0.0 -1.0 0.0
  outer loop
    vertex 0.0 0.0 0.0
    vertex 0.5 0.5 1.0
    vertex 1.0 0.0 0.0
  endloop
endfacet
facet normal 0.866 0.5 0.0
  outer loop
    vertex 1.0 0.0 0.0
    vertex 0.5 0.5 1.0
    vertex 0.5 0.866 0.0
  endloop
endfacet
facet normal -0.866 0.5 0.0
  outer loop
    vertex 0.5 0.866 0.0
    vertex 0.5 0.5 1.0
    vertex 0.0 0.0 0.0
  endloop
endfacet
endsolid pyramid`)}`

const simpleOBJ = `data:text/plain;base64,${btoa(`v -1 -1 0
v 1 -1 0
v 1 1 0
v -1 1 0
f 1 2 3 4
`)}`

test("stl and obj rotation with bounding boxes", async () => {
  const scene = {
    boxes: [
      {
        center: { x: -4, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "orange" as const,
        stlUrl: pyramidSTL,
        stlRotation: { x: Math.PI / 2, y: 0, z: 0 },
        drawBoundingBox: true,
      },
      {
        center: { x: -1, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "orange" as const,
        stlUrl: pyramidSTL,
        drawBoundingBox: true,
      },
      {
        center: { x: 2, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "gray" as const,
        objUrl: simpleOBJ,
        objRotation: { y: Math.PI / 4, x: 0, z: 0 },
        drawBoundingBox: true,
      },
      {
        center: { x: 5, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "gray" as const,
        objUrl: simpleOBJ,
        drawBoundingBox: true,
      },
    ],
    camera: {
      position: { x: 10, y: 10, z: 10 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }

  const svg = await renderScene(scene)
  expect(svg).toContain("<svg")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
