import type { Color, RGBA, Point3 } from "./types"
import { norm } from "./vec3"

export const NAMED_COLORS: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  silver: [192, 192, 192],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  white: [255, 255, 255],
  maroon: [128, 0, 0],
  red: [255, 0, 0],
  purple: [128, 0, 128],
  fuchsia: [255, 0, 255],
  green: [0, 128, 0],
  lime: [0, 255, 0],
  olive: [128, 128, 0],
  yellow: [255, 255, 0],
  navy: [0, 0, 128],
  blue: [0, 0, 255],
  teal: [0, 128, 128],
  aqua: [0, 255, 255],
  orange: [255, 165, 0],
}

export function colorToCss(c: Color): string {
  if (typeof c === "string") return c
  const [r, g, b, a] = c
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`
}

export function colorToRGBA(c: Color): RGBA {
  if (Array.isArray(c)) return c
  const s = c.trim().toLowerCase()
  if (s.startsWith("#")) {
    const hex = s.slice(1)
    if (hex.length === 3) {
      const r = parseInt(hex.charAt(0) + hex.charAt(0), 16)
      const g = parseInt(hex.charAt(1) + hex.charAt(1), 16)
      const b = parseInt(hex.charAt(2) + hex.charAt(2), 16)
      return [r, g, b, 1]
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return [r, g, b, 1]
    }
  }
  const rgbm = s.match(/^rgba?\(([^)]+)\)$/)
  if (rgbm) {
    const content = rgbm[1]!
    const parts = content.split(/\s*,\s*/).map(Number)
    const [r = 0, g = 0, b = 0, a = 1] = parts
    return [r, g, b, a]
  }
  const named = NAMED_COLORS[s]
  if (named) return [named[0], named[1], named[2], 1]
  return [0, 0, 0, 1]
}

export function lightenColor(c: Color, f: number): RGBA {
  const [r, g, b, a] = colorToRGBA(c)
  return [r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f, a]
}

export function darkenColor(c: Color, f: number): RGBA {
  const [r, g, b, a] = colorToRGBA(c)
  return [r * (1 - f), g * (1 - f), b * (1 - f), a]
}

export function shadeByNormal(base: Color, normal: Point3): string {
  const n = norm(normal)
  if (n.z >= 0) {
    return colorToCss(lightenColor(base, n.z * 0.4))
  } else {
    return colorToCss(darkenColor(base, -n.z * 0.4))
  }
}
