import DragRotate from "./DragRotate"

export default function Page() {
  return (
    <DragRotate
      scene={{
        boxes: [
          {
            center: { x: 0, y: 0, z: 0 },
            size: { x: 4, y: 4, z: 4 },
            color: "rgba(255,0,0,0.7)", // red cube
          },
          {
            center: { x: 2, y: 0, z: 0 },
            size: { x: 4, y: 2, z: 2 },
            color: "rgba(0,0,255,0.7)", // blue cube
          },
        ],
        camera: {
          /* initial – DragRotate will update this each frame */
          position: { x: 10, y: 6, z: 10 },
          lookAt: { x: 1, y: 0, z: 0 },
        },
      }}
    />
  )
}
