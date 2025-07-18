import { test, expect } from "bun:test"
import { renderScene } from "../lib"

test("Binary STL rendering with bear clip and additional boxes", async () => {
  const scene = {
    boxes: [
      // Bear clip STL file (binary format)
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 20, y: 20, z: 20 },
        color: "orange" as const,
        stlUrl:
          "https://raw.githubusercontent.com/skalnik/secret-bear-clip/master/stl/clip.stl",
        scaleStlToBox: true,
      },
      // Additional boxes to test face rendering order
      {
        center: { x: -30, y: 0, z: 0 },
        size: { x: 8, y: 8, z: 8 },
        color: "red" as const,
      },
      {
        center: { x: 30, y: 0, z: 0 },
        size: { x: 8, y: 8, z: 8 },
        color: "blue" as const,
      },
      {
        center: { x: 0, y: -30, z: 0 },
        size: { x: 8, y: 8, z: 8 },
        color: "green" as const,
      },
      {
        center: { x: 0, y: 30, z: 0 },
        size: { x: 8, y: 8, z: 8 },
        color: "yellow" as const,
      },
      {
        center: { x: 0, y: 0, z: -30 },
        size: { x: 8, y: 8, z: 8 },
        color: [1, 0, 1, 1] as [number, number, number, number], // magenta
      },
      {
        center: { x: 0, y: 0, z: 30 },
        size: { x: 8, y: 8, z: 8 },
        color: [0, 1, 1, 1] as [number, number, number, number], // cyan
      },
    ],
    camera: {
      position: { x: -20, y: 10, z: 60 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }

  const svg = await renderScene(scene, {
    backgroundColor: "white",
    showOrigin: true,
  })
  expect(svg).toContain("<svg")
  expect(svg).toContain("</svg>")
  expect(svg).toContain("polygon")

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
