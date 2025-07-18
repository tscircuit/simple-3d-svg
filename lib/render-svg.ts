import type { Scene, Color, Camera, Point3 } from "./types"
import { colorToCss } from "./color"
import { buildRenderElements } from "./render-elements"
import { sub, cross, dot, len, norm, add, scale } from "./vec3"

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
    showOrigin?: boolean
    showGrid?: boolean
    grid?: {
      /** world-space grid cell size (default = 1)            */ cellSize?: number
      /** plane on which to draw the grid (default = "xz")   */ plane?:
        | "xy"
        | "yz"
        | "xz"
    }
  } = {},
): Promise<string> {
  const {
    width: W,
    height: H,
    backgroundColor,
    elements,
    images,
    texId,
  } = await buildRenderElements(scene, {
    width: opt.width,
    height: opt.height,
    backgroundColor: opt.backgroundColor,
  })

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

  // ── grid plane ────────────────────────────────────────────
  if (opt.showGrid) {
    out.push(
      renderGrid(scene, W, H, opt.grid?.cellSize ?? 1, opt.grid?.plane ?? "xz"),
    )
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

  if (opt.showOrigin) {
    out.push(renderOrigin(scene.camera, W, H))
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
  const margin = Math.min(W, H) * 0.08
  const arrowDist = (baseDist * 0.16) / focal

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
    { w: { x: 1, y: 0, z: 0 }, color: "red", label: "X" },
    { w: { x: 0, y: 1, z: 0 }, color: "green", label: "Y" },
    { w: { x: 0, y: 0, z: 1 }, color: "blue", label: "Z" },
  ].map(({ w, color, label }) => ({
    dir: {
      x: w.x * r.x + w.y * r.y + w.z * r.z,
      y: w.x * u.x + w.y * u.y + w.z * u.z,
      z: w.x * f.x + w.y * f.y + w.z * f.z,
    },
    color,
    label,
  }))

  const parts: string[] = []
  for (const { dir, color, label } of axesData) {
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
    const tx = end.x + nx * 10
    const ty = end.y + ny * 10
    parts.push(
      `    <line x1="${fmt(start.x)}" y1="${fmt(start.y)}" x2="${fmt(hx)}" y2="${fmt(hy)}" stroke="${color}" />`,
    )
    parts.push(
      `    <polygon fill="${color}" points="${fmt(end.x)},${fmt(end.y)} ${fmt(b1x)},${fmt(b1y)} ${fmt(b2x)},${fmt(b2y)}" />`,
    )
    parts.push(
      `    <text x="${fmt(tx)}" y="${fmt(ty)}" fill="${color}" font-size="12" font-family="sans-serif" text-anchor="middle" dominant-baseline="central">${label}</text>`,
    )
  }

  return `  <g stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${parts.join(
    "\n",
  )}\n  </g>\n`
}

function renderGrid(
  scene: Scene,
  W: number,
  H: number,
  cellSize: number,
  plane: "xy" | "yz" | "xz",
): string {
  const cam = scene.camera
  const focal = cam.focalLength ?? 2
  const { r, u, f } = axes(cam)

  // helper: world->camera->2D projection ---------------------
  const toCam = (p: Point3) => {
    const d = sub(p, cam.position)
    return { x: dot(d, r), y: dot(d, u), z: dot(d, f) }
  }
  const project = (p: Point3) => proj(toCam(p), W, H, focal)

  // grid extent (±R in both directions)
  const R = cellSize * 10 // 21×21 lines by default

  const lines: string[] = []
  for (let t = -R; t <= R; t += cellSize) {
    const pushLine = (a: Point3, b: Point3) => {
      const p0 = project(a)
      const p1 = project(b)
      if (p0 && p1) {
        lines.push(
          `    <line x1="${fmt(p0.x)}" y1="${fmt(p0.y)}" ` +
            `x2="${fmt(p1.x)}" y2="${fmt(p1.y)}" />`,
        )
      }
    }

    switch (plane) {
      case "xz":
        pushLine({ x: t, y: 0, z: -R }, { x: t, y: 0, z: R }) // lines ‖ Z
        pushLine({ x: -R, y: 0, z: t }, { x: R, y: 0, z: t }) // lines ‖ X
        break
      case "xy":
        pushLine({ x: t, y: -R, z: 0 }, { x: t, y: R, z: 0 }) // lines ‖ Y
        pushLine({ x: -R, y: t, z: 0 }, { x: R, y: t, z: 0 }) // lines ‖ X
        break
      case "yz":
        pushLine({ x: 0, y: t, z: -R }, { x: 0, y: t, z: R }) // lines ‖ Z
        pushLine({ x: 0, y: -R, z: t }, { x: 0, y: R, z: t }) // lines ‖ Y
        break
    }
  }

  return lines.length
    ? `  <g stroke="#ccc" stroke-width="0.5">\n${lines.join("\n")}\n  </g>\n`
    : ""
}

function renderOrigin(cam: Camera, W: number, H: number): string {
  // Project the world origin and axes directions into camera space, then to 2D
  const focal = cam.focalLength ?? 2
  const { r, u, f } = axes(cam)

  // Helper: world -> camera space
  const toCam = (p: Point3) => {
    const d = sub(p, cam.position)
    return { x: dot(d, r), y: dot(d, u), z: dot(d, f) }
  }
  // Helper: camera -> 2D projection
  const project = (p: { x: number; y: number; z: number }) =>
    proj(p, W, H, focal)

  const axesData = [
    { dir: { x: 1, y: 0, z: 0 }, color: "red" },
    { dir: { x: 0, y: 1, z: 0 }, color: "green" },
    { dir: { x: 0, y: 0, z: 1 }, color: "blue" },
  ]

  const parts: string[] = []
  const origin = { x: 0, y: 0, z: 0 }
  for (const { dir, color } of axesData) {
    const L = 10
    const end = add(origin, scale(dir, L))
    const startCam = toCam(origin)
    const endCam = toCam(end)
    const start2d = project(startCam)
    const end2d = project(endCam)
    if (start2d && end2d) {
      parts.push(
        `    <line x1="${fmt(start2d.x)}" y1="${fmt(start2d.y)}" x2="${fmt(end2d.x)}" y2="${fmt(end2d.y)}" stroke="${color}" />`,
      )
    }
  }

  return parts.length
    ? `  <g stroke-width="1">\n${parts.join("\n")}\n  </g>\n`
    : ""
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
