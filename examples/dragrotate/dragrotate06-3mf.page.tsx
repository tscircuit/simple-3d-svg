import DragRotate from "./DragRotate"

const scene = {
  boxes: [
    {
      center: { x: 0, y: 0, z: 0 },
      size: { x: 10, y: 10, z: 10 },
      color: "rgba(100,149,237,0.8)",
      threeMfUrl: "https://github.com/3MFConsortium/3mf-samples/raw/refs/heads/master/examples/core/heartgears.3mf",
      scaleThreeMfToBox: true,
    },
  ],
  camera: {
    position: { x: -15, y: 15, z: -15 },
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