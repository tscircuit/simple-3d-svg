import RBush from "rbush"
import polygonClipping from "polygon-clipping"

export type Point2 = { x: number; y: number }

const PIXEL_AREA_THRESHOLD = 1
/** Skip expensive boolean unions when a face overlaps too many neighbors. */
const MAX_BOOLEAN_OCCLUDERS = 16

type BBox = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type OccluderItem = BBox & { pts: Point2[] }

function closeRing(pts: Point2[]): [number, number][] {
  const ring: [number, number][] = pts.map((p) => [p.x, p.y])
  if (ring.length === 0) return ring
  const first = ring[0]!
  const last = ring[ring.length - 1]!
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]])
  }
  if (signedRingArea(ring) < 0) {
    ring.reverse()
  }
  return ring
}

function signedRingArea(ring: [number, number][]): number {
  let area = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!
    const b = ring[i + 1]!
    area += a[0] * b[1] - b[0] * a[1]
  }
  return area / 2
}

function polygonArea(pts: Point2[]): number {
  if (pts.length < 3) return 0
  return Math.abs(signedRingArea(closeRing(pts)))
}

function multiPolygonArea(geom: [number, number][][][] | undefined): number {
  if (!geom) return 0
  let area = 0
  for (const polygon of geom) {
    const outer = polygon[0]
    if (!outer) continue
    area += Math.abs(signedRingArea(outer))
    for (let i = 1; i < polygon.length; i++) {
      area -= Math.abs(signedRingArea(polygon[i]!))
    }
  }
  return area
}

function toGeom(pts: Point2[]): [number, number][][] {
  return [closeRing(pts)]
}

export function boundsOfPolygon(pts: Point2[]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

function pointInPolygon(point: Point2, pts: Point2[]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!
    const b = pts[j]!
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

function polygonContainsPolygon(outer: Point2[], inner: Point2[]): boolean {
  if (outer.length < 3 || inner.length < 3) return false
  return inner.every((point) => pointInPolygon(point, outer))
}

/**
 * Area of `subject` that lies under the union of `otherPolygons`.
 */
export function areaOfPolygonCoveredByOtherPolygons(
  subject: Point2[],
  otherPolygons: Point2[][],
): number {
  const subjectArea = polygonArea(subject)
  if (subjectArea === 0 || otherPolygons.length === 0) return 0
  const occluders = otherPolygons.filter((pts) => pts.length >= 3)
  if (occluders.some((occluder) => polygonContainsPolygon(occluder, subject))) {
    return subjectArea
  }
  try {
    const leftover = polygonClipping.difference(
      toGeom(subject),
      ...occluders.map(toGeom),
    )
    return Math.max(0, subjectArea - multiPolygonArea(leftover))
  } catch {
    return 0
  }
}

/**
 * True when `subject` is completely hidden by `otherPolygons`, or would
 * change fewer than about one SVG pixel if it were omitted.
 */
export function isPolygonCoveredByOtherPolygons(
  subject: Point2[],
  otherPolygons: Point2[][],
): boolean {
  const occluders = otherPolygons.filter((pts) => pts.length >= 3)
  if (occluders.length === 0) return false
  if (occluders.some((occluder) => polygonContainsPolygon(occluder, subject))) {
    return true
  }
  if (occluders.length > MAX_BOOLEAN_OCCLUDERS) return false
  try {
    const leftover = polygonClipping.difference(
      toGeom(subject),
      ...occluders.map(toGeom),
    )
    return multiPolygonArea(leftover) <= PIXEL_AREA_THRESHOLD
  } catch {
    return false
  }
}

/**
 * Painter-order items (last = closest / drawn on top). Drops items whose
 * 2D projection is completely covered by closer opaque polygons.
 */
export function cullOccludedPolygons<T>(
  items: T[],
  getPoints: (item: T) => Point2[],
  isOpaqueOccluder: (item: T) => boolean,
): T[] {
  const tree = new RBush<OccluderItem>()
  const kept: T[] = []

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]!
    const pts = getPoints(item)
    const bbox = boundsOfPolygon(pts)
    const candidates = tree.search(bbox).map((entry) => entry.pts)
    if (
      candidates.length > 0 &&
      isPolygonCoveredByOtherPolygons(pts, candidates)
    ) {
      continue
    }

    kept.push(item)
    if (isOpaqueOccluder(item) && pts.length >= 3) {
      tree.insert({ ...bbox, pts })
    }
  }

  kept.reverse()
  return kept
}
