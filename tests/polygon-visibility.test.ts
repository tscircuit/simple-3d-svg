import { expect, test } from "bun:test"
import {
  areaOfPolygonCoveredByOtherPolygons,
  isPolygonCoveredByOtherPolygons,
  renderScene,
} from "lib"

test("areaOfPolygonCoveredByOtherPolygons computes exact single and multi-polygon union coverage", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]

  // Disjoint polygon
  const disjoint = [
    { x: 20, y: 20 },
    { x: 30, y: 20 },
    { x: 30, y: 30 },
    { x: 20, y: 30 },
  ]
  expect(areaOfPolygonCoveredByOtherPolygons(square, [disjoint])).toBeCloseTo(
    0,
    5,
  )
  expect(isPolygonCoveredByOtherPolygons(square, [disjoint])).toBe(false)

  // Half covered
  const leftHalf = [
    { x: -1, y: -1 },
    { x: 5, y: -1 },
    { x: 5, y: 11 },
    { x: -1, y: 11 },
  ]
  expect(areaOfPolygonCoveredByOtherPolygons(square, [leftHalf])).toBeCloseTo(
    50,
    5,
  )
  expect(isPolygonCoveredByOtherPolygons(square, [leftHalf])).toBe(false)

  // Covered by the union of two halves
  const rightHalf = [
    { x: 5, y: -1 },
    { x: 11, y: -1 },
    { x: 11, y: 11 },
    { x: 5, y: 11 },
  ]
  expect(
    areaOfPolygonCoveredByOtherPolygons(square, [leftHalf, rightHalf]),
  ).toBeCloseTo(100, 5)
  expect(isPolygonCoveredByOtherPolygons(square, [leftHalf, rightHalf])).toBe(
    true,
  )

  // Nearly completely covered (leaving a 0.2 x 2 = 0.4 px^2 sliver)
  const almostAll = [
    { x: 0, y: 0 },
    { x: 9.8, y: 0 },
    { x: 9.8, y: 10 },
    { x: 0, y: 10 },
    { x: 0, y: 0 },
  ]
  const topPatch = [
    { x: 9.8, y: 2 },
    { x: 10, y: 2 },
    { x: 10, y: 10 },
    { x: 9.8, y: 10 },
  ]
  const covered = areaOfPolygonCoveredByOtherPolygons(square, [
    almostAll.slice(0, 4),
    topPatch,
  ])
  expect(covered).toBeCloseTo(99.6, 5)
  expect(
    isPolygonCoveredByOtherPolygons(
      square,
      [almostAll.slice(0, 4), topPatch],
      1,
    ),
  ).toBe(true)
  expect(
    isPolygonCoveredByOtherPolygons(
      square,
      [almostAll.slice(0, 4), topPatch],
      0.1,
    ),
  ).toBe(false)
})

test("renderScene with cullHiddenPolygons removes obscured back faces and occluded boxes", async () => {
  const scene = {
    boxes: [
      // Larger opaque front box closer to camera
      {
        center: { x: 0, y: 0, z: 4 },
        size: { x: 4, y: 4, z: 1 },
        color: "red",
      },
      // Smaller box completely hidden behind the front box
      {
        center: { x: 0, y: 0, z: 8 },
        size: { x: 1, y: 1, z: 1 },
        color: "blue",
      },
    ],
    camera: {
      position: { x: 0, y: 0, z: 0 },
      lookAt: { x: 0, y: 0, z: 5 },
    },
  }

  const unculledSvg = await renderScene(scene)
  const culledSvg = await renderScene(scene, { cullHiddenPolygons: true })

  const countPolygons = (svg: string) => (svg.match(/<polygon /g) ?? []).length

  // Without culling: 6 faces per box = 12 polygons, including blue faces
  expect(countPolygons(unculledSvg)).toBe(12)
  expect(unculledSvg).toContain('fill="blue"')

  // With culling: front face of red box completely covers its own 5 back/side faces AND all 6 faces of the blue box!
  expect(countPolygons(culledSvg)).toBe(1)
  expect(culledSvg).toContain('fill="red"')
  expect(culledSvg).not.toContain('fill="blue"')
})

test("renderScene with cullHiddenPolygons does not cull behind semi-transparent faces", async () => {
  const scene = {
    boxes: [
      {
        center: { x: 0, y: 0, z: 4 },
        size: { x: 4, y: 4, z: 1 },
        color: "rgba(255, 0, 0, 0.5)",
      },
      {
        center: { x: 0, y: 0, z: 8 },
        size: { x: 1, y: 1, z: 1 },
        color: "blue",
      },
    ],
    camera: {
      position: { x: 0, y: 0, z: 0 },
      lookAt: { x: 0, y: 0, z: 5 },
    },
  }

  const culledSvg = await renderScene(scene, { cullHiddenPolygons: true })
  expect(culledSvg).toContain('fill="blue"')
})
