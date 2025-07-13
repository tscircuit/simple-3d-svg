import { useEffect, useRef, useState } from "react"
import { renderScene } from "../../lib"
import type { Scene } from "../../lib/types"

type Opt = Parameters<typeof renderScene>[1]

interface Props {
  scene: Scene
  opt?: Opt
}

export default function DragRotate({ scene, opt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // camera / drag state
  const yaw   = useRef(0.6)
  const pitch = useRef(0.3)
  const radius = 30
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })

  // viewport size – updated on every window resize
  const [size, setSize] = useState({ width: 0, height: 0 })

  const [svg, setSvg] = useState("")

  // helper to (re-)render
  const redraw = async () => {
    if (!size.width || !size.height) return          // size unknown yet
    const dim = Math.min(size.width, size.height)    // keep square aspect
    const camPos = {
      x: radius * Math.cos(pitch.current) * Math.cos(yaw.current),
      y: radius * Math.sin(pitch.current),
      z: radius * Math.cos(pitch.current) * Math.sin(yaw.current),
    }

    const svgText = await renderScene(
      { ...scene, camera: { ...scene.camera, position: camPos } },
      { ...opt, width: dim, height: dim },
    )
    setSvg(svgText.replace(/<\?xml[^>]*\?>\s*/g, ""))
  }

  /* initial render + event handling */
  useEffect(() => {
    redraw()

    const md = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) return
      dragging.current = true
      last.current = { x: e.clientX, y: e.clientY }
    }
    const mm = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - last.current.x
      const dy = e.clientY - last.current.y
      last.current = { x: e.clientX, y: e.clientY }
      yaw.current += dx * 0.01
      pitch.current += dy * 0.01
      const lim = Math.PI / 2 - 0.01
      if (pitch.current >  lim) pitch.current =  lim
      if (pitch.current < -lim) pitch.current = -lim
      redraw()
    }
    const mu = () => { dragging.current = false }

    window.addEventListener("mousedown", md)
    window.addEventListener("mousemove", mm)
    window.addEventListener("mouseup",   mu)
    return () => {
      window.removeEventListener("mousedown", md)
      window.removeEventListener("mousemove", mm)
      window.removeEventListener("mouseup",   mu)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, opt, size])    // also when window size changes

  // track window-resize to keep `size` current
  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight })
    update()                       // initialise once mounted
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ cursor: "grab", width: "100vmin", height: "100vmin" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
