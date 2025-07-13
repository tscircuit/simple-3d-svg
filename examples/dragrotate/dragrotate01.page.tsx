import DragRotate from "./DragRotate"

const objUrl =
  "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=6ef04b62f1e945518af209609f65fa6f&pn=C110153&cachebust_origin="

export default function Page() {
  return (
    <DragRotate
      scene={{
        boxes: [
          {
            center: { x: 0, y: 0, z: 0 },
            size: { x: 20, y: 20, z: 20 },
            objUrl,
            drawBoundingBox: true,
          },
        ],
        camera: {
          /* initial value – overwritten by component each frame */
          position: { x: 30, y: 0, z: 0 },
          lookAt: { x: 0, y: 0, z: 0 },
        },
      }}
    />
  )
}
