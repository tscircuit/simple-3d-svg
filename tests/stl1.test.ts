import { test, expect } from "bun:test"
import { renderScene } from "../lib"

// Simple ASCII STL data URL for a pyramid
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

test("STL rendering", async () => {
  const scene = {
    boxes: [
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "red" as const,
        stlUrl: pyramidSTL,
      },
    ],
    camera: {
      position: { x: 5, y: 5, z: 5 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }

  const svg = await renderScene(scene)
  expect(svg).toContain("<svg")
  expect(svg).toContain("</svg>")
  expect(svg).toContain("polygon")

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
