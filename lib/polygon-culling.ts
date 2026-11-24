import RBush from "rbush"

export interface Point2 {
  x: number
  y: number
}

export type Polygon2D = readonly Point2[]

interface RBushPolygonItem {
  minX: number
  minY: number
  maxX: number
  maxY: number
  polygon: Polygon2D
}

const EPS = 1e-9
const MAX_CONVEX_PIECES = 256

/**
 * Signed area of a 2D polygon (positive for counter-clockwise winding).
 */
function signedPolygonArea(poly: Polygon2D): number {
  if (poly.length < 3) return 0
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

export function polygonArea(poly: Polygon2D): number {
  return Math.abs(signedPolygonArea(poly))
}

function ensureCCW(poly: Polygon2D): Point2[] {
  if (signedPolygonArea(poly) < 0) {
    return [...poly].reverse()
  }
  return [...poly]
}

function getBBox(poly: Polygon2D): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const p of poly) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Splits a convex polygon `subject` by the directed line from `a` to `b`.
 * Returns `[inside, outside]` where `inside` is the left half-plane (`cross >= 0`)
 * and `outside` is the right half-plane (`cross <= 0`).
 */
function splitConvexPolygonByEdge(
  subject: Polygon2D,
  a: Point2,
  b: Point2,
): [Point2[], Point2[]] {
  const inside: Point2[] = []
  const outside: Point2[] = []
  const dx = b.x - a.x
  const dy = b.y - a.y

  const side = (p: Point2) => dx * (p.y - a.y) - dy * (p.x - a.x)

  const intersect = (
    p1: Point2,
    p2: Point2,
    s1: number,
    s2: number,
  ): Point2 => {
    const t = s1 / (s1 - s2)
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    }
  }

  for (let i = 0; i < subject.length; i++) {
    const curr = subject[i]!
    const next = subject[(i + 1) % subject.length]!
    const sCurr = side(curr)
    const sNext = side(next)

    const currIn = sCurr >= -EPS
    const nextIn = sNext >= -EPS
    const currOut = sCurr <= EPS
    const nextOut = sNext <= EPS

    if (currIn) inside.push(curr)
    if (currOut) outside.push(curr)

    if ((sCurr > EPS && sNext < -EPS) || (sCurr < -EPS && sNext > EPS)) {
      const hit = intersect(curr, next, sCurr, sNext)
      inside.push(hit)
      outside.push(hit)
    }
  }

  return [
    inside.length >= 3 && polygonArea(inside) > EPS ? inside : [],
    outside.length >= 3 && polygonArea(outside) > EPS ? outside : [],
  ]
}

/**
 * Subtracts a single CCW convex occluder from a convex piece, returning
 * mutually disjoint convex pieces representing `piece \ occluder`.
 */
function subtractConvexOccluder(
  piece: Polygon2D,
  occluderCCW: Polygon2D,
): Point2[][] {
  const outsidePieces: Point2[][] = []
  let remaining: Polygon2D = piece

  for (let i = 0; i < occluderCCW.length; i++) {
    const a = occluderCCW[i]!
    const b = occluderCCW[(i + 1) % occluderCCW.length]!
    const [inside, outside] = splitConvexPolygonByEdge(remaining, a, b)
    if (outside.length >= 3) {
      outsidePieces.push(outside)
    }
    if (inside.length < 3) {
      // Piece does not intersect the occluder at all; return original piece
      // intact to avoid unnecessary fragmentation.
      return [[...piece]]
    }
    remaining = inside
  }

  // `remaining` is `piece ∩ occluder` and is discarded.
  return outsidePieces
}

/**
 * Computes the area (in square SVG units) of `polygon` that is covered by
 * the union of `otherPolygons`.
 */
export function areaOfPolygonCoveredByOtherPolygons(
  polygon: Polygon2D,
  otherPolygons: readonly Polygon2D[],
): number {
  const originalArea = polygonArea(polygon)
  if (originalArea <= EPS || otherPolygons.length === 0) return 0

  const subjectBox = getBBox(polygon)
  let remainingPieces: Point2[][] = [ensureCCW(polygon)]

  for (const other of otherPolygons) {
    if (remainingPieces.length === 0) break
    if (other.length < 3) continue
    const otherArea = polygonArea(other)
    if (otherArea <= EPS) continue

    const otherBox = getBBox(other)
    if (
      otherBox.maxX < subjectBox.minX - EPS ||
      otherBox.minX > subjectBox.maxX + EPS ||
      otherBox.maxY < subjectBox.minY - EPS ||
      otherBox.minY > subjectBox.maxY + EPS
    ) {
      continue
    }

    const occluderCCW = ensureCCW(other)
    const nextPieces: Point2[][] = []
    let overflowed = false

    for (const piece of remainingPieces) {
      const subtracted = subtractConvexOccluder(piece, occluderCCW)
      for (const p of subtracted) {
        nextPieces.push(p)
        if (nextPieces.length > MAX_CONVEX_PIECES) {
          overflowed = true
          break
        }
      }
      if (overflowed) break
    }

    if (overflowed) {
      // Fail-open on extreme fragmentation so we never hang or over-cull.
      break
    }
    remainingPieces = nextPieces
  }

  let uncoveredArea = 0
  for (const piece of remainingPieces) {
    uncoveredArea += polygonArea(piece)
  }

  const covered = originalArea - uncoveredArea
  return Math.max(0, Math.min(originalArea, covered))
}

/**
 * Returns true if `polygon` is completely covered by `otherPolygons`, or
 * leaves at most `minVisibleArea` square units uncovered (default: `1e-6`).
 */
export function isPolygonCoveredByOtherPolygons(
  polygon: Polygon2D,
  otherPolygons: readonly Polygon2D[],
  options: { minVisibleArea?: number } = {},
): boolean {
  const originalArea = polygonArea(polygon)
  if (originalArea <= EPS) return true
  const minVisibleArea = options.minVisibleArea ?? 1e-6
  if (originalArea <= minVisibleArea) return true
  if (otherPolygons.length === 0) return false

  const coveredArea = areaOfPolygonCoveredByOtherPolygons(
    polygon,
    otherPolygons,
  )
  return originalArea - coveredArea <= minVisibleArea
}

function isOpaqueFill(fill: string): boolean {
  const rgbaMatch =
    /^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/i.exec(
      fill.trim(),
    )
  if (rgbaMatch) {
    const alpha = Number.parseFloat(rgbaMatch[1]!)
    return Number.isFinite(alpha) && alpha >= 1 - EPS
  }
  return fill.trim().toLowerCase() !== "none"
}

/**
 * Culls face elements in a back-to-front sorted render list that are occluded
 * by closer opaque faces, using an RBush spatial index for near-O(N) lookups.
 */
export function cullHiddenFaceElements<T extends { type: string; data: any }>(
  elements: readonly T[],
  options: { minVisibleArea?: number } = {},
): T[] {
  const minVisibleArea = options.minVisibleArea ?? 1
  const tree = new RBush<RBushPolygonItem>()
  const keep = new Array<boolean>(elements.length).fill(true)

  // Iterate front-to-back (closer faces appear later in back-to-front painter order)
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]!
    if (element.type !== "face") continue

    const pts = element.data.pts as Polygon2D
    if (!pts || pts.length < 3) {
      keep[i] = false
      continue
    }

    const bbox = getBBox(pts)
    const candidates = tree.search(bbox).map((item) => item.polygon)

    if (
      candidates.length > 0 &&
      isPolygonCoveredByOtherPolygons(pts, candidates, { minVisibleArea })
    ) {
      keep[i] = false
      continue
    }

    if (isOpaqueFill(String(element.data.fill ?? ""))) {
      tree.insert({
        ...bbox,
        polygon: pts,
      })
    }
  }

  return elements.filter((_, i) => keep[i])
}
