import { test, expect } from "bun:test"
import { renderScene, type Scene } from "../lib"

const planeOBJ = `data:text/plain;base64,${btoa(`v -1 -1 0\nv 1 -1 0\nv -1 1 0\nf 3 2 1\n`)}`

test("global backface culling toggle", async () => {
  const baseScene: Scene = {
    boxes: [
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        objUrl: planeOBJ,
        scaleObjToBox: false,
      },
    ],
    camera: {
      position: { x: 0, y: 0, z: 5 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }

  const culled = await renderScene(baseScene)
  const visible = await renderScene(baseScene, { backfaceCulling: false })

  expect(culled.includes("polygon")).toBe(false)
  expect(visible.includes("polygon")).toBe(true)
})
