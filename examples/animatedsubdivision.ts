import { renderScene } from "../lib"
import { CHECKER_10x10 } from "../tests/fixtures/checkerboard"

const svgContainer = document.getElementById("svg-container")!
const numberOfSubdivisions = document.getElementById("number-of-subdivisions")!

const totalFrames = 9
let current = 0

// Camera parameters
const cameraRadius = 2.0
const cameraHeight = 1.5
const cameraLookAt = { x: 0, y: -1, z: 0 }
const cameraFocalLength = 0.4

// Animation parameters
const frameDuration = 600 // ms for 45 degrees
const revolutionDuration = 2000 // ms for 45 degrees

let lastCameraPos = { x: 0, y: 0, z: 0 }
let lastFrameIdx = -1

async function renderFrame(
  idx: number,
  camPos: { x: number; y: number; z: number },
) {
  numberOfSubdivisions.textContent = `Number of faces: ${2 ** idx}`
  const svg = await renderScene(
    {
      boxes: [
        {
          center: { x: 0, y: 0, z: 0 },
          size: { x: 2, y: 2, z: 2 },
          color: "red",
          faceImages: {
            top: CHECKER_10x10,
          },
          projectionSubdivision: idx,
        },
      ],
      camera: {
        position: camPos,
        lookAt: cameraLookAt,
        focalLength: cameraFocalLength,
      },
    },
    {
      backgroundColor: "white",
    },
  )
  // Remove XML declaration if present for embedding
  svgContainer.innerHTML = svg.replace(/<\?xml[^>]*\?>\s*/g, "")
}

function animate() {
  const now = performance.now()
  // Compute angle in radians: every 600ms, 45deg = PI/4
  const angle =
    ((now % (8 * revolutionDuration)) / revolutionDuration) * (Math.PI / 4)
  // Full revolution in 8*600ms = 4800ms (360deg)
  const x = cameraRadius * Math.cos(angle)
  const z = cameraRadius * Math.sin(angle)
  const y = cameraHeight

  // Optionally, update subdivision every 600ms
  const frameIdx = Math.floor((now / frameDuration - 1) % totalFrames) + 1

  // Only re-render if camera or frame index changed
  if (
    lastCameraPos.x !== x ||
    lastCameraPos.y !== y ||
    lastCameraPos.z !== z ||
    lastFrameIdx !== frameIdx
  ) {
    lastCameraPos = { x, y, z }
    lastFrameIdx = frameIdx
    renderFrame(frameIdx, { x, y, z })
  }

  requestAnimationFrame(animate)
}

// Initial render
const initialAngle = 0
const initialX = cameraRadius * Math.cos(initialAngle)
const initialZ = cameraRadius * Math.sin(initialAngle)
const initialY = cameraHeight
renderFrame(current, { x: initialX, y: initialY, z: initialZ })

// Start animation loop
requestAnimationFrame(animate)
