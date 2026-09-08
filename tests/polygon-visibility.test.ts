import { expect, test } from "bun:test"
import {
  areaOfPolygonCoveredByOtherPolygons,
  isPolygonCoveredByOtherPolygons,
  renderScene,
} from "lib"

function countPolygons(svg: string): number {
  return svg.match(/<polygon /g)?.length ?? 0
}

test("a polygon inside a larger polygon is fully covered", () => {
  const inner = [
    { x: 10, y: 10 },
    { x: 20, y: 10 },
    { x: 20, y: 20 },
    { x: 10, y: 20 },
  ]
  const outer = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 40 },
    { x: 0, y: 40 },
  ]

  expect(isPolygonCoveredByOtherPolygons(inner, [outer])).toBe(true)
  expect(areaOfPolygonCoveredByOtherPolygons(inner, [outer])).toBe(100)
})

test("two side-by-side polygons do not cover a polygon that spans the gap", () => {
  const subject = [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 10 },
    { x: 0, y: 10 },
  ]
  const left = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  const right = [
    { x: 20, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 10 },
    { x: 20, y: 10 },
  ]

  expect(isPolygonCoveredByOtherPolygons(subject, [left, right])).toBe(false)
})

test("two adjacent polygons together cover a spanning polygon", () => {
  const subject = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 10 },
    { x: 0, y: 10 },
  ]
  const left = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  const right = [
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 10 },
    { x: 10, y: 10 },
  ]

  expect(isPolygonCoveredByOtherPolygons(subject, [left, right])).toBe(true)
})

test("renderScene drops faces of an opaque box hidden behind a closer wall", async () => {
  const scene = {
    boxes: [
      {
        center: { x: 0, y: 0, z: 4 },
        size: { x: 6, y: 6, z: 0.4 },
        color: "red",
      },
      {
        center: { x: 0, y: 0, z: 8 },
        size: { x: 1, y: 1, z: 1 },
        color: "blue",
      },
    ],
    camera: {
      position: { x: 0, y: 0, z: 0 },
      lookAt: { x: 0, y: 0, z: 6 },
    },
  }

  const withHiddenFaces = await renderScene(scene, {
    cullHiddenPolygons: false,
  })
  const culled = await renderScene(scene, { cullHiddenPolygons: true })

  expect(countPolygons(culled)).toBeLessThan(countPolygons(withHiddenFaces))
  expect(countPolygons(culled)).toBeGreaterThan(0)
})
