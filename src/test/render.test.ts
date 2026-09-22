import { afterAll, describe, expect, test } from "bun:test"
import { dispose, markdownToImage } from "../render/screenshot.js"
import { fallbackTheme } from "../render/themes.js"

// Integration tests: these launch headless Chromium via Playwright.
// Requires `bunx playwright install chromium`. The Mermaid case also needs network access.

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function pngSize(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

afterAll(async () => {
  await dispose()
})

describe("markdownToImage", () => {
  test(
    "renders a PNG whose pixel width is viewport width x device scale factor",
    async () => {
      const png = await markdownToImage("# Hello\n\nplain paragraph\n", {
        colors: fallbackTheme("light"),
        width: 400,
        deviceScaleFactor: 2,
      })
      expect(Array.from(png.slice(0, 8))).toEqual(PNG_MAGIC)
      const { width, height } = pngSize(png)
      expect(width).toBe(800)
      expect(height).toBeGreaterThan(0)
    },
    60_000,
  )

  test(
    "honors a scale factor of 1",
    async () => {
      const png = await markdownToImage("x", { width: 300, deviceScaleFactor: 1 })
      expect(pngSize(png).width).toBe(300)
    },
    60_000,
  )

  test(
    "renders a document containing a Mermaid diagram",
    async () => {
      const png = await markdownToImage("```mermaid\ngraph LR\n  A --> B\n```\n", {
        width: 400,
        deviceScaleFactor: 1,
      })
      expect(Array.from(png.slice(0, 8))).toEqual(PNG_MAGIC)
      // A rendered flowchart is taller than the single raw text line it replaces.
      expect(pngSize(png).height).toBeGreaterThan(120)
    },
    60_000,
  )
})
