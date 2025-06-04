import { test, expect } from "bun:test"
import { renderScene } from "../lib"

test("OBJ rendering from remote url", async () => {
  const scene = {
    boxes: [
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 10, y: 10, z: 3 },
        color: "gray" as const,
        objUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=6ef04b62f1e945518af209609f65fa6f&pn=C110153&cachebust_origin=",
      },
    ],
    camera: {
      position: { x: 20, y: 20, z: 20 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }

  const svg = await renderScene(scene)
  expect(svg).toContain("<svg")
  expect(svg).toContain("</svg>")
  expect(svg).toContain("polygon")

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
