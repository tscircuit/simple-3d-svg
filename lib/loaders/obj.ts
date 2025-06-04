import type { Point3, STLMesh, Triangle } from "../types"

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
  const normals: Point3[] = []
  const triangles: Triangle[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("v ")) {
      const [, x, y, z] = trimmed.split(/\s+/)
      vertices.push({ x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) })
    } else if (trimmed.startsWith("vn ")) {
      const [, x, y, z] = trimmed.split(/\s+/)
      normals.push({ x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) })
    } else if (trimmed.startsWith("f ")) {
      const parts = trimmed.slice(2).trim().split(/\s+/)
      const idxs = parts.map((p) => {
        const [vi, , ni] = p.split("/")
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
          normal = normals[a.n]
        } else if (b.n !== undefined && normals[b.n]) {
          normal = normals[b.n]
        } else if (c.n !== undefined && normals[c.n]) {
          normal = normals[c.n]
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
        triangles.push({ vertices: [v0, v1, v2], normal })
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

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity

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
