import type { Point3, STLMesh, Triangle, Color } from "../types"

const objCache = new Map<string, STLMesh>()

export async function loadOBJ(url: string): Promise<STLMesh> {
  if (objCache.has(url)) {
    return objCache.get(url)!
  }
  const response = await fetch(url)
  const text = await response.text()
  const mesh = parseOBJ(text)
  objCache.set(url, mesh)
  return mesh
}

function parseOBJ(text: string): STLMesh {
  const lines = text.split(/\r?\n/)
  const vertices: Point3[] = []
  const vertexColors: (Color | undefined)[] = []
  const normals: Point3[] = []
  const triangles: Triangle[] = []
  const materialColors: Record<string, Color> = {}
  let activeMaterial: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("v ")) {
      const parts = trimmed.split(/\s+/)
      const x = parts[1]!
      const y = parts[2]!
      const z = parts[3]!
      vertices.push({ x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) })
      if (parts.length >= 7) {
        const [rStr, gStr, bStr] = parts.slice(4, 7) as [string, string, string]
        let r = Number(rStr)
        let g = Number(gStr)
        let b = Number(bStr)
        if (r <= 1 && g <= 1 && b <= 1) {
          r *= 255
          g *= 255
          b *= 255
        }
        vertexColors.push([r, g, b, 1])
      } else {
        vertexColors.push(undefined)
      }
    } else if (trimmed.startsWith("vn ")) {
      const parts = trimmed.split(/\s+/)
      const x = parts[1]!
      const y = parts[2]!
      const z = parts[3]!
      normals.push({ x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) })
    } else if (trimmed.startsWith("newmtl ")) {
      activeMaterial = trimmed.split(/\s+/)[1]!
    } else if (trimmed.startsWith("Kd ") && activeMaterial) {
      const parts = trimmed.split(/\s+/)
      const rStr = parts[1]!
      const gStr = parts[2]!
      const bStr = parts[3]!
      let r = parseFloat(rStr)
      let g = parseFloat(gStr)
      let b = parseFloat(bStr)
      if (r <= 1 && g <= 1 && b <= 1) {
        r *= 255
        g *= 255
        b *= 255
      }
      materialColors[activeMaterial] = [r, g, b, 1]
    } else if (trimmed.startsWith("usemtl ")) {
      activeMaterial = trimmed.split(/\s+/)[1]!
    } else if (trimmed.startsWith("f ")) {
      const parts = trimmed.slice(2).trim().split(/\s+/)
      const idxs = parts.map((p) => {
        const [vi, , ni] = p.split("/") as [string, string, string]
        return {
          v: parseInt(vi) - 1,
          n: ni ? parseInt(ni) - 1 : undefined,
        }
      })
      for (let i = 1; i < idxs.length - 1; i++) {
        const a = idxs[0]!
        const b = idxs[i]!
        const c = idxs[i + 1]!
        const v0 = vertices[a.v]!
        const v1 = vertices[b.v]!
        const v2 = vertices[c.v]!
        let normal: Point3
        if (a.n !== undefined && normals[a.n]) {
          normal = normals[a.n]!
        } else if (b.n !== undefined && normals[b.n]) {
          normal = normals[b.n]!
        } else if (c.n !== undefined && normals[c.n]) {
          normal = normals[c.n]!
        } else {
          const edge1 = {
            x: v1.x - v0.x,
            y: v1.y - v0.y,
            z: v1.z - v0.z,
          }
          const edge2 = {
            x: v2.x - v0.x,
            y: v2.y - v0.y,
            z: v2.z - v0.z,
          }
          normal = {
            x: edge1.y * edge2.z - edge1.z * edge2.y,
            y: edge1.z * edge2.x - edge1.x * edge2.z,
            z: edge1.x * edge2.y - edge1.y * edge2.x,
          }
        }
        let color: Color | undefined
        if (activeMaterial && materialColors[activeMaterial]) {
          color = materialColors[activeMaterial]
        } else {
          color = vertexColors[a.v] ?? vertexColors[b.v] ?? vertexColors[c.v]
        }
        triangles.push({ vertices: [v0, v1, v2], normal, color })
      }
    }
  }

  return {
    triangles,
    boundingBox: calculateBoundingBox(triangles),
  }
}

function calculateBoundingBox(triangles: Triangle[]): {
  min: Point3
  max: Point3
} {
  if (triangles.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }
  }

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (const tri of triangles) {
    for (const v of tri.vertices) {
      if (v.x < minX) minX = v.x
      if (v.y < minY) minY = v.y
      if (v.z < minZ) minZ = v.z
      if (v.x > maxX) maxX = v.x
      if (v.y > maxY) maxY = v.y
      if (v.z > maxZ) maxZ = v.z
    }
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  }
}
