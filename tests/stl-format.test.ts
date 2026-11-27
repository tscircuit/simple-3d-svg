import { expect, test } from "bun:test"
import { loadSTL } from "../lib/loaders/stl"
import type { Triangle } from "../lib/types"

function binarySTL(header: string, triangleCount = 1): string {
  const buffer = new ArrayBuffer(84 + triangleCount * 50)
  new Uint8Array(buffer).set(new TextEncoder().encode(header))
  const view = new DataView(buffer)
  view.setUint32(80, triangleCount, true)
  const triangle = [0, 0, 1, 1, 2, 3, 4, 2, 3, 1, 6, 3]
  for (let i = 0; i < triangleCount; i++) {
    for (let j = 0; j < triangle.length; j++) {
      view.setFloat32(84 + i * 50 + j * 4, triangle[j]!, true)
    }
  }
  return `data:model/stl;base64,${Buffer.from(buffer).toString("base64")}`
}

const expectedTriangle: Triangle = {
  vertices: [
    { x: 1, y: -3, z: 2 },
    { x: 4, y: -3, z: 2 },
    { x: 1, y: -3, z: 6 },
  ],
  normal: { x: 0, y: -1, z: 0 },
}
const expectedBounds = {
  min: { x: 1, y: -3, z: 2 },
  max: { x: 4, y: -3, z: 6 },
}

test("loads a binary STL whose header begins with solid", async () => {
  const mesh = await loadSTL(binarySTL("solid binary model"))
  expect(mesh.triangles).toEqual([expectedTriangle])
  expect(mesh.boundingBox).toEqual(expectedBounds)
})

test("uses the binary triangle count with a solid-prefixed header", async () => {
  const mesh = await loadSTL(binarySTL("solid two triangles", 2))
  expect(mesh.triangles).toEqual([expectedTriangle, expectedTriangle])
  expect(mesh.boundingBox).toEqual(expectedBounds)
})

test("continues to load ordinary binary STL files", async () => {
  const mesh = await loadSTL(binarySTL("Binary model"))
  expect(mesh.triangles).toEqual([expectedTriangle])
  expect(mesh.boundingBox).toEqual(expectedBounds)
})

test("continues to load ASCII STL files longer than a binary header", async () => {
  const text = `solid ascii
facet normal 0 0 1
  outer loop
    vertex 1 2 3
    vertex 4 2 3
    vertex 1 6 3
  endloop
endfacet
endsolid ascii
`
  const mesh = await loadSTL(`data:model/stl,${encodeURIComponent(text)}`)
  expect(mesh.triangles).toEqual([expectedTriangle])
  expect(mesh.boundingBox).toEqual(expectedBounds)
})

test("does not read a binary triangle count from a short ASCII STL", async () => {
  const mesh = await loadSTL("data:model/stl,solid%20empty%0Aendsolid%20empty")
  expect(mesh.triangles).toEqual([])
  expect(mesh.boundingBox).toEqual({
    min: { x: 0, y: 0, z: 0 },
    max: { x: 0, y: 0, z: 0 },
  })
})

test("keeps an exact zero-face binary empty with an ASCII facet in its header", async () => {
  const header =
    "solid\nfacet normal 2 3 6\nvertex -7 2 1\nvertex 3 -4 -5\nvertex 0 9 2.5\nendfacet"
  const mesh = await loadSTL(binarySTL(header, 0))
  expect(mesh).toEqual({
    triangles: [],
    boundingBox: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    },
  })
})

test("preserves ASCII fallback for solid binary with one trailing byte", async () => {
  const url = binarySTL("solid trailing byte")
  const bytes = Buffer.from(url.split(",")[1]!, "base64")
  const withTrailingByte = Buffer.concat([bytes, Buffer.from([0])])
  const mesh = await loadSTL(
    `data:model/stl;base64,${withTrailingByte.toString("base64")}`,
  )
  expect(mesh).toEqual({
    triangles: [],
    boundingBox: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    },
  })
})
