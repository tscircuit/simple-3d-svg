import { test, expect } from "bun:test"
import { renderScene } from "../lib"

const pyramid3MF =
  "data:application/octet-stream;base64,UEsDBBQAAAAIAOqYDFu2wAHOCgEAAB8CAAAQABwAM0QvM2Rtb2RlbC5tb2RlbFVUCQAD55CbaOeQm2h1eAsAAQQAAAAABAAAAACNkE1ugzAQhfecwpp9GCCqVEWG7HKBNgcgZlJc+SeyDSI9fQ1O2qaoUjeW3uib5zeP7yet2EjOS2tqKPMCGBlhO2neaji+HjbPsG8yrm1Hig1Ghhq0VEpqCuSAxe2dameWzOb4sgyMr6EP4bJD9KIn3fpcS+Gst+eQC6tx2+nWDOdWhMHFf1BYR1gV5RMWFTQZY9yRt4MT5GcVtT29kwhMdjEisHC9UIwxR4IEREST7+8iynhSkF8GP4Y0samGeOZ1eT/mF/+gyn9RyatcUxzXKXhwMvalfiW7T9lYLoZjtTiO2xqqR8vVPsfv0zmmppYS8aFFfhqk6m6YDKRZQlOnmDZuTLScy22yT1BLAwQUAAAACADsmAxbKoKq17AAAADhAAAAEwAcAFtDb250ZW50X1R5cGVzXS54bWxVVAkAA+yQm2jskJtodXgLAAEEAAAAAAQAAAAALY5NroJAEIT3nGLSWwODvsQYA7jw5wR6gM7QIJHpmTCN0du/Rl1WqvLVVx1efjRPmtIQuIZ1UYIhdqEduK/hdr3kOzg0WXV9R0pGt5xquIvEvbXJ3cljKkIk1qYLk0fROPU2ontgT3ZTllvrAgux5LIwoMmMqU7U4TyKOb+0+V770NII5vgdL381YIzj4FB0YJ/cFj7lP3Lx13rkuUMn86SuueYFsFIRsCpsP8ZN9g9QSwECHgMUAAAACADqmAxbtsABzgoBAAAfAgAAEAAYAAAAAAABAAAApIEAAAAAM0QvM2Rtb2RlbC5tb2RlbFVUBQAD55CbaHV4CwABBAAAAAAEAAAAAFBLAQIeAxQAAAAIAOyYDFsqgqrXsAAAAOEAAAATABgAAAAAAAEAAACkgVQBAABbQ29udGVudF9UeXBlc10ueG1sVVQFAAPskJtodXgLAAEEAAAAAAQAAAAAUEsFBgAAAAACAAIArwAAAFECAAAAAA=="

test("3MF rendering", async () => {
  const scene = {
    boxes: [
      {
        center: { x: 0, y: 0, z: 0 },
        size: { x: 2, y: 2, z: 2 },
        color: "red" as const,
        threeMfUrl: pyramid3MF,
        scaleThreeMfToBox: true,
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
