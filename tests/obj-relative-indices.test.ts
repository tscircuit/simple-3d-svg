import { expect, test } from "bun:test"
import { loadOBJ, renderScene, type Scene } from "../lib"

const asUrl = (obj: string) => `data:text/plain,${encodeURIComponent(obj)}`

const vertices = `v 0 0 0
v 2 0 0
v 2 2 0
v 0 2 0
`

test("relative face vertices match positive indices when normals are omitted", async () => {
  const absolute = await loadOBJ(asUrl(`${vertices}f 1 2 3 4`))
  const relative = await loadOBJ(asUrl(`${vertices}f -4 -3 -2 -1`))
  expect(relative).toEqual(absolute)
  expect(relative.triangles).toHaveLength(2)
})

test("relative normals use their own list length, independently of vertices", async () => {
  const obj = `${vertices}vt 0 0
vt 1 0
vn 0 1 0
vn 0 0 1
`
  const absolute = await loadOBJ(asUrl(`${obj}f 1/1/1 2/2/2 3/1/2`))
  const relative = await loadOBJ(asUrl(`${obj}f 1/1/-2 -3/2/-1 3/1/2`))
  expect(relative).toEqual(absolute)
  expect(relative.triangles[0]?.normal).toEqual({ x: 0, y: 1, z: -0 })
})

test("negative indices resolve at the face rather than the end of the file", async () => {
  const prefix = `${vertices}vn 0 1 0
`
  const suffix = `
v 20 0 0
v 20 2 0
vn 1 0 0
f 4//2 5//2 6//2
`
  const absolute = await loadOBJ(asUrl(`${prefix}f 1//1 2//1 3//1${suffix}`))
  const relative = await loadOBJ(
    asUrl(`${prefix}f -4//-1 -3//-1 -2//-1${suffix}`),
  )
  expect(relative).toEqual(absolute)
  expect(relative.triangles).toHaveLength(2)
  expect(relative.triangles[0]?.normal).toEqual({ x: 0, y: 1, z: -0 })
  expect(relative.triangles[1]?.normal).toEqual({ x: 1, y: 0, z: -0 })
})

test("relative vertex references preserve per-vertex colors", async () => {
  const obj = `v 0 0 0 1 0 0
v 2 0 0 0 1 0
v 0 2 0 0 0 1
`
  const absolute = await loadOBJ(asUrl(`${obj}f 1 2 3`))
  const relative = await loadOBJ(asUrl(`${obj}f -3 -2 -1`))
  expect(relative).toEqual(absolute)
  expect(relative.triangles[0]?.color).toEqual([255, 0, 0, 1])
})

test("renderScene produces the same visible model for relative OBJ indices", async () => {
  const makeScene = (face: string): Scene => ({
    boxes: [
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "red",
        objUrl: asUrl(`${vertices}${face}`),
      },
    ],
    camera: {
      position: { x: 0, y: 0, z: 5 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  })
  const absolute = await renderScene(makeScene("f 1 3 2\nf 1 4 3"))
  const relative = await renderScene(makeScene("f -4 -2 -3\nf -4 -1 -2"))
  expect(relative).toEqual(absolute)
  expect(relative).toContain("<polygon")
  await expect(relative).toMatchSvgSnapshot(import.meta.path)
})
