import DragRotate from "./DragRotate"

const scene = {
  boxes: [
    {
      center: { x: 0, y: 0, z: 0 },
      size: { x: 12, y: 1.4, z: 30 },
      faceImages: {
        top: "data:image/svg+xml;base64,PHN2ZyB0cmFuc2Zvcm09J3NjYWxlKDEsIC0xKScgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iODAwIiBoZWlnaHQ9IjIwMDAiPjxzdHlsZT48L3N0eWxlPjxyZWN0IGNsYXNzPSJib3VuZGFyeSIgeD0iMCIgeT0iMCIgZmlsbD0idHJhbnNwYXJlbnQiIHdpZHRoPSI4MDAiIGhlaWdodD0iMjAwMCIvPjxyZWN0IGNsYXNzPSJwY2ItcGFkIiBmaWxsPSIjZmZlMDY2IiB4PSIyNzMuMzI5MzUzMzMzMzI4MjQiIHk9IjE0NjAuMDYwOTUwMDAwMDA3MyIgd2lkdGg9IjE5Ljk5OTk1OTk5OTk5OTk5OCIgaGVpZ2h0PSI4Ni42NjY0OTMzMzMzMzMzNCIvPjxyZWN0IGNsYXNzPSJwY2ItcGFkIiBmaWxsPSIjZmZlMDY2IiB4PSIzMDYuNjcxMDg2NjY2NjcwNyIgeT0iMTQ2MC4wNjA5NTAwMDAwMDczIiB3aWR0aD0iMTkuOTk5OTU5OTk5OTk5OTk4IiBoZWlnaHQ9Ijg2LjY2NjQ5MzMzMzMzMzM0Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjMzOS45OTU4ODY2NjY2Njk1NSIgeT0iMTQ2MC4wNjA5NTAwMDAwMDczIiB3aWR0aD0iMTkuOTk5OTU5OTk5OTk5OTk4IiBoZWlnaHQ9Ijg2LjY2NjQ5MzMzMzMzMzM0Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjM3My4zMzc2MjAwMDAwMDQ0IiB5PSIxNDYwLjA2MDk1MDAwMDAwNzMiIHdpZHRoPSIxOS45OTk5NTk5OTk5OTk5OTgiIGhlaWdodD0iODYuNjY2NDkzMzMzMzMzMzQiLz48cmVjdCBjbGFzcz0icGNiLXBhZCIgZmlsbD0iI2ZmZlMDY2IiB4PSI0MDYuNjYyNDE5OTk5OTk1NiIgeT0iMTQ2MC4wNjA5NTAwMDAwMDczIiB3aWR0aD0iMTkuOTk5OTU5OTk5OTk5OTk4IiBoZWlnaHQ9Ijg2LjY2NjQ5MzMzMzMzMzM0Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjQ0MC4wMDQxNTMzMzMzMzA0NiIgeT0iMTQ2MC4wNjA5NTAwMDAwMDczIiB3aWR0aD0iMTkuOTk5OTU5OTk5OTk5OTk4IiBoZWlnaHQ9Ijg2LjY2NjQ5MzMzMzMzMzM0Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjQ3My4zMTIwMTk5OTk5OTMyNSIgeT0iMTQ2MC4wNjA5NTAwMDAwMDczIiB3aWR0aD0iMTkuOTk5OTU5OTk5OTk5OTk4IiBoZWlnaHQ9Ijg2LjY2NjQ5MzMzMzMzMzM0Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjUwNi42NzA2ODY2NjY2NzE3NyIgeT0iMTQ2MC4wNjA5NTAwMDAwMDczIiB3aWR0aD0iMTkuOTk5OTU5OTk5OTk5OTk4IiBoZWlnaHQ9Ijg2LjY2NjQ5MzMzMzMzMzM0Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjE2Ni42NjYyODY2NjY2NjYxNCIgeT0iMTQ2MC4wNjA5NTAwMDAwMDczIiB3aWR0aD0iMTkuOTk5OTU5OTk5OTk5OTk4IiBoZWlnaHQ9Ijg2LjY2NjQ5MzMzMzMzMzM0Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjE4Ni42NjQ1NTMzMzMzMzQxNyIgeT0iMTQ2MC4wNjA5NTAwMDAwMDczIiB3aWR0aD0iMTkuOTk5OTU5OTk5OTk5OTk4IiBoZWlnaHQ9Ijg2LjY2NjQ5MzMzMzMzMzM0Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjIyMC4wMDYyODY2NjY2NjkwNCIgeT0iMTQ2MC4wNjA5NTAwMDAwMDczIiB3aWR0aD0iMTkuOTk5OTU5OTk5OTk5OTk4IiBoZWlnaHQ9Ijg2LjY2NjQ5MzMzMzMzMzM0Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjI0MC4wMDQ1NTMzMzMzMjk0NSIgeT0iMTQ2MC4wNjA5NTAwMDAwMDczIiB3aWR0aD0iMTkuOTk5OTU5OTk5OTk5OTk4IiBoZWlnaHQ9Ijg2LjY2NjQ5MzMzMzMzMzM0Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjUzOS45OTU0ODY2NjY2NzA2IiB5PSIxNDYwLjA2MDk1MDAwMDAwNzMiIHdpZHRoPSIxOS45OTk5NTk5OTk5OTk5OTgiIGhlaWdodD0iODYuNjY2NDkzMzMzMzMzMzQiLz48cmVjdCBjbGFzcz0icGNiLXBhZCIgZmlsbD0iI2ZmZlMDY2IiB4PSI1NjAuMDEwNjg2NjY2NjY3IiB5PSIxNDYwLjA2MDk1MDAwMDAwNzMiIHdpZHRoPSIxOS45OTk5NTk5OTk5OTk5OTgiIGhlaWdodD0iODYuNjY2NDkzMzMzMzMzMzQiLz48cmVjdCBjbGFzcz0icGNiLXBhZCIgZmlsbD0iI2ZmZlMDY2IiB4PSI1OTMuMzM1NDg2NjY2NjczNCIgeT0iMTQ2MC4wNjA5NTAwMDAwMDczIiB3aWR0aD0iMTkuOTk5OTU5OTk5OTk5OTk4IiBoZWlnaHQ9Ijg2LjY2NjQ5MzMzMzMzMzM0Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjYxMy4zMzM3NTMzMzMzMzM4IiB5PSIxNDYwLjA2MDk1MDAwMDAwNzMiIHdpZHRoPSIxOS45OTk5NTk5OTk5OTk5OTgiIGhlaWdodD0iODYuNjY2NDkzMzMzMzMzMzQiLz48cmVjdCBjbGFzcz0icGNiLXBhZCIgZmlsbD0iI2ZmZlMDY2IiB4PSIzMTAiIHk9IjE2Ni42NjY2NjY2NjY2NjY1NCIgd2lkdGg9IjY2LjY2NjY2NjY2NjY2NjY3IiBoZWlnaHQ9IjY2LjY2NjY2NjY2NjY2NjY3Ii8+PHJlY3QgY2xhc3M9InBjYi1wYWQiIGZpbGw9IiNmZmUwNjYiIHg9IjQyMy4zMzMzMzMzMzMzMzMzNyIgeT0iMTY2LjY2NjY2NjY2NjY2NjU0IiB3aWR0aD0iNjYuNjY2NjY2NjY2NjY2NjciIGhlaWdodD0iNjYuNjY2NjY2NjY2NjY2NjciLz48Y2lyY2xlIGNsYXNzPSJwY2ItaG9sZSIgY3g9IjIwNi42NzIxMzMzMzMzMjg2MiIgY3k9IjE1ODcuOTU5MjYzMzMzMzM4MiIgcj0iMjUuMDAwMzczMzMzMzMzMzMyIiBmaWxsPSJyZ2JhKDAsMCwwLDAuNSkiLz48Y2lyY2xlIGNsYXNzPSJwY2ItaG9sZSIgY3g9IjU5My4zMjc4NjY2NjY2NzE0IiBjeT0iMTU4Ny45NTkyNjMzMzMzMzgzIiByPSIyNS4wMDAzNzMzMzMzMzMzMyIgZmlsbD0icmdiYSgwLDAsMCwwLjUpIi8+",
      },
      projectionSubdivision: 10,
      color: "rgba(0,140,0,0.8)",
    },
    {
      center: { x: 0, y: 0.7, z: -12.78749940000003 },
      size: { x: 9.85022159999998, y: 2, z: 6.773170299999838 },
      topLabel: "USBC",
      topLabelColor: "white",
      objUrl:
        "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=2a4bc2358b36497d9ab2a66ab6419ba3&pn=C165948&cachebust_origin=",
      objRotation: { x: -1.5707963267948966, y: 6.283185307179586, z: 0 },
    },
    {
      center: { x: 0, y: 0.7, z: 12 },
      size: { x: 2.7, y: 2, z: 1 },
      topLabel: "LED",
      topLabelColor: "white",
    },
    {
      center: { x: -5.684341886080802e-14, y: 3.8, z: 0 },
      size: { x: 8.499855999999784, y: 2, z: 6.499860000000115 },
      topLabel: "SW1",
      topLabelColor: "white",
      objUrl:
        "https://modelcdn.tscircuit.com/easyeda_models/download?uuid=6ef04b62f1e945518af209609f65fa6f&pn=C110153&cachebust_origin=",
      objRotation: { x: -1.5707963267948966, y: 3.141592653589793, z: 0 },
    },
    {
      center: { x: 0, y: 0.7, z: 7 },
      size: { x: 2.7, y: 2, z: 1 },
      topLabel: "R1",
      topLabelColor: "white",
    },
    {
      center: { x: 0, y: 1.2, z: 12 },
      size: { x: 2.7, y: 1, z: 1 },
      color: "rgba(128,128,128,0.5)",
      topLabel: "LED",
      topLabelColor: "white",
    },
    {
      center: { x: 0, y: 1.2, z: 7 },
      size: { x: 2.7, y: 1, z: 1 },
      color: "rgba(128,128,128,0.5)",
      topLabel: "R1",
      topLabelColor: "white",
    },
  ],
  camera: {
    position: { x: -45, y: 45, z: -45 },
    lookAt: { x: 0, y: 0, z: 0 },
    focalLength: 2,
  },
} as const

export default function Page() {
  return <DragRotate scene={scene} opt={{ backgroundColor: "gray" }} />
}
