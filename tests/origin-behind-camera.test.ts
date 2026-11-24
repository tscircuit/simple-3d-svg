import { test, expect } from "bun:test"
import { renderScene } from "lib"

test("showOrigin does not crash when the world origin is behind the camera", async () => {
  // Camera at z=5 looking towards z=10: the world origin (0,0,0) is behind
  // the view plane, so projecting it yields no point.
  const svg = await renderScene(
    {
      boxes: [
        {
          center: { x: 0, y: 0, z: 8 },
          size: { x: 1, y: 1, z: 1 },
          color: "red",
        },
      ],
      camera: {
        position: { x: 0, y: 0, z: 5 },
        lookAt: { x: 0, y: 0, z: 10 },
      },
    } as any,
    { showOrigin: true } as any,
  )

  expect(typeof svg).toBe("string")
  expect(svg).not.toContain("NaN")
})

test("showOrigin does not emit NaN when a world axis is parallel to the view direction", async () => {
  // Camera looks straight down the world X axis: the X axis line projects to
  // a single point, so the direction length is zero.
  const svg = await renderScene(
    {
      boxes: [
        {
          center: { x: 5, y: 0, z: 0 },
          size: { x: 1, y: 1, z: 1 },
          color: "red",
        },
      ],
      camera: {
        position: { x: 5, y: 0, z: 0 },
        lookAt: { x: 10, y: 0, z: 0 },
      },
    } as any,
    { showOrigin: true } as any,
  )

  expect(typeof svg).toBe("string")
  expect(svg).not.toContain("NaN")
})
