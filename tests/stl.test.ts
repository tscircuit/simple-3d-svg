import { test, expect } from "bun:test"
import { renderScene } from "lib"

const stl = `solid test
facet normal 0 0 1
 outer loop
  vertex -0.5 -0.5 0
  vertex 0.5 -0.5 0
  vertex 0.5 0.5 0
 endloop
endfacet
facet normal 0 0 1
 outer loop
  vertex -0.5 -0.5 0
  vertex 0.5 0.5 0
  vertex -0.5 0.5 0
 endloop
endfacet
facet normal 0 0 1
 outer loop
  vertex -0.5 -0.5 0
  vertex 0 0 1
  vertex 0.5 -0.5 0
 endloop
endfacet
facet normal 0 0 1
 outer loop
  vertex 0.5 -0.5 0
  vertex 0 0 1
  vertex 0.5 0.5 0
 endloop
endfacet
facet normal 0 0 1
 outer loop
  vertex 0.5 0.5 0
  vertex 0 0 1
  vertex -0.5 0.5 0
 endloop
endfacet
facet normal 0 0 1
 outer loop
  vertex -0.5 0.5 0
  vertex 0 0 1
  vertex -0.5 -0.5 0
 endloop
endfacet
endsolid test
`

const dataUrl = "data:model/stl;base64," + Buffer.from(stl).toString("base64")

test("render stl", async () => {
  const svg = await renderScene({
    boxes: [
      {
        center: { x: 0, y: 0, z: 6 },
        size: { x: 2, y: 2, z: 2 },
        color: "rgba(200,0,0,0.8)",
        stlUrl: dataUrl,
      },
    ],
    camera: { position: { x: 0, y: 3, z: 0 }, lookAt: { x: 0, y: 0, z: 6 } },
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
