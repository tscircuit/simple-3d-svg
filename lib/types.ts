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
  color: Color
  rotation?: Point3 // Euler radians
  topLabel?: string
  topLabelColor?: Color
  stlUrl?: string
  stlRotationOffset?: Point3
  stlPositionOffset?: Point3
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
