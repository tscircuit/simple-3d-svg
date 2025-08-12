import { test, expect } from "bun:test"
import { renderScene } from "../lib"

const pyramid3MF =
  "data:model/3mf;base64,UEsDBAoAAAAAAPaYDFu7VpL0PQEAAD0BAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04Ij8+PFR5cGVzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L2NvbnRlbnQtdHlwZXMiPjxEZWZhdWx0IEV4dGVuc2lvbj0icmVscyIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1wYWNrYWdlLnJlbGF0aW9uc2hpcHMreG1sIi8+PERlZmF1bHQgRXh0ZW5zaW9uPSJtb2RlbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5tcy1wYWNrYWdlLjNkbWFudWZhY3R1cmluZy0zZG1vZGVsK3htbCIvPjwvVHlwZXM+UEsDBAoAAAAAAPaYDFsAAAAAAAAAAAAAAAAGAAAAX3JlbHMvUEsDBAoAAAAAAPaYDFur9/5HAgEAAAIBAAALAAAAX3JlbHMvLnJlbHM8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCI/PjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPjxSZWxhdGlvbnNoaXAgVGFyZ2V0PSIvM0QvM2Rtb2RlbC5tb2RlbCIgSWQ9InJlbDAiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vM2RtYW51ZmFjdHVyaW5nLzIwMTMvMDEvM2Rtb2RlbCIvPjwvUmVsYXRpb25zaGlwcz5QSwMECgAAAAAA9pgMWwAAAAAAAAAAAAAAAAMAAAAzRC9QSwMECgAAAAAA9pgMW7ih+u+SAQAAkgEAABAAAAAzRC8zZG1vZGVsLm1vZGVsPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48bW9kZWwgdW5pdD0ibWlsbGltZXRlciIgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vM2RtYW51ZmFjdHVyaW5nL2NvcmUvMjAxNS8wMiI+PHJlc291cmNlcz48b2JqZWN0IGlkPSIxIiB0eXBlPSJtb2RlbCI+PG1lc2g+PHZlcnRpY2VzPjx2ZXJ0ZXggeD0iMCIgeT0iMCIgej0iMCIvPjx2ZXJ0ZXggeD0iMSIgeT0iMCIgej0iMCIvPjx2ZXJ0ZXggeD0iMCIgeT0iMSIgej0iMCIvPjwvdmVydGljZXM+PHRyaWFuZ2xlcz48dHJpYW5nbGUgdjE9IjAiIHYyPSIxIiB2Mz0iMiIvPjwvdHJpYW5nbGVzPjwvbWVzaD48L29iamVjdD48L3Jlc291cmNlcz48YnVpbGQ+PGl0ZW0gb2JqZWN0aWQ9IjEiLz48L2J1aWxkPjwvbW9kZWw+UEsBAhQACgAAAAAA9pgMW7tWkvQ9AQAAPQEAABMAAAAAAAAAAAAAAAAAAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAKAAAAAAD2mAxbAAAAAAAAAAAAAAAABgAAAAAAAAAAABAAAABuAQAAX3JlbHMvUEsBAhQACgAAAAAA9pgMW6v3/kcCAQAAAgEAAAsAAAAAAAAAAAAAAAAAkgEAQ19yZWxzLy5yZWxzUEsBAhQACgAAAAAA9pgMWwAAAAAAAAAAAAAAAAMAAAAAAAAAAAAQAAAAvQIAADNEL1BLAQIUAAoAAAAAAPaYDFu4ofrvkgEAAJIBAAAQAAAAAAAAAAAAAAAAAN4CAAAzRC8zZG1vZGVsLm1vZGVsUEsFBgAAAAAFAAUAHQEAAJ4EAAAAAA=="

test("3MF rendering", async () => {
  const scene = {
    boxes: [
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "red" as const,
        threeMFUrl: pyramid3MF,
        scaleThreeMFToBox: true,
      },
    ],
    camera: {
      position: { x: 5, y: 5, z: 5 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  }

  const svg = await renderScene(scene)
  expect(svg).toContain("<svg")
  expect(svg).toContain("</svg>")
  expect(svg).toContain("polygon")

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
