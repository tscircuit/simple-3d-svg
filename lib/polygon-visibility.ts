import RBush, { type BBox } from "rbush"

export interface Point2D {
  x: number
  y: number
}

const EPS = 1e-6
const MAX_FRAGMENTS = 128
const MAX_COVER_CANDIDATES = 64

export function getPolygonArea(polygon: readonly Point2D[]): number {
  const n = polygon.length
  if (n < 3) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const a = polygon[i]!
    const b = polygon[(i + 1) % n]!
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) * 0.5
}

export function getPolygonBBox(polygon: readonly Point2D[]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of polygon) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

function signedArea2(poly: readonly Point2D[]): number {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum
}

function ensureCCW(poly: readonly Point2D[]): Point2D[] {
  const cleaned: Point2D[] = []
  for (const p of poly) {
    const prev = cleaned[cleaned.length - 1]
    if (!prev || Math.abs(prev.x - p.x) > EPS || Math.abs(prev.y - p.y) > EPS) {
      cleaned.push({ x: p.x, y: p.y })
    }
  }
  if (cleaned.length > 1) {
    const first = cleaned[0]!
    const last = cleaned[cleaned.length - 1]!
    if (
      Math.abs(first.x - last.x) <= EPS &&
      Math.abs(first.y - last.y) <= EPS
    ) {
      cleaned.pop()
    }
  }
  if (cleaned.length < 3) return []
  if (signedArea2(cleaned) < 0) cleaned.reverse()
  return cleaned
}

function isConvexCCW(poly: readonly Point2D[]): boolean {
  const n = poly.length
  if (n < 3) return false
  for (let i = 0; i < n; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % n]!
    const c = poly[(i + 2) % n]!
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (cross < -EPS) return false
  }
  return true
}

function pointInTriangleCCW(
  p: Point2D,
  a: Point2D,
  b: Point2D,
  c: Point2D,
): boolean {
  const c1 = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
  const c2 = (c.x - b.x) * (p.y - b.y) - (c.y - b.y) * (p.x - b.x)
  const c3 = (a.x - c.x) * (p.y - c.y) - (a.y - c.y) * (p.x - c.x)
  return c1 >= -EPS && c2 >= -EPS && c3 >= -EPS
}

function decomposeToConvexCCW(poly: readonly Point2D[]): Point2D[][] {
  const ccw = ensureCCW(poly)
  if (ccw.length < 3 || getPolygonArea(ccw) <= EPS) return []
  if (ccw.length === 3 || isConvexCCW(ccw)) return [ccw]

  const tris: Point2D[][] = []
  const verts = ccw.slice()
  let guard = verts.length * verts.length

  while (verts.length > 3 && guard-- > 0) {
    let earFound = false
    const n = verts.length
    for (let i = 0; i < n; i++) {
      const prev = verts[(i - 1 + n) % n]!
      const curr = verts[i]!
      const next = verts[(i + 1) % n]!
      const cross =
        (curr.x - prev.x) * (next.y - prev.y) -
        (curr.y - prev.y) * (next.x - prev.x)
      if (cross <= EPS) continue

      let hasInside = false
      for (let j = 0; j < n; j++) {
        if (j === (i - 1 + n) % n || j === i || j === (i + 1) % n) continue
        if (pointInTriangleCCW(verts[j]!, prev, curr, next)) {
          hasInside = true
          break
        }
      }
      if (!hasInside) {
        tris.push([prev, curr, next])
        verts.splice(i, 1)
        earFound = true
        break
      }
    }
    if (!earFound) break
  }

  if (verts.length === 3 && getPolygonArea(verts) > EPS) {
    tris.push(verts)
  }
  return tris
}

function splitConvexPolygonByHalfPlane(
  poly: readonly Point2D[],
  edgeStart: Point2D,
  edgeEnd: Point2D,
): { inside: Point2D[]; outside: Point2D[] } {
  const dx = edgeEnd.x - edgeStart.x
  const dy = edgeEnd.y - edgeStart.y
  const inside: Point2D[] = []
  const outside: Point2D[] = []

  const dist = (p: Point2D) =>
    dx * (p.y - edgeStart.y) - dy * (p.x - edgeStart.x)

  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % n]!
    const da = dist(a)
    const db = dist(b)

    if (da >= -EPS) inside.push(a)
    if (da <= EPS) outside.push(a)

    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const t = da / (da - db)
      const inter: Point2D = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      }
      inside.push(inter)
      outside.push(inter)
    }
  }

  return {
    inside: ensureCCW(inside),
    outside: ensureCCW(outside),
  }
}

function bboxesOverlap(a: BBox, b: BBox): boolean {
  return (
    a.minX < b.maxX - EPS &&
    a.maxX > b.minX + EPS &&
    a.minY < b.maxY - EPS &&
    a.maxY > b.minY + EPS
  )
}

function subtractConvexFromConvex(
  subject: Point2D[],
  clipper: readonly Point2D[],
): Point2D[][] {
  const subjBox = getPolygonBBox(subject)
  const clipBox = getPolygonBBox(clipper)
  if (!bboxesOverlap(subjBox, clipBox)) return [subject]

  const result: Point2D[][] = []
  let remainder: Point2D[] | null = subject

  for (let i = 0; i < clipper.length; i++) {
    if (!remainder || remainder.length < 3) break
    const edgeStart = clipper[i]!
    const edgeEnd = clipper[(i + 1) % clipper.length]!
    const { inside, outside } = splitConvexPolygonByHalfPlane(
      remainder,
      edgeStart,
      edgeEnd,
    )

    if (outside.length >= 3 && getPolygonArea(outside) > EPS) {
      result.push(outside)
    }
    if (inside.length < 3 || getPolygonArea(inside) <= EPS) {
      remainder = null
      break
    }
    remainder = inside
  }

  // If remainder ended up null before finishing all edges, `subject` didn't intersect `clipper`'s interior.
  if (remainder === null) {
    return [subject]
  }

  return result
}

function subtractConvexClippers(
  initialFragments: Point2D[][],
  clippers: readonly Point2D[][],
): Point2D[][] | null {
  let fragments = initialFragments
  for (const clipper of clippers) {
    if (fragments.length === 0) return []
    const next: Point2D[][] = []
    for (const frag of fragments) {
      const pieces = subtractConvexFromConvex(frag, clipper)
      for (const piece of pieces) {
        if (getPolygonArea(piece) > EPS) {
          next.push(piece)
        }
      }
      if (next.length > MAX_FRAGMENTS) {
        return null
      }
    }
    fragments = next
  }
  return fragments
}

export function areaOfPolygonCoveredByOtherPolygons(
  polygon: readonly Point2D[],
  otherPolygons: readonly (readonly Point2D[])[],
): number {
  const totalArea = getPolygonArea(polygon)
  if (totalArea <= EPS) return 0
  if (otherPolygons.length === 0) return 0

  const subjectBox = getPolygonBBox(polygon)
  const subjectParts = decomposeToConvexCCW(polygon)
  if (subjectParts.length === 0) return 0

  const clippers: Point2D[][] = []
  for (const other of otherPolygons) {
    const box = getPolygonBBox(other)
    if (!bboxesOverlap(subjectBox, box)) continue
    const parts = decomposeToConvexCCW(other)
    for (const part of parts) {
      if (bboxesOverlap(subjectBox, getPolygonBBox(part))) {
        clippers.push(part)
      }
    }
    if (clippers.length > MAX_COVER_CANDIDATES) break
  }

  if (clippers.length === 0) return 0

  const remaining = subtractConvexClippers(subjectParts, clippers)
  if (remaining === null) {
    // Fail-open conservatively when fragment explosion occurs on dense meshes
    return 0
  }

  let uncoveredArea = 0
  for (const frag of remaining) {
    uncoveredArea += getPolygonArea(frag)
  }
  return Math.max(0, Math.min(totalArea, totalArea - uncoveredArea))
}

export function isPolygonCoveredByOtherPolygons(
  polygon: readonly Point2D[],
  otherPolygons: readonly (readonly Point2D[])[],
  minUncoveredArea = 1e-3,
): boolean {
  const totalArea = getPolygonArea(polygon)
  if (totalArea <= minUncoveredArea) return true
  const coveredArea = areaOfPolygonCoveredByOtherPolygons(
    polygon,
    otherPolygons,
  )
  return totalArea - coveredArea <= minUncoveredArea
}

interface IndexedPolygon extends BBox {
  polygons: Point2D[][]
}

export function cullHiddenOrderedFaces<
  T extends { pts: readonly Point2D[]; fill: string },
>(
  orderedBackToFront: readonly T[],
  options: {
    isOpaque: (face: T) => boolean
    minVisibleArea?: number
  },
): T[] {
  const minVisibleArea = options.minVisibleArea ?? 1e-3
  const tree = new RBush<IndexedPolygon>()
  const keptReversed: T[] = []

  // Traverse from front-most (last drawn) to back-most (first drawn)
  for (let i = orderedBackToFront.length - 1; i >= 0; i--) {
    const face = orderedBackToFront[i]!
    const totalArea = getPolygonArea(face.pts)
    if (totalArea <= minVisibleArea) {
      continue
    }

    const bbox = getPolygonBBox(face.pts)
    const candidates = tree.search(bbox)

    if (candidates.length > 0 && candidates.length <= MAX_COVER_CANDIDATES) {
      const clippers: Point2D[][] = []
      for (const candidate of candidates) {
        for (const poly of candidate.polygons) {
          clippers.push(poly)
        }
        if (clippers.length > MAX_COVER_CANDIDATES) break
      }

      if (clippers.length <= MAX_COVER_CANDIDATES) {
        const subjectParts = decomposeToConvexCCW(face.pts)
        const remaining = subtractConvexClippers(subjectParts, clippers)
        if (remaining !== null) {
          let uncoveredArea = 0
          for (const frag of remaining) {
            uncoveredArea += getPolygonArea(frag)
          }
          if (uncoveredArea <= minVisibleArea) {
            continue
          }
        }
      }
    }

    keptReversed.push(face)

    if (options.isOpaque(face)) {
      const convexParts = decomposeToConvexCCW(face.pts)
      if (convexParts.length > 0) {
        tree.insert({
          ...bbox,
          polygons: convexParts,
        })
      }
    }
  }

  keptReversed.reverse()
  return keptReversed
}
