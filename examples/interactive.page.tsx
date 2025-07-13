import { useState } from "react"
import DragRotate from "./dragrotate/DragRotate"
import type { Scene } from "../lib/types"

const defaultScene: Scene = {
  boxes: [
    {
      center: { x: 0, y: 0, z: 0 },
      size: { x: 2, y: 2, z: 2 },
      color: "rgba(255, 0, 0, 0.9)",
      topLabel: "Hello World",
      topLabelColor: "white",
    },
    {
      center: { x: 3, y: 0, z: 0 },
      size: { x: 2, y: 2, z: 2 },
      color: [0, 128, 255, 0.9],
    },
  ],
  camera: { position: { x: 30, y: 0, z: 0 }, lookAt: { x: 0, y: 0, z: 0 } },
}

export default function InteractivePage() {
  const [sceneText, setSceneText] = useState(
    JSON.stringify(defaultScene, null, 2),
  )
  const [scene, setScene] = useState<Scene>(defaultScene)
  const [error, setError] = useState<string | null>(null)

  const handleSceneChange = (value: string) => {
    setSceneText(value)
    try {
      const parsed = JSON.parse(value)
      setScene(parsed)
      setError(null)
    } catch (jsonErr) {
      // Try eval for JavaScript object syntax
      try {
        const parsed = eval(`(${value})`)
        setScene(parsed)
        setError(null)
      } catch (evalErr) {
        setError(
          jsonErr instanceof Error
            ? jsonErr.message
            : "Invalid JSON/JavaScript",
        )
      }
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "monospace" }}>
      <div
        style={{ width: "50%", padding: "20px", borderRight: "1px solid #ccc" }}
      >
        <h2>Scene Configuration</h2>
        <p>Paste your scene JSON here:</p>
        <textarea
          value={sceneText}
          onChange={(e) => handleSceneChange(e.target.value)}
          style={{
            width: "100%",
            height: "70%",
            fontFamily: "monospace",
            fontSize: "12px",
            border: error ? "2px solid red" : "1px solid #ccc",
            padding: "10px",
            resize: "vertical",
          }}
          placeholder="Enter scene JSON..."
        />
        {error && (
          <div style={{ color: "red", marginTop: "10px", fontSize: "14px" }}>
            Error: {error}
          </div>
        )}
        <div style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
          <p>Supports both JSON and JavaScript object syntax:</p>
          <pre
            style={{ fontSize: "11px", background: "#f5f5f5", padding: "5px" }}
          >
            {`{
  boxes: [{
    center: { x: 0, y: 0, z: 0 },
    size: { x: 2, y: 2, z: 2 },
    color: "red",
    topLabel: "Hello"
  }],
  camera: {
    position: { x: 30, y: 0, z: 0 },
    lookAt: { x: 0, y: 0, z: 0 }
  }
}`}
          </pre>
        </div>
      </div>
      <div
        style={{
          width: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!error && <DragRotate scene={scene} />}
        {error && (
          <div style={{ color: "red", textAlign: "center" }}>
            <h3>Cannot render scene</h3>
            <p>Please fix the JSON syntax error</p>
          </div>
        )}
      </div>
    </div>
  )
}
