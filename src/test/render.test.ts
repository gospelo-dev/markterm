import { afterAll, describe, expect, test } from "bun:test"
import { dispose, markdownToImage, markdownToImageBands, measureCutCandidates } from "../render/screenshot.js"
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

const TALL_DOC = Array.from(
  { length: 80 },
  (_, i) => `Paragraph ${i} with enough words in it to wrap onto a second line at three hundred pixels.`,
).join("\n\n")

describe("markdownToImageBands", () => {
  test(
    "returns the whole render as the only band when it fits",
    async () => {
      const r = await markdownToImageBands("# Hello\n\nshort\n", {
        width: 300,
        deviceScaleFactor: 1,
        maxBandHeight: 10_000,
      })
      expect(r.bands.length).toBe(1)
      expect(r.bands[0]).toBe(r.png)
    },
    60_000,
  )

  test(
    "splits a tall render into bands no taller than maxBandHeight that add up to the whole",
    async () => {
      const r = await markdownToImageBands(TALL_DOC, {
        colors: fallbackTheme("light"),
        width: 300,
        deviceScaleFactor: 1,
        maxBandHeight: 600,
      })
      const full = pngSize(r.png)
      expect(full.height).toBeGreaterThan(1200)
      expect(r.bands.length).toBeGreaterThanOrEqual(3)
      let sum = 0
      for (const band of r.bands) {
        expect(Array.from(band.slice(0, 8))).toEqual(PNG_MAGIC)
        const s = pngSize(band)
        expect(s.width).toBe(full.width)
        expect(s.height).toBeGreaterThan(0)
        expect(s.height).toBeLessThanOrEqual(600)
        sum += s.height
      }
      expect(Math.abs(sum - full.height)).toBeLessThanOrEqual(r.bands.length)
    },
    60_000,
  )

  test(
    "respects the limit at device scale factor 2",
    async () => {
      const r = await markdownToImageBands(TALL_DOC, { width: 300, deviceScaleFactor: 2, maxBandHeight: 1000 })
      expect(r.bands.length).toBeGreaterThanOrEqual(2)
      for (const band of r.bands) expect(pngSize(band).height).toBeLessThanOrEqual(1000)
    },
    60_000,
  )
})

describe("measureCutCandidates", () => {
  test(
    "a long table yields one candidate per row boundary, evenly spaced",
    async () => {
      const rows = Array.from({ length: 120 }, (_, i) => `| ${i} | row ${i} |`).join("\n")
      const m = await measureCutCandidates(`| n | text |\n|---|---|\n${rows}\n`, { width: 300, deviceScaleFactor: 1 })
      // header row + 120 body rows = 121 rows, 120 row boundaries; the table is the only block
      expect(m.gaps).toEqual([])
      expect(m.inner.length).toBe(120)
      const diffs = m.inner.slice(1).map((y, i) => y - m.inner[i])
      expect(Math.max(...diffs) - Math.min(...diffs)).toBeLessThan(1)
    },
    60_000,
  )

  test(
    "wrapped paragraphs yield a gap per block boundary and line boundaries inside, all within the body",
    async () => {
      const m = await measureCutCandidates(TALL_DOC, { width: 300, deviceScaleFactor: 1 })
      expect(m.gaps.length).toBe(79)
      expect(m.inner.length).toBeGreaterThanOrEqual(40)
      for (const y of [...m.gaps, ...m.inner]) {
        expect(y).toBeGreaterThan(0)
        expect(y).toBeLessThan(m.height)
      }
    },
    60_000,
  )

  test(
    "never places a candidate inside an image",
    async () => {
      const img = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="display:block;width:100px;height:1500px">'
      const m = await measureCutCandidates(`before\n\n${img}\n\nafter\n`, { width: 300, deviceScaleFactor: 1 })
      // p, img, p: exactly the two gaps between blocks and nothing inside
      expect(m.gaps.length).toBe(2)
      expect(m.gaps[1] - m.gaps[0]).toBeGreaterThan(1500)
      expect(m.inner).toEqual([])
    },
    60_000,
  )

  test(
    "treats an inline image as part of its line inside a paragraph",
    async () => {
      const img = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="width:100px;height:900px">'
      const md = `first line of the paragraph ${img} same paragraph continues after the image with more words\n\nafter\n`
      const m = await measureCutCandidates(md, { width: 300, deviceScaleFactor: 1 })
      // Candidates may sit between the paragraph's lines and between the two blocks,
      // but none inside the 900 px image: two consecutive candidates must span it.
      const all = [...m.gaps, ...m.inner].sort((a, b) => a - b)
      const diffs = all.slice(1).map((y, i) => y - all[i])
      expect(Math.max(...diffs, all[0])).toBeGreaterThan(900)
    },
    60_000,
  )

  test(
    "bands of a document made of short blocks are cut in the gaps between blocks",
    async () => {
      const m = await measureCutCandidates(TALL_DOC, { width: 300, deviceScaleFactor: 1 })
      const r = await markdownToImageBands(TALL_DOC, { width: 300, deviceScaleFactor: 1, maxBandHeight: 600 })
      let y = 0
      for (const band of r.bands.slice(0, -1)) {
        y += pngSize(band).height
        // each cut coincides with a measured block gap (rounded to a pixel)
        expect(m.gaps.some((g) => Math.abs(g - y) <= 0.5)).toBe(true)
      }
    },
    60_000,
  )
})
