import type { Scene, Color } from "./types"
import { colorToCss } from "./color"
import { buildRenderElements } from "./render-elements"

function fmt(n: number) {
  return Math.round(n) + ""
}

export async function renderScene(
  scene: Scene,
  opt: { width?: number; height?: number; backgroundColor?: Color } = {},
): Promise<string> {
  const { width: W, height: H, backgroundColor, elements, images, texId } =
    await buildRenderElements(scene, opt)

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

  out.push("</svg>")
  return out.join("")
}
