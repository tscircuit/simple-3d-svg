import { test, expect } from "bun:test"
import { renderScene } from "lib"

const scene = {
  boxes: [
    {
      center: {
        x: 0,
        y: 0,
        z: 0,
      },
      size: {
        x: 12,
        y: 1.4,
        z: 30,
      },
      faceImages: {
        top: `data:image/svg+xml;base64,${btoa(`<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">                                       
            <circle cx="50" cy="10" r="20" fill="blue" />
            <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />                                            
          </svg>`)}`,
      },
      color: "rgba(0,140,0,0.8)",
    },
    {
      center: {
        x: 0,
        y: 1.7,
        z: -10.28749940000003,
      },
      size: {
        x: 9.85022159999998,
        y: 2,
        z: 6.773170299999838,
      },
      color: "rgba(128,128,128,0.9)",
      topLabel: "USBC",
      topLabelColor: "white",
    },
    {
      center: {
        x: 0,
        y: 1.7,
        z: 12,
      },
      size: {
        x: 2.7,
        y: 1,
        z: 1,
      },
      color: "rgba(128,128,128,0.9)",
      topLabel: "LED",
      topLabelColor: "white",
    },
    {
      center: {
        x: -5.684341886080802e-14,
        y: 1.7,
        z: 0,
      },
      size: {
        x: 8.499855999999784,
        y: 2,
        z: 6.499860000000115,
      },
      color: "rgba(128,128,128,0.9)",
      topLabel: "SW1",
      topLabelColor: "white",
    },
    {
      center: {
        x: 0,
        y: 1.7,
        z: 7,
      },
      size: {
        x: 2.7,
        y: 1,
        z: 1,
      },
      color: "rgba(128,128,128,0.9)",
      topLabel: "R1",
      topLabelColor: "white",
    },
  ],
  camera: {
    position: {
      x: -45,
      y: 45,
      z: -45,
    },
    lookAt: {
      x: 0,
      y: 0,
      z: 0,
    },
    focalLength: 2,
  },
}

test("repro2", () => {
  const svg = renderScene(scene, { backgroundColor: "gray" })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
