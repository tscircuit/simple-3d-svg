import type { Scene, Color, Camera } from "./types"
import { colorToCss } from "./color"
import { buildRenderElements } from "./render-elements"
import { sub, cross, dot, len, norm } from "./vec3"

function fmt(n: number) {
  return Math.round(n) + ""
}

export async function renderScene(
  scene: Scene,
  opt: {
    width?: number
    height?: number
    backgroundColor?: Color
    showAxes?: boolean
  } = {},
): Promise<string> {
  const {
    width: W,
    height: H,
    backgroundColor,
    elements,
    images,
    texId,
  } = await buildRenderElements(scene, opt)

  const out: string[] = []
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${-W / 2} ${-H / 2} ${W} ${H}">`,
  )
  if (backgroundColor) {
    out.push(
      `  <rect x="${-W / 2}" y="${-H / 2}" width="${W}" height="${H}" fill="${colorToCss(backgroundColor)}" />\n`,
    )
  }

  // ---- defs section (identical to old code) ----
  if (images.length) {
    out.push("  <defs>\n")

    // Write one <image> per unique texture
    for (const [href, id] of texId) {
      out.push(
        `    <image id="${id}" href="${href}" width="1" height="1" preserveAspectRatio="none" style="image-rendering:pixelated"/>\n`,
      )
    }

    // Write clip paths
    for (const img of images) {
      out.push(
        `    <clipPath id="${img.clip}" clipPathUnits="objectBoundingBox"><polygon points="${img.points}" /></clipPath>\n`,
      )
    }
    out.push("  </defs>\n")
  }

  // ---- element rendering loop ----
  let inStrokeGroup = false

  for (const element of elements) {
    if (element.type === "face" || element.type === "image") {
      // Start stroke group if not already in one
      if (!inStrokeGroup) {
        out.push(
          '  <g stroke="#000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">\n',
        )
        inStrokeGroup = true
      }

      if (element.type === "face") {
        const f = element.data
        const strokeAttr = f.stroke ? "" : ' stroke="none"'
        out.push(
          `    <polygon fill="${f.fill}"${strokeAttr} points="${f.pts
            .map((p) => `${fmt(p.x)},${fmt(p.y)}`)
            .join(" ")}" />\n`,
        )
      } else {
        const img = element.data
        out.push(
          `    <g transform="${img.matrix}" clip-path="url(#${img.clip})"><use href="#${img.sym}"/></g>\n`,
        )
      }
    } else if (element.type === "label") {
      // Close stroke group if we're in one
      if (inStrokeGroup) {
        out.push("  </g>\n")
        inStrokeGroup = false
      }

      const l = element.data
      out.push(
        `  <g font-family="sans-serif" font-size="14" text-anchor="middle" dominant-baseline="central" transform="${l.matrix}"><text x="0" y="0" fill="${l.fill}">${l.text}</text></g>\n`,
      )
    } else if (element.type === "edge") {
      if (inStrokeGroup) {
        out.push("  </g>\n")
        inStrokeGroup = false
      }
      const e = element.data
      out.push(
        `  <polyline fill="none" stroke="${e.color}" points="${e.pts
          .map((p) => `${p.x},${p.y}`)
          .join(" ")}" />\n`,
      )
    }
  }

  // Close stroke group if still open
  if (inStrokeGroup) {
    out.push("  </g>\n")
  }

  if (opt.showAxes) {
    out.push(renderAxes(scene.camera, W, H))
  }

  out.push("</svg>")
  return out.join("")
}

function renderAxes(cam: Camera, W: number, H: number): string {
  const focal = cam.focalLength ?? 2
  const baseDist = 3
  const arrowDist = 1
  const margin = 40

  const baseProj = proj({ x: 0, y: 0, z: baseDist }, W, H, focal)
  if (!baseProj) return ""
  const offsetX = -W / 2 + margin - baseProj.x
  const offsetY = H / 2 - margin - baseProj.y

  function t(p: { x: number; y: number; z: number }) {
    const pp = proj(p, W, H, focal)
    return pp ? { x: pp.x + offsetX, y: pp.y + offsetY } : { x: 0, y: 0 }
  }

  const { r, u, f } = axes(cam)
  const start = t({ x: 0, y: 0, z: baseDist })
  const axesData = [
    { dir: r, color: "red" },
    { dir: u, color: "green" },
    { dir: f, color: "blue" },
  ]

  const parts: string[] = []
  for (const { dir, color } of axesData) {
    const end = t({
      x: dir.x * arrowDist,
      y: dir.y * arrowDist,
      z: baseDist + dir.z * arrowDist,
    })
    const dx = end.x - start.x
    const dy = end.y - start.y
    const l = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = dx / l
    const ny = dy / l
    const hx = end.x - nx * 8
    const hy = end.y - ny * 8
    const b1x = hx + -ny * 4
    const b1y = hy + nx * 4
    const b2x = hx - -ny * 4
    const b2y = hy - nx * 4
    parts.push(
      `    <line x1="${fmt(start.x)}" y1="${fmt(start.y)}" x2="${fmt(end.x)}" y2="${fmt(end.y)}" stroke="${color}" />`,
    )
    parts.push(
      `    <polygon fill="${color}" points="${fmt(end.x)},${fmt(end.y)} ${fmt(b1x)},${fmt(b1y)} ${fmt(b2x)},${fmt(b2y)}" />`,
    )
  }

  return `  <g stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${parts.join(
    "\n",
  )}\n  </g>\n`
}

function axes(cam: Camera) {
  const f = norm(sub(cam.lookAt, cam.position))
  const wUp = { x: 0, y: 1, z: 0 }
  let r = norm(cross(f, wUp))
  if (!len(r)) r = { x: 1, y: 0, z: 0 }
  const u = cross(r, f)
  return { r, u, f }
}

function proj(
  p: { x: number; y: number; z: number },
  w: number,
  h: number,
  focal: number,
): { x: number; y: number } | null {
  if (p.z <= 0) return null
  const s = focal / p.z
  return { x: (p.x * s * w) / 2, y: (-p.y * s * h) / 2 }
}
