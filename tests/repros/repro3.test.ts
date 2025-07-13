import { test, expect } from "bun:test"
import { renderScene } from "lib"
import { repro3 } from "./assets/repro03"

test("repro3", () => {
  const svg = renderScene(repro3, { backgroundColor: "gray" })
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
