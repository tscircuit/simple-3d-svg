import { expect, test } from "bun:test"
import {
  areaOfPolygonCoveredByOtherPolygons,
  cullHiddenFaceElements,
  isPolygonCoveredByOtherPolygons,
  type Polygon2D,
  renderScene,
} from "../lib"

const rect = (x1: number, y1: number, x2: number, y2: number): Polygon2D => [
  { x: x1, y: y1 },
  { x: x2, y: y1 },
  { x: x2, y: y2 },
  { x: x1, y: y2 },
]

test("areaOfPolygonCoveredByOtherPolygons computes exact covered area for disjoint, partial, and union occluders", () => {
  const subject = rect(0, 0, 10, 10) // area = 100

  // Disjoint occluder -> 0
  expect(
    areaOfPolygonCoveredByOtherPolygons(subject, [rect(20, 20, 30, 30)]),
  ).toBeCloseTo(0, 6)

  // Single larger occluder -> 100
  expect(
    areaOfPolygonCoveredByOtherPolygons(subject, [rect(-5, -5, 15, 15)]),
  ).toBeCloseTo(100, 6)

  // Half coverage -> 50
  expect(
    areaOfPolygonCoveredByOtherPolygons(subject, [rect(0, 0, 5, 10)]),
  ).toBeCloseTo(50, 6)

  // Two halves covering the full square -> 100 (even with CW winding)
  const leftHalfCW = [...rect(0, 0, 5, 10)].reverse()
  const rightHalf = rect(5, 0, 10, 10)
  expect(
    areaOfPolygonCoveredByOtherPolygons(subject, [leftHalfCW, rightHalf]),
  ).toBeCloseTo(100, 6)

  // Overlapping occluders must not double-count shared region:
  // [0..7] U [3..10] covers [0..10] -> 100, not 140
  expect(
    areaOfPolygonCoveredByOtherPolygons(subject, [
      rect(0, 0, 7, 10),
      rect(3, 0, 10, 10),
    ]),
  ).toBeCloseTo(100, 6)
})

test("isPolygonCoveredByOtherPolygons respects minVisibleArea threshold", () => {
  const subject = rect(0, 0, 10, 10) // area = 100
  const almostAll = rect(0, 0, 9.95, 10) // leaves 0.5 sq px uncovered

  expect(
    isPolygonCoveredByOtherPolygons(subject, [almostAll], {
      minVisibleArea: 0.1,
    }),
  ).toBe(false)
  expect(
    isPolygonCoveredByOtherPolygons(subject, [almostAll], {
      minVisibleArea: 1,
    }),
  ).toBe(true)
})

test("cullHiddenFaceElements culls opaque-occluded faces but preserves faces behind translucent occluders", () => {
  const backFace = {
    type: "face",
    data: { pts: rect(2, 2, 8, 8), fill: "rgb(255,0,0)", stroke: true },
  }
  const translucentFront = {
    type: "face",
    data: { pts: rect(0, 0, 10, 10), fill: "rgba(0,0,255,0.5)", stroke: true },
  }
  const opaqueFront = {
    type: "face",
    data: { pts: rect(0, 0, 10, 10), fill: "rgb(0,255,0)", stroke: true },
  }
  const label = {
    type: "label",
    data: { text: "TOP", matrix: "", fill: "#000", depth: 0 },
  }

  // Translucent occluder must NOT hide the back face
  const keptBehindTranslucent = cullHiddenFaceElements([
    backFace,
    translucentFront,
    label,
  ])
  expect(keptBehindTranslucent).toHaveLength(3)

  // Opaque occluder DOES hide the back face, while keeping front face + label
  const keptBehindOpaque = cullHiddenFaceElements([
    backFace,
    opaqueFront,
    label,
  ])
  expect(keptBehindOpaque).toEqual([opaqueFront, label])
})

test("renderScene with cullHiddenPolygons removes completely occluded rear box faces", async () => {
  const scene = {
    camera: {
      position: { x: 0, y: 0, z: 10 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
    boxes: [
      // Small box directly behind the larger front box
      {
        center: { x: 0, y: 0, z: -3 },
        size: { x: 1, y: 1, z: 1 },
        color: "red",
      },
      // Large opaque box blocking the rear box completely
      {
        center: { x: 0, y: 0, z: 1 },
        size: { x: 4, y: 4, z: 1 },
        color: "blue",
      },
    ],
  }

  const uncullSvg = await renderScene(scene, { width: 400, height: 400 })
  const culledSvg = await renderScene(scene, {
    width: 400,
    height: 400,
    cullHiddenPolygons: true,
  })

  const uncullPolygons = uncullSvg.match(/<polygon\b/g)?.length ?? 0
  const culledPolygons = culledSvg.match(/<polygon\b/g)?.length ?? 0

  expect(uncullPolygons).toBeGreaterThan(culledPolygons)
  expect(culledPolygons).toBeGreaterThan(0)
  // Rear red box should be completely culled
  expect(culledSvg).not.toContain("rgb(255,0,0)")
})
