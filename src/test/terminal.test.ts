import { describe, expect, test } from "bun:test"
import { estimateViewportWidth, getTerminalSize } from "../terminal.js"

describe("getTerminalSize", () => {
  test("returns columns and rows, defaulting to 80x24 without a TTY", () => {
    const size = getTerminalSize()
    expect(size.cols).toBe(process.stdout.columns || 80)
    expect(size.rows).toBe(process.stdout.rows || 24)
  })

  test("does not report pixel dimensions in this version", () => {
    const size = getTerminalSize()
    expect(size.pixelWidth).toBeNull()
    expect(size.pixelHeight).toBeNull()
  })
})

describe("estimateViewportWidth", () => {
  test("uses columns x 8px divided by the device scale factor", () => {
    const cols = getTerminalSize().cols
    expect(estimateViewportWidth(2)).toBe(Math.round((cols * 8) / 2))
    expect(estimateViewportWidth(1)).toBe(cols * 8)
  })
})
