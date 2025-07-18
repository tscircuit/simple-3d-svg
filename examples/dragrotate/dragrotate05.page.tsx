import DragRotate from "./DragRotate"

const scene = {
  boxes: [
    {
      center: { x: 5, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      color: "rgba(255,0,0,0.8)",
      topLabel: "X=5",
    },
    {
      center: { x: 0, y: 5, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      topLabel: "Y=5",
      color: "rgba(0,128,255,0.8)",
    },
    {
      center: { x: 0, y: 0, z: 5 },
      size: { x: 1, y: 1, z: 1 },
      topLabel: "Z=5",
      color: "rgba(255,128,0,0.8)",
    },
  ],
  camera: {
    position: { x: -10, y: 10, z: -10 },
    lookAt: { x: 0, y: 0, z: 0 },
  },
} as const

export default function Page() {
  return (
    <DragRotate
      scene={scene as any}
      opt={{
        showGrid: true,
        showAxes: true,
        showOrigin: true,
        backgroundColor: "white",
      }}
    />
  )
}
