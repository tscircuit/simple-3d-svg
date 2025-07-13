export interface Point2 {
  x: number
  y: number
}

/**
 * Invert a 3x3 matrix
 */
export function inv3(
  m: [number, number, number][],
): [number, number, number][] {
  const a = m[0]![0],
    d = m[0]![1],
    g = m[0]![2]
  const b = m[1]![0],
    e = m[1]![1],
    h = m[1]![2]
  const c = m[2]![0],
    f = m[2]![1],
    i = m[2]![2]
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const D = -(b * i - c * h)
  const E = a * i - c * g
  const F = -(a * h - b * g)
  const G = b * f - c * e
  const H = -(a * f - c * d)
  const I = a * e - b * d
  const det = a * A + d * D + g * G
  const invDet = det ? 1 / det : 0
  return [
    [A * invDet, B * invDet, C * invDet],
    [D * invDet, E * invDet, F * invDet],
    [G * invDet, H * invDet, I * invDet],
  ]
}

/**
 * Multiply two 3x3 matrices
 */
export function mul3(
  a: [number, number, number][],
  b: [number, number, number][],
): [number, number, number][] {
  const r: [number, number, number][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i]![j] =
        a[i]![0]! * b[0]![j]! + a[i]![1]! * b[1]![j]! + a[i]![2]! * b[2]![j]!
    }
  }
  return r
}

/* Public helper ------------------------------------------------*/
export function affineMatrix(
  src: [Point2, Point2, Point2],
  dst: [Point2, Point2, Point2],
): string {
  const S: [number, number, number][] = [
    [src[0].x, src[1].x, src[2].x],
    [src[0].y, src[1].y, src[2].y],
    [1, 1, 1],
  ]
  const D: [number, number, number][] = [
    [dst[0].x, dst[1].x, dst[2].x],
    [dst[0].y, dst[1].y, dst[2].y],
    [1, 1, 1],
  ]
  const M = mul3(D, inv3(S))
  return `matrix(${M[0]![0]} ${M[1]![0]} ${M[0]![1]} ${M[1]![1]} ${M[0]![2]} ${M[1]![2]})`
}
