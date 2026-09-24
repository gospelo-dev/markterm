import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { dispose } from "../render/screenshot.js"
import { Viewer, viewportFor, type ViewerSize } from "../viewer/viewer.js"

const dir = mkdtempSync(join(tmpdir(), "markterm-viewer-"))
const filler = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} with some words.`).join("\n\n")
const A = join(dir, "a.md")
const B = join(dir, "b.md")
writeFileSync(A, `# A\n\n[next](b.md) [web](https://example.com/x) [jump](#part-two)\n\n${filler}\n\n## Part two\n\nend\n`)
writeFileSync(B, "# B\n\n[back to part two](a.md#part-two)\n")

const size: ViewerSize = { cols: 80, rows: 24, cell: { width: 10, height: 20 } }

let viewer: Viewer
let output: string[]
let opened: string[]

async function open(path: string) {
  await viewer.open({ source: readFileSync(path, "utf-8"), path, basePath: dir })
}

/** The terminal cell over the centre of the first element matching a selector. */
async function cellOf(selector: string): Promise<{ x: number; y: number }> {
  const page = (viewer as unknown as { page: import("playwright").Page }).page
  const c = await page.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, selector)
  return { x: Math.floor(c.x / size.cell.width) + 1, y: Math.floor(c.y / size.cell.height) + 1 }
}

async function click(selector: string) {
  // Measure the link where it is on screen, after pending frames
  await viewer.idle()
  const { x, y } = await cellOf(selector)
  return viewer.handle({ type: "click", x, y })
}

beforeAll(async () => {
  output = []
  opened = []
  viewer = await Viewer.create({
    output: { write: (s: string) => output.push(s) },
    size,
    scale: 1,
    render: { highlight: false },
    openExternal: (url) => opened.push(url),
  })
})

afterAll(async () => {
  await viewer.close()
  await dispose()
  rmSync(dir, { recursive: true, force: true })
})

describe("Viewer", () => {
  test("viewportFor fills the cells above the status line", () => {
    expect(viewportFor(size, 1)).toEqual({ width: 800, height: 460 })
    expect(viewportFor(size, 2)).toEqual({ width: 400, height: 230 })
  })

  test("opening draws a frame placed in cells, and a status line", async () => {
    output.length = 0
    await open(A)
    const frame = output.join("")
    expect(frame).toContain("\x1b_Ga=T,f=100,i=")
    expect(frame).toContain("c=80,r=23,C=1")
    expect(frame).toContain("\x1b[24;1H")
    expect(frame).toContain(" a.md ")
    expect(frame).toContain("Top")
  }, 30_000)

  test("each frame replaces the previous image by id", async () => {
    output.length = 0
    await viewer.handle({ type: "key", key: "j" })
    await viewer.handle({ type: "key", key: "j" })
    await viewer.idle()
    const frames = output.join("")
    const ids = [...frames.matchAll(/a=T,f=100,i=(\d)/g)].map((m) => m[1])
    expect(ids.length).toBe(2)
    expect(ids[0]).not.toBe(ids[1])
    expect(frames).toContain(`\x1b_Ga=d,d=I,i=${ids[0]},q=2\x1b\\`)
  }, 30_000)

  test("keys scroll by lines and pages, and to the top and bottom", async () => {
    await viewer.handle({ type: "key", key: "g" })
    expect(viewer.scrollTop).toBe(0)
    await viewer.handle({ type: "key", key: "j" })
    expect(viewer.scrollTop).toBe(40)
    await viewer.handle({ type: "key", key: " " })
    expect(viewer.scrollTop).toBe(40 + 23 * 20 - 40)
    await viewer.handle({ type: "wheel", direction: "up", x: 1, y: 1 })
    expect(viewer.scrollTop).toBe(460 - 60)
    output.length = 0
    await viewer.handle({ type: "key", key: "G" })
    await viewer.idle()
    expect(viewer.scrollTop).toBeGreaterThan(460)
    expect(output.join("")).toContain("Bot")
    await viewer.handle({ type: "key", key: "G" })
    const bottom = viewer.scrollTop
    await viewer.handle({ type: "key", key: "j" })
    expect(viewer.scrollTop).toBe(bottom)
  }, 30_000)

  test("a burst of wheel events collapses into a few frames and stops at the latest position", async () => {
    await viewer.handle({ type: "key", key: "g" })
    await viewer.idle()
    output.length = 0
    // Like trackpad momentum: many events arriving faster than frames can be drawn
    for (let i = 0; i < 10; i++) await viewer.handle({ type: "wheel", direction: "down", x: 1, y: 1 })
    const target = viewer.scrollTop
    expect(target).toBe(10 * 3 * 20)
    await viewer.idle()
    const frames = [...output.join("").matchAll(/a=T,f=100/g)].length
    expect(frames).toBeGreaterThanOrEqual(1)
    expect(frames).toBeLessThan(5)
    // Nothing keeps scrolling after the burst
    expect(viewer.scrollTop).toBe(target)
    output.length = 0
    await new Promise((r) => setTimeout(r, 200))
    expect(output.join("")).toBe("")
  }, 30_000)

  test("clicking an in-page link scrolls to the heading", async () => {
    await viewer.handle({ type: "key", key: "g" })
    await click('a[href="#part-two"]')
    expect(viewer.currentPath).toBe(A)
    expect(viewer.scrollTop).toBeGreaterThan(460)
  }, 30_000)

  test("clicking a web link opens it externally and stays on the page", async () => {
    await viewer.handle({ type: "key", key: "g" })
    output.length = 0
    await click('a[href="https://example.com/x"]')
    expect(opened).toEqual(["https://example.com/x"])
    expect(viewer.currentPath).toBe(A)
    expect(output.join("")).toContain("Opened https://example.com/x")
  }, 30_000)

  test("hovering a link switches to the hand pointer and shows its target", async () => {
    await viewer.handle({ type: "key", key: "g" })
    await viewer.idle()
    const { x, y } = await cellOf('a[href="https://example.com/x"]')
    output.length = 0
    await viewer.handle({ type: "move", x, y })
    await viewer.idle()
    expect(viewer.hoveredLink).toBe("https://example.com/x")
    const out = output.join("")
    expect(out).toContain("\x1b]22;pointer\x1b\\")
    expect(out).toContain("https://example.com/x")
    // Only the status line is redrawn, not the image
    expect(out).not.toContain("a=T,f=100")

    // Moving within the same cell does not test again
    output.length = 0
    await viewer.handle({ type: "move", x, y })
    await viewer.idle()
    expect(output.join("")).toBe("")

    // Off the link: back to the default pointer
    output.length = 0
    await viewer.handle({ type: "move", x: 70, y: 20 })
    await viewer.idle()
    expect(viewer.hoveredLink).toBeNull()
    expect(output.join("")).toContain("\x1b]22;default\x1b\\")
  }, 30_000)

  test("a burst of motion events is tested at the latest position only", async () => {
    await viewer.handle({ type: "move", x: 70, y: 20 })
    await viewer.idle()
    const { x, y } = await cellOf('a[href$="b.md"]')
    for (let i = 1; i <= 40; i++) await viewer.handle({ type: "move", x: 40 + (i % 20), y: 15 })
    await viewer.handle({ type: "move", x, y })
    await viewer.idle()
    expect(viewer.hoveredLink).toBe(`file://${B}`)
    await viewer.handle({ type: "move", x: 70, y: 20 })
    await viewer.idle()
  }, 30_000)

  test("scrolling re-tests the link under a still pointer", async () => {
    await viewer.handle({ type: "key", key: "g" })
    await viewer.idle()
    const { x, y } = await cellOf('a[href$="b.md"]')
    await viewer.handle({ type: "move", x, y })
    await viewer.idle()
    expect(viewer.hoveredLink).toBe(`file://${B}`)
    await viewer.handle({ type: "key", key: "j" })
    await viewer.handle({ type: "key", key: "j" })
    await viewer.idle()
    expect(viewer.hoveredLink).toBeNull()
    await viewer.handle({ type: "move", x: 70, y: 20 })
    await viewer.idle()
  }, 30_000)

  test("a click on the status line or on plain text does nothing", async () => {
    await viewer.handle({ type: "click", x: 1, y: 24 })
    await viewer.handle({ type: "click", x: 70, y: 20 })
    expect(viewer.currentPath).toBe(A)
    expect(opened.length).toBe(1)
  }, 30_000)

  test("clicking a .md link renders it in place, and back returns to the same scroll position", async () => {
    await viewer.handle({ type: "key", key: "g" })
    await click('a[href$="b.md"]')
    expect(viewer.currentPath).toBe(B)
    expect(viewer.scrollTop).toBe(0)
    await viewer.handle({ type: "key", key: "h" })
    expect(viewer.currentPath).toBe(A)
    expect(viewer.scrollTop).toBe(0)
  }, 30_000)

  test("a .md link with a fragment opens the file at that heading", async () => {
    await viewer.handle({ type: "key", key: "g" })
    await click('a[href$="b.md"]')
    await click('a[href*="a.md#part-two"]')
    expect(viewer.currentPath).toBe(A)
    expect(viewer.scrollTop).toBeGreaterThan(460)
  }, 30_000)

  test("+ and - zoom through the steps, 0 resets, and the status shows the level", async () => {
    const page = () => (viewer as unknown as { page: import("playwright").Page }).page
    await viewer.handle({ type: "key", key: "g" })
    output.length = 0
    await viewer.handle({ type: "key", key: "+" })
    expect(viewer.zoomLevel).toBe(1.1)
    // Fewer CSS pixels across, each rendered at more device pixels
    expect(page().viewportSize()).toEqual({ width: Math.round(800 / 1.1), height: Math.round(460 / 1.1) })
    expect(await page().evaluate(() => window.devicePixelRatio)).toBeCloseTo(1.1)
    expect(output.join("")).toContain("110%")
    // The frame still fills the same cells
    expect(output.join("")).toContain("c=80,r=23,C=1")

    await viewer.handle({ type: "key", key: "=" })
    expect(viewer.zoomLevel).toBe(1.25)
    await viewer.handle({ type: "key", key: "-" })
    await viewer.handle({ type: "key", key: "-" })
    await viewer.handle({ type: "key", key: "-" })
    expect(viewer.zoomLevel).toBe(0.9)
    await viewer.handle({ type: "key", key: "0" })
    expect(viewer.zoomLevel).toBe(1)
    expect(page().viewportSize()).toEqual({ width: 800, height: 460 })
  }, 30_000)

  test("zooming keeps the relative position in the document", async () => {
    await viewer.handle({ type: "key", key: "G" })
    await viewer.idle()
    await viewer.handle({ type: "key", key: "+" })
    // Still at the bottom after re-rendering at the new zoom
    expect(output.slice(-1)[0]).toContain("Bot")
    await viewer.handle({ type: "key", key: "0" })
  }, 30_000)

  test("links are hit-tested correctly while zoomed", async () => {
    await viewer.setZoom(1.5)
    await viewer.handle({ type: "key", key: "g" })
    await viewer.idle()
    const page = (viewer as unknown as { page: import("playwright").Page }).page
    // cellOf assumes scale 1; convert with the zoomed scale instead
    const c = await page.evaluate(() => {
      const r = document.querySelector('a[href$="b.md"]')!.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
    await viewer.handle({
      type: "click",
      x: Math.floor((c.x * 1.5) / size.cell.width) + 1,
      y: Math.floor((c.y * 1.5) / size.cell.height) + 1,
    })
    expect(viewer.currentPath).toBe(B)
    await viewer.handle({ type: "key", key: "h" })
    await viewer.setZoom(1)
  }, 30_000)

  describe("animated GIFs", () => {
    const GIF_1PX = "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
    const G = join(dir, "gif.md")
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const overlays = (text: string) => [...text.matchAll(/\x1b\[(\d+);(\d+)H\x1b_Ga=T,f=100,i=(\d+),q=2,c=(\d+),r=(\d+),C=1,z=1/g)]

    const S = join(dir, "static-gif.md")
    const W = join(dir, "webp.md")
    const img = (src: string) => `<img src="${src}" width="200" height="100" style="display:block">`

    beforeAll(() => {
      const fs = require("node:fs")
      // Red/blue animations, slower than the capture interval so every change
      // is caught: the GIF switches every 0.6 s, the WebP every 0.3 s
      fs.copyFileSync(join(import.meta.dir, "fixtures", "anim-2frames.gif"), join(dir, "anim.gif"))
      fs.copyFileSync(join(import.meta.dir, "fixtures", "anim-2frames.webp"), join(dir, "anim.webp"))
      writeFileSync(G, `# GIF\n\n${img("anim.gif")}\n\n${filler}\n`)
      writeFileSync(W, `# WebP\n\n${img("anim.webp")}\n\n${filler}\n`)
      writeFileSync(S, `# Static\n\n${img(`data:image/gif;base64,${GIF_1PX}`)}\n\n${filler}\n`)
    })

    test("a visible GIF is redrawn over its own cells when its frame changes", async () => {
      await open(G)
      output.length = 0
      await wait(900)
      const found = overlays(output.join(""))
      expect(found.length).toBeGreaterThanOrEqual(2)
      const [, row, col, , cols, rows] = found[0].map(Number)
      // Only the GIF's cells (200 x 100 CSS px at 10 x 20 px cells), not the page
      expect(cols).toBeGreaterThanOrEqual(20)
      expect(cols).toBeLessThanOrEqual(21)
      expect(rows).toBeGreaterThanOrEqual(5)
      expect(rows).toBeLessThanOrEqual(6)
      expect(row).toBeGreaterThan(1)
      expect(col).toBeGreaterThanOrEqual(1)
      // No full page frame was drawn meanwhile
      expect(output.join("")).not.toContain("\x1b[H\x1b_Ga=T")
    }, 30_000)

    test("overlays alternate between two ids and remove the previous one", async () => {
      output.length = 0
      await wait(1400)
      const text = output.join("")
      const ids = overlays(text).map((m) => Number(m[3]))
      expect(new Set(ids)).toEqual(new Set([100, 101]))
      expect(text).toContain("\x1b_Ga=d,d=I,i=100,q=2\x1b\\")
      expect(text).toContain("\x1b_Ga=d,d=I,i=101,q=2\x1b\\")
    }, 30_000)

    test("an animated WebP is redrawn the same way", async () => {
      await open(W)
      output.length = 0
      await wait(900)
      const text = output.join("")
      const ids = overlays(text).map((m) => Number(m[3]))
      expect(ids.length).toBeGreaterThanOrEqual(2)
      expect(new Set(ids)).toEqual(new Set([100, 101]))
    }, 30_000)

    test("a static image is sent once, then nothing while its frame does not change", async () => {
      await open(S)
      await wait(250)
      output.length = 0
      await wait(400)
      expect(overlays(output.join("")).length).toBe(0)
      expect(output.join("")).toBe("")
    }, 30_000)

    test("scrolling the GIF off screen removes its overlay and stops the updates", async () => {
      await open(G)
      await wait(250)
      await viewer.handle({ type: "key", key: "G" })
      await viewer.idle()
      const frame = output.join("")
      expect(frame).toMatch(/\x1b_Ga=d,d=I,i=10[01],q=2\x1b\\\x1b\[24;1H/)
      output.length = 0
      await wait(350)
      expect(overlays(output.join("")).length).toBe(0)
    }, 30_000)

    test("a page without GIFs never starts the updates", async () => {
      await open(A)
      output.length = 0
      await wait(350)
      expect(output.join("")).toBe("")
    }, 30_000)
  })

  describe("image files", () => {
    const P = join(dir, "dot.png")
    const M = join(dir, "pics.md")
    const pageOf = () => (viewer as unknown as { page: import("playwright").Page }).page
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

    beforeAll(() => {
      const fs = require("node:fs")
      fs.copyFileSync(join(import.meta.dir, "fixtures", "red-1x1.png"), P)
      fs.copyFileSync(join(import.meta.dir, "fixtures", "anim-2frames.gif"), join(dir, "moving.gif"))
      writeFileSync(M, "[picture](dot.png) [moving](moving.gif)\n")
    })

    test("an image file is shown on a generated page with the theme's background", async () => {
      await viewer.open({ source: "", path: P, basePath: dir, kind: "image" })
      expect(viewer.currentPath).toBe(P)
      const state = await pageOf().evaluate(() => {
        const img = document.querySelector("img") as HTMLImageElement
        return {
          embedded: img.src.startsWith("data:image/png;base64,"),
          width: img.naturalWidth,
          alt: img.alt,
          bg: getComputedStyle(document.documentElement).backgroundColor,
        }
      })
      // render: { highlight: false } uses the default dark theme (#1e1e2e)
      expect(state).toEqual({ embedded: true, width: 1, alt: "dot.png", bg: "rgb(30, 30, 46)" })
    }, 30_000)

    test("a link to an image opens it in the viewer, and back returns", async () => {
      await open(M)
      const before = opened.length
      await click('a[href$="dot.png"]')
      expect(viewer.currentPath).toBe(P)
      // Not handed to the system browser any more
      expect(opened.length).toBe(before)
      await viewer.handle({ type: "key", key: "h" })
      expect(viewer.currentPath).toBe(M)
    }, 30_000)

    test("an animated GIF opened as a file animates like one inside a page", async () => {
      await open(M)
      await click('a[href$="moving.gif"]')
      expect(viewer.currentPath).toBe(join(dir, "moving.gif"))
      output.length = 0
      await wait(900)
      expect(output.join("")).toMatch(/\x1b_Ga=T,f=100,i=10[01],q=2,[^;]*z=1/)
      await viewer.handle({ type: "key", key: "h" })
    }, 30_000)

    test("saving is not offered for an image", async () => {
      await viewer.open({ source: "", path: P, basePath: dir, kind: "image" })
      output.length = 0
      await viewer.handle({ type: "key", key: "s" })
      expect(output.join("")).toContain("Saving is available for Markdown documents")
      expect(require("node:fs").existsSync(join(dir, "dot.html"))).toBe(false)
    }, 30_000)
  })

  describe("PDF files", () => {
    const F = join(dir, "doc.pdf")
    const pageOf = () => (viewer as unknown as { page: import("playwright").Page }).page

    beforeAll(async () => {
      // A three-page PDF made by Chromium itself
      const { getBrowser } = await import("../render/screenshot.js")
      const maker = await (await getBrowser()).newPage()
      await maker.setContent(
        [1, 2, 3].map((n) => `<h1 style="color:#ff0000;page-break-after:always">Page ${n}</h1>`).join(""),
      )
      writeFileSync(F, await maker.pdf({ format: "A6" }))
      await maker.close()
    })

    test("every page is drawn by pdf.js at the page width", async () => {
      await viewer.open({ source: "", path: F, basePath: dir, kind: "pdf" })
      const state = await pageOf().evaluate(() => {
        const canvases = Array.from(document.querySelectorAll("#pdf canvas")) as HTMLCanvasElement[]
        // Is there red text (the heading) on the first page?
        const c = canvases[0]
        const px = c.getContext("2d")!.getImageData(0, 0, c.width, Math.floor(c.height / 3)).data
        let red = false
        for (let i = 0; i < px.length; i += 4) if (px[i] > 200 && px[i + 1] < 80 && px[i + 2] < 80) red = true
        return {
          status: document.body.dataset.pdf,
          pages: canvases.length,
          cssWidth: canvases[0].getBoundingClientRect().width,
          red,
        }
      })
      expect(state.status).toBe("ready")
      expect(state.pages).toBe(3)
      // Fills the content width (800 px viewport minus the page padding)
      expect(state.cssWidth).toBeGreaterThan(700)
      expect(state.red).toBe(true)
      await pageOf().screenshot({ path: join(tmpdir(), "markterm-viewer-pdf.png") })
    }, 60_000)

    test("zooming re-renders the pages at the new resolution", async () => {
      await viewer.open({ source: "", path: F, basePath: dir, kind: "pdf" })
      const before = await pageOf().evaluate(() => (document.querySelector("#pdf canvas") as HTMLCanvasElement).width)
      await viewer.handle({ type: "key", key: "+" })
      const after = await pageOf().evaluate(() => ({
        width: (document.querySelector("#pdf canvas") as HTMLCanvasElement).width,
        status: document.body.dataset.pdf,
      }))
      expect(after.status).toBe("ready")
      // Narrower CSS width at 1.1x device pixels: about the same pixels, not upscaled
      expect(Math.abs(after.width - before)).toBeLessThan(before * 0.1)
      await viewer.handle({ type: "key", key: "0" })
    }, 60_000)

    test("PDFs open from links and are not offered for saving", async () => {
      writeFileSync(join(dir, "with-pdf.md"), "[the pdf](doc.pdf)\n")
      await open(join(dir, "with-pdf.md"))
      await click('a[href$="doc.pdf"]')
      expect(viewer.currentPath).toBe(F)
      output.length = 0
      await viewer.handle({ type: "key", key: "s" })
      expect(output.join("")).toContain("Saving is available for Markdown documents")
      const { documentKind } = await import("../viewer/viewer.js")
      expect(documentKind("x.PDF")).toBe("pdf")
    }, 60_000)
  })

  describe("saving", () => {
    test("s saves the Markdown page as HTML next to the file, never overwriting", async () => {
      await open(A)
      output.length = 0
      await viewer.handle({ type: "key", key: "s" })
      const saved = readFileSync(join(dir, "a.html"), "utf-8")
      // The page as shown: rendered Markdown with heading ids and the theme
      expect(saved).toContain('id="part-two"')
      expect(saved).toContain("<h1")
      expect(output.join("")).toContain("Saved")
      expect(output.join("")).toContain("a.html")

      await viewer.handle({ type: "key", key: "s" })
      expect(readFileSync(join(dir, "a-2.html"), "utf-8")).toContain('id="part-two"')
    }, 30_000)

    test("p saves the whole page as a PNG at the current width", async () => {
      await open(A)
      await viewer.handle({ type: "key", key: "p" })
      const png = readFileSync(join(dir, "a.png"))
      expect(Array.from(png.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
      // PNG width is at bytes 16-19; 800 CSS px at scale 1
      expect(png.readUInt32BE(16)).toBe(800)
      // Taller than one screen: the whole page, not just the visible part
      expect(png.readUInt32BE(20)).toBeGreaterThan(460)
      // The viewer keeps showing the same position afterwards
      expect(viewer.scrollTop).toBe(0)
    }, 30_000)

    test("exportPath uses the file's name and folder, or markterm.* in the cwd for stdin", async () => {
      const { exportPath } = await import("../viewer/viewer.js")
      expect(exportPath({ path: join(dir, "b.md") }, "png")).toBe(join(dir, "b.png"))
      expect(exportPath({}, "html")).toBe(join(process.cwd(), "markterm.html"))
    })
  })

  describe("HTML files", () => {
    const H = join(dir, "page.html")
    const O = join(dir, "other.html")
    const pageOf = () => (viewer as unknown as { page: import("playwright").Page }).page

    beforeAll(() => {
      const fs = require("node:fs")
      fs.mkdirSync(join(dir, "img"), { recursive: true })
      fs.copyFileSync(join(import.meta.dir, "fixtures", "red-1x1.png"), join(dir, "img", "dot.png"))
      writeFileSync(
        H,
        `<!DOCTYPE html><html><head><style>body { background: rgb(1, 2, 3); }</style></head><body>
<p><a href="b.md">md</a> <a href="other.html#sec">other</a> <a href="#local">local</a> <img src="img/dot.png" width="10"></p>
${"<p>filler</p>".repeat(80)}
<h2 id="local">Local</h2>
<script>document.body.dataset.js = "ran"</script>
</body></html>`,
      )
      writeFileSync(O, `<!DOCTYPE html><html><body>${"<p>x</p>".repeat(80)}<h2 id="sec">Sec</h2></body></html>`)
      writeFileSync(join(dir, "to-html.md"), "[page](page.html)\n")
    })

    async function openHtml(path: string) {
      await viewer.open({ source: readFileSync(path, "utf-8"), path, basePath: dir, kind: "html" })
    }

    test("an HTML file is shown as it is: its styles, relative images and scripts load", async () => {
      await openHtml(H)
      expect(viewer.currentPath).toBe(H)
      const state = await pageOf().evaluate(() => ({
        bg: getComputedStyle(document.body).backgroundColor,
        js: document.body.dataset.js,
        img: (document.querySelector("img") as HTMLImageElement).naturalWidth,
      }))
      expect(state).toEqual({ bg: "rgb(1, 2, 3)", js: "ran", img: 1 })
    }, 30_000)

    test("links in HTML open .md files, other .html files at a fragment, and in-page anchors", async () => {
      await openHtml(H)
      await click('a[href="#local"]')
      expect(viewer.currentPath).toBe(H)
      expect(viewer.scrollTop).toBeGreaterThan(460)

      await viewer.handle({ type: "key", key: "g" })
      await click('a[href="other.html#sec"]')
      expect(viewer.currentPath).toBe(O)
      expect(viewer.scrollTop).toBeGreaterThan(460)

      await viewer.handle({ type: "key", key: "h" })
      expect(viewer.currentPath).toBe(H)
      await click('a[href="b.md"]')
      expect(viewer.currentPath).toBe(B)
      // Back from Markdown to the HTML page
      await viewer.handle({ type: "key", key: "h" })
      expect(viewer.currentPath).toBe(H)
    }, 30_000)

    test("a Markdown link to an .html file opens it in the viewer", async () => {
      await open(join(dir, "to-html.md"))
      await click('a[href$="page.html"]')
      expect(viewer.currentPath).toBe(H)
      expect(await pageOf().evaluate(() => document.body.dataset.js)).toBe("ran")
      // Markdown still renders after an HTML page was shown in the same tab
      await viewer.handle({ type: "key", key: "h" })
      expect(viewer.currentPath).toBe(join(dir, "to-html.md"))
      expect(await pageOf().evaluate(() => document.querySelector("a")?.textContent)).toBe("page")
    }, 30_000)

    test("a page wider than the viewport is zoomed out to fit the width", async () => {
      const W = join(dir, "wide.html")
      writeFileSync(
        W,
        `<!DOCTYPE html><html><body style="margin:0"><div style="width:1600px;height:2000px">wide</div><a href="a.md">a</a></body></html>`,
      )
      output.length = 0
      await openHtml(W)
      // 800 CSS px across at 100%; the page needs 1600
      expect(viewer.zoomLevel).toBeCloseTo(0.5, 2)
      const fits = await pageOf().evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
      expect(fits).toBe(true)
      expect(output.join("")).toContain("50%")
      // The frame still fills the terminal width
      expect(output.join("")).toContain("c=80,r=23,C=1")

      // A normal-width page goes back to the user's zoom
      await open(A)
      expect(viewer.zoomLevel).toBe(1)

      // + on a fitted page zooms in from the fitted level, and is kept as asked
      await openHtml(W)
      await viewer.handle({ type: "key", key: "+" })
      expect(viewer.zoomLevel).toBe(0.67)
      await viewer.handle({ type: "key", key: "0" })
      expect(viewer.zoomLevel).toBe(1)

      // A resize fits the page to the new width
      await openHtml(W)
      await viewer.resize({ ...size, cols: 40 })
      expect(viewer.zoomLevel).toBeCloseTo(0.25, 2)
      await viewer.resize(size)
      expect(viewer.zoomLevel).toBeCloseTo(0.5, 2)
    }, 60_000)

    test("saving is only offered for Markdown", async () => {
      await openHtml(H)
      output.length = 0
      await viewer.handle({ type: "key", key: "s" })
      expect(output.join("")).toContain("Saving is available for Markdown documents")
      expect(require("node:fs").existsSync(join(dir, "page-2.html"))).toBe(false)
    }, 30_000)

    test("documentKind picks the viewer mode from the extension", async () => {
      const { documentKind } = await import("../viewer/viewer.js")
      expect(documentKind("a.md")).toBe("markdown")
      expect(documentKind("a.MARKDOWN")).toBe("markdown")
      expect(documentKind("a.html")).toBe("html")
      expect(documentKind("a.htm")).toBe("html")
      for (const ext of ["png", "JPG", "jpeg", "gif", "webp", "svg", "avif", "bmp", "ico"]) {
        expect(documentKind(`a.${ext}`)).toBe("image")
      }
      expect(documentKind("a.pdf")).toBe("pdf")
      expect(documentKind("a.txt")).toBeNull()
      expect(documentKind("a.docx")).toBeNull()
    })
  })

  test("q and Ctrl-C quit", async () => {
    expect(await viewer.handle({ type: "key", key: "q" })).toBe("quit")
    expect(await viewer.handle({ type: "key", key: "ctrl-c" })).toBe("quit")
  })

  test("a new cell size (terminal font change) re-renders at the new pixel size", async () => {
    await open(A)
    await viewer.resize(size)
    await viewer.resize({ ...size, cell: { width: 20, height: 40 } })
    const page = (viewer as unknown as { page: import("playwright").Page }).page
    // Same cells, twice the pixels: the CSS viewport doubles at scale 1
    expect(page.viewportSize()).toEqual({ width: 1600, height: 920 })
    expect(viewer.currentPath).toBe(A)
    await viewer.resize(size)
  }, 30_000)

  test("resize changes the viewport and clears the screen", async () => {
    output.length = 0
    await viewer.resize({ ...size, cols: 60, rows: 20 })
    const page = (viewer as unknown as { page: import("playwright").Page }).page
    expect(page.viewportSize()).toEqual({ width: 600, height: 380 })
    expect(output.join("")).toContain("\x1b[2J")
    expect(output.join("")).toContain("c=60,r=19,C=1")
  }, 30_000)
})
