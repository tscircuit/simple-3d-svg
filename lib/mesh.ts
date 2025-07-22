import type { Point3, STLMesh, Box } from "./types"
import { add, sub, scale, rotLocal } from "./vec3"

export function scaleAndPositionMesh(
  mesh: STLMesh,
  box: Box,
  scaleToBox: boolean,
  modelType: "stl" | "obj",
): Point3[] {
  const { boundingBox } = mesh
  const meshCenter = scale(add(boundingBox.min, boundingBox.max), 0.5)
  const centerModel = box.centerModel !== false

  // Rotate vertices around the mesh center
  const rotatedVerts: Point3[] = []
  for (const tri of mesh.triangles) {
    for (const v of tri.vertices) {
      let p = sub(v, meshCenter)
      if (modelType === "stl" && box.stlRotation)
        p = rotLocal(p, box.stlRotation)
      if (modelType === "obj" && box.objRotation)
        p = rotLocal(p, box.objRotation)
      if (!centerModel) p = add(p, meshCenter)
      rotatedVerts.push(p)
    }
  }

  let uniformScale = 1
  let rotatedCenter = { x: 0, y: 0, z: 0 }

  if (scaleToBox) {
    // Compute bounding box after rotation
    let min = { x: Infinity, y: Infinity, z: Infinity }
    let max = { x: -Infinity, y: -Infinity, z: -Infinity }
    for (const v of rotatedVerts) {
      if (v.x < min.x) min.x = v.x
      if (v.y < min.y) min.y = v.y
      if (v.z < min.z) min.z = v.z
      if (v.x > max.x) max.x = v.x
      if (v.y > max.y) max.y = v.y
      if (v.z > max.z) max.z = v.z
    }
    const rotatedSize = sub(max, min)
    const boxSize = box.size
    const scaleX = boxSize.x / rotatedSize.x
    const scaleY = boxSize.y / rotatedSize.y
    const scaleZ = boxSize.z / rotatedSize.z
    uniformScale = Math.min(scaleX, scaleY, scaleZ)
    rotatedCenter = scale(add(min, max), 0.5)
  }

  const transformedVertices: Point3[] = []
  for (const p of rotatedVerts) {
    let t = p
    if (scaleToBox) {
      t = sub(t, rotatedCenter)
      t = scale(t, uniformScale)
      if (!centerModel) t = add(t, rotatedCenter)
    }
    if (box.stlPosition) t = add(t, box.stlPosition)
    if (box.objPosition) t = add(t, box.objPosition)
    if (box.rotation) t = rotLocal(t, box.rotation)
    t = add(t, box.center)
    transformedVertices.push(t)
  }

  return transformedVertices
}
