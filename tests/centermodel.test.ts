import { test, expect } from "bun:test"
import { renderScene } from "../lib"

const pyramidSTL = `data:text/plain;base64,${btoa(`solid pyramid
facet normal 0 0 -1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0.5 0.866 0
  endloop
endfacet
facet normal 0 -1 0
  outer loop
    vertex 0 0 0
    vertex 0.5 0.5 1
    vertex 1 0 0
  endloop
endfacet
facet normal 0.866 0.5 0
  outer loop
    vertex 1 0 0
    vertex 0.5 0.5 1
    vertex 0.5 0.866 0
  endloop
endfacet
facet normal -0.866 0.5 0
  outer loop
    vertex 0.5 0.866 0
    vertex 0.5 0.5 1
    vertex 0 0 0
  endloop
endfacet
endsolid pyramid`)}`

const simpleOBJ = `data:text/plain;base64,${btoa(`v -1 -1 0
v 1 -1 0
v 1 1 0
v -1 1 0
f 1 2 3 4
`)}`

test("centerModel on STL and OBJ", async () => {
  const scene = {
    boxes: [
      {
        center: { x: -3, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "red" as const,
        stlUrl: pyramidSTL,
        scaleStlToBox: false,
      },
      {
        center: { x: 3, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "blue" as const,
        stlUrl: pyramidSTL,
        scaleStlToBox: false,
        centerModel: false,
      },
      {
        center: { x: -3, y: -4, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "green" as const,
        objUrl: simpleOBJ,
        scaleObjToBox: false,
      },
      {
        center: { x: 3, y: -4, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "orange" as const,
        objUrl: simpleOBJ,
        scaleObjToBox: false,
        centerModel: false,
      },
    ],
    camera: {
      position: { x: 8, y: 8, z: 8 },
      lookAt: { x: 0, y: -2, z: 0 },
    },
  }

  const svg = await renderScene(scene)
  expect(svg).toContain("<svg")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
