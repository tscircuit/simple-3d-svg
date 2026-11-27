import type { Color, RGBA, Point3 } from "./types"
import { norm } from "./vec3"

const COLOR_CACHE = new Map<string, RGBA>()

const clamp255 = (n: number) => (n < 0 ? 0 : n > 255 ? 255 : n)

function normalizeRgba(rgba: RGBA): RGBA {
  const [r, g, b, a = 1] = rgba
  return [clamp255(r), clamp255(g), clamp255(b), a < 0 ? 0 : a > 1 ? 1 : a]
}

function formatAlpha(a: number): string {
  const rounded = Math.round(a * 1000) / 1000
  const trimmed = rounded.toString().replace(/0+$/, "").replace(/\.$/, "")
  return trimmed === "" ? "0" : trimmed
}

function rgbaToCss([r, g, b, a]: RGBA): string {
  const rr = Math.round(clamp255(r))
  const gg = Math.round(clamp255(g))
  const bb = Math.round(clamp255(b))
  return `rgba(${rr},${gg},${bb},${formatAlpha(a)})`
}

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
  if (Array.isArray(c)) return rgbaToCss(normalizeRgba(c))
  return rgbaToCss(colorToRGBA(c))
}

export function colorToRGBA(c: Color): RGBA {
  if (Array.isArray(c)) return normalizeRgba(c)
  const cacheKey = c.trim()
  const cached = COLOR_CACHE.get(cacheKey)
  if (cached) return cached
  const s = cacheKey.toLowerCase()
  if (s.startsWith("#")) {
    const hex = s.slice(1)
    if (hex.length === 3) {
      const r = parseInt(hex.charAt(0) + hex.charAt(0), 16)
      const g = parseInt(hex.charAt(1) + hex.charAt(1), 16)
      const b = parseInt(hex.charAt(2) + hex.charAt(2), 16)
      const rgba: RGBA = [r, g, b, 1]
      COLOR_CACHE.set(cacheKey, rgba)
      return rgba
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const rgba: RGBA = [r, g, b, 1]
      COLOR_CACHE.set(cacheKey, rgba)
      return rgba
    }
  }
  const rgbm = s.match(/^rgba?\(([^)]+)\)$/)
  if (rgbm) {
    const content = rgbm[1]!
    const parts = content.split(/\s*,\s*/).map(Number)
    const [r = 0, g = 0, b = 0, a = 1] = parts
    const rgba: RGBA = normalizeRgba([r, g, b, a])
    COLOR_CACHE.set(cacheKey, rgba)
    return rgba
  }
  const named = NAMED_COLORS[s]
  if (named) {
    const rgba: RGBA = [named[0], named[1], named[2], 1]
    COLOR_CACHE.set(cacheKey, rgba)
    return rgba
  }
  const rgba: RGBA = [0, 0, 0, 1]
  COLOR_CACHE.set(cacheKey, rgba)
  return rgba
}

export function lightenColor(c: Color, f: number): RGBA {
  const [r, g, b, a] = colorToRGBA(c)
  return normalizeRgba([
    r + (255 - r) * f,
    g + (255 - g) * f,
    b + (255 - b) * f,
    a,
  ])
}

export function darkenColor(c: Color, f: number): RGBA {
  const [r, g, b, a] = colorToRGBA(c)
  return normalizeRgba([r * (1 - f), g * (1 - f), b * (1 - f), a])
}

export function shadeByNormal(base: Color, normal: Point3): string {
  const n = norm(normal)
  if (n.z >= 0) {
    return colorToCss(lightenColor(base, n.z * 0.4))
  } else {
    return colorToCss(darkenColor(base, -n.z * 0.4))
  }
}
