import { resolve, dirname, extname } from "path"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { chromium, type Browser, type Page } from "playwright"
import { renderMarkdown } from "./markdown.js"
import { buildHtml, type TemplateOptions } from "./template.js"
import { chooseCuts, MEASURE_CANDIDATES_JS, type MeasuredCandidates } from "./bands.js"

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
}

let browserInstance: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (browserInstance?.isConnected()) return browserInstance
  browserInstance = await chromium.launch()
  return browserInstance
}

export async function dispose(): Promise<void> {
  if (browserInstance?.isConnected()) {
    await browserInstance.close()
    browserInstance = null
  }
}

export type ScreenshotOptions = TemplateOptions & {
  deviceScaleFactor?: number
  basePath?: string
}

export type BandOptions = ScreenshotOptions & {
  /** Maximum pixel height of one band (e.g. KITTY_MAX_IMAGE_DIMENSION). */
  maxBandHeight: number
}

export type ImageBands = {
  /** The whole render as one PNG. */
  png: Uint8Array
  /** Horizontal bands, top to bottom. A single element (=== png) when no split was needed. */
  bands: Uint8Array[]
}

async function withPage<T>(
  source: string,
  opts: ScreenshotOptions | undefined,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const html = buildHtml(renderMarkdown(source), opts)
  const width = opts?.width ?? 800
  const scale = opts?.deviceScaleFactor ?? 2

  const browser = await getBrowser()
  const page = await browser.newPage({
    viewport: { width, height: 600 },
    deviceScaleFactor: scale,
  })

  try {
    await page.setContent(html, { waitUntil: "networkidle" })

    const basePath = opts?.basePath ?? process.cwd()
    const srcs: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img"))
        .map((img) => img.getAttribute("src") ?? "")
        .filter((s) => s && !s.startsWith("data:") && !s.startsWith("http:") && !s.startsWith("https:"))
    )
    if (srcs.length > 0) {
      const dataUriMap: Record<string, string> = {}
      for (const src of srcs) {
        if (dataUriMap[src]) continue
        let filePath: string
        if (src.startsWith("file://")) {
          filePath = decodeURIComponent(new URL(src).pathname)
        } else if (src.startsWith("/")) {
          filePath = src
        } else {
          filePath = resolve(basePath, decodeURIComponent(src))
        }
        try {
          if (existsSync(filePath)) {
            const bytes = await readFile(filePath)
            const ext = extname(filePath).toLowerCase()
            const mime = MIME_TYPES[ext] ?? "application/octet-stream"
            const b64 = bytes.toString("base64")
            dataUriMap[src] = `data:${mime};base64,${b64}`
          }
        } catch {}
      }
      if (Object.keys(dataUriMap).length > 0) {
        await page.evaluate((map) => {
          for (const img of document.querySelectorAll("img")) {
            const src = img.getAttribute("src")
            if (src && map[src]) img.setAttribute("src", map[src])
          }
        }, dataUriMap)
      }
    }

    await page.waitForFunction(() => {
      const els = document.querySelectorAll("pre.mermaid")
      return Array.from(els).every((el) => el.querySelector("svg") !== null)
    }, { timeout: 10_000 }).catch(() => {})
    return await fn(page)
  } finally {
    await page.close()
  }
}

export async function markdownToImage(
  source: string,
  opts?: ScreenshotOptions,
): Promise<Uint8Array> {
  return withPage(source, opts, async (page) => {
    const png = await page.locator("body").screenshot({ type: "png" })
    return new Uint8Array(png)
  })
}

/**
 * Render and return the cut candidates measured in the browser (CSS px from the
 * top of <body>). Exposed for tests and debugging.
 */
export async function measureCutCandidates(
  source: string,
  opts?: ScreenshotOptions,
): Promise<MeasuredCandidates> {
  return withPage(source, opts, async (page) => {
    return (await page.evaluate(MEASURE_CANDIDATES_JS)) as MeasuredCandidates
  })
}

/**
 * Render like markdownToImage, and additionally cut the render into bands no
 * taller than opts.maxBandHeight pixels, at positions measured in the browser
 * (gaps between blocks, table rows, list items, text lines). See
 * development/docs/specs/20260922_split-tall-images.md.
 */
export async function markdownToImageBands(
  source: string,
  opts: BandOptions,
): Promise<ImageBands> {
  return withPage(source, opts, async (page) => {
    const body = page.locator("body")
    const png = new Uint8Array(await body.screenshot({ type: "png" }))

    const scale = opts.deviceScaleFactor ?? 2
    // 2 px of slack so that rounding of a fractional clip never exceeds the limit
    const maxBand = Math.floor((opts.maxBandHeight - 2) / scale)
    const box = await body.boundingBox()
    if (!box || maxBand <= 0) return { png, bands: [png] }

    const measured = (await page.evaluate(MEASURE_CANDIDATES_JS)) as MeasuredCandidates
    const cuts = chooseCuts({ preferred: measured.gaps, fallback: measured.inner }, box.height, maxBand)
    if (cuts.length === 0) return { png, bands: [png] }

    const edges = [0, ...cuts, box.height]
    const bands: Uint8Array[] = []
    for (let i = 1; i < edges.length; i++) {
      const buf = await page.screenshot({
        type: "png",
        fullPage: true,
        clip: { x: box.x, y: box.y + edges[i - 1], width: box.width, height: edges[i] - edges[i - 1] },
      })
      bands.push(new Uint8Array(buf))
    }
    return { png, bands }
  })
}
