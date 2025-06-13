// Types for simple-3d-svg
export interface Point3 {
  x: number
  y: number
  z: number
}

export type RGBA = [number, number, number, number]
export type Color = RGBA | string

export interface Box {
  center: Point3
  size: Point3
  color?: Color
  rotation?: Point3 // Euler radians
  /** Draw the bounding box edges for debugging */
  drawBoundingBox?: boolean
  topLabel?: string
  topLabelColor?: Color
  faceImages?: {
    top?: string
  }
  projectionSubdivision?: number // Number of subdivisions per side for face projection (default: 2)
  // STL support
  stlUrl?: string
  stlRotation?: Point3
  stlPosition?: Point3
  /** When true, fit/normalize STL mesh to the box dimensions */
  scaleStlToBox?: boolean
  // OBJ support
  objUrl?: string
  objRotation?: Point3
  objPosition?: Point3
  /** When true, fit/normalize OBJ mesh to the box dimensions */
  scaleObjToBox?: boolean
}

export interface Camera {
  position: Point3
  lookAt: Point3
  focalLength?: number
}

export interface Scene {
  boxes: Box[]
  camera: Camera
}

export interface Triangle {
  vertices: [Point3, Point3, Point3]
  normal: Point3
  color?: Color
}

export interface STLMesh {
  triangles: Triangle[]
  boundingBox: {
    min: Point3
    max: Point3
  }
}
