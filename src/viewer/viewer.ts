import { existsSync } from "fs"
import { readFile, writeFile } from "fs/promises"
import { basename, dirname, extname, join, relative } from "path"
import { fileURLToPath, pathToFileURL } from "url"
import type { Page } from "playwright"
import { markdownToDocument, type DocumentOptions } from "../render/document.js"
import { buildHtml } from "../render/template.js"
import { pdfPage } from "./pdf.js"
import { getBrowser, inlineLocalImages, waitForMermaid } from "../render/screenshot.js"
import type { InputEvent } from "./input.js"
import { deleteImage, placeImage, pointerShape, statusLine, type CellSize } from "./screen.js"

const MARKDOWN_EXT = /\.(md|markdown)$/i

/** Zoom levels for +/-, like a browser's. */
export const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3]

/** Fitting a wide page to the width never zooms out further than this. */
const MIN_ZOOM = 0.25

/** How often visible GIFs are redrawn: 10 frames per second. */
export const ANIMATION_INTERVAL_MS = 100

/** Image ids for GIF overlays: two per GIF, above the page frame's ids 1 and 2. */
const OVERLAY_ID_BASE = 100

/**
 * Where the viewer saves a document: next to its file with the new extension
 * (docs/a.md -> docs/a.html), or markterm.<ext> in the current directory for
 * stdin. A number is added instead of overwriting: a-2.html, a-3.html, ...
 */
export function exportPath(doc: Pick<ViewerDocument, "path">, ext: "html" | "png"): string {
  const dir = doc.path ? dirname(doc.path) : process.cwd()
  const base = doc.path ? basename(doc.path, extname(doc.path)) : "markterm"
  let candidate = join(dir, `${base}.${ext}`)
  for (let n = 2; existsSync(candidate); n++) candidate = join(dir, `${base}-${n}.${ext}`)
  return candidate
}

/** A URL with percent-escapes decoded for display (e.g. Japanese paths). */
function readableUrl(url: string): string {
  try {
    return decodeURI(url)
  } catch {
    return url
  }
}

async function newPage(size: ViewerSize, scale: number): Promise<Page> {
  const browser = await getBrowser()
  return browser.newPage({ viewport: viewportFor(size, scale), deviceScaleFactor: scale })
}

export type ViewerDocument = {
  source: string
  /** The file, or undefined for stdin. */
  path?: string
  /** Directory that relative images and links resolve against. */
  basePath: string
  /**
   * "html": show the page as it is, with its own styles and scripts.
   * "image": show the image file on a generated page. Default: "markdown".
   */
  kind?: DocumentKind
}

export type DocumentKind = "markdown" | "html" | "image" | "pdf"

const HTML_EXT = /\.html?$/i
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i
const PDF_EXT = /\.pdf$/i

/** How the viewer shows a local file, from its extension; null if it cannot. */
export function documentKind(path: string): DocumentKind | null {
  if (MARKDOWN_EXT.test(path)) return "markdown"
  if (HTML_EXT.test(path)) return "html"
  if (IMAGE_EXT.test(path)) return "image"
  if (PDF_EXT.test(path)) return "pdf"
  return null
}

/** Kinds shown from the file itself; there is no text source to read. */
const BINARY_KINDS: DocumentKind[] = ["image", "pdf"]

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/**
 * The page shown for an image file: the image on the theme's background,
 * centred and scaled down to the width when wider. The file:// source is
 * embedded as a data URI when the page loads (see inlineLocalImages).
 */
function imagePage(path: string, render: Omit<DocumentOptions, "basePath">): string {
  const body = `<p style="text-align:center"><img src="${escapeHtml(pathToFileURL(path).href)}" alt="${escapeHtml(basename(path))}"></p>`
  return buildHtml(body, { ...render, interactive: { baseUrl: pathToFileURL(dirname(path)).href + "/" } })
}

export type ViewerSize = { cols: number; rows: number; cell: CellSize }

export type ViewerOptions = {
  output: { write(data: string): unknown }
  size: ViewerSize
  /** Device pixels per CSS pixel. */
  scale: number
  render: Omit<DocumentOptions, "basePath">
  /** Open a URL that is not a local Markdown file, e.g. in the system browser. */
  openExternal: (url: string) => void
}

type Link = { raw: string; href: string }

/**
 * A full-screen Markdown and HTML viewer: renders the document in headless
 * Chromium, shows the visible part as a Kitty Graphics image, and maps
 * scrolling and clicks on the terminal back onto the page. Links to local
 * .md and .html files open in place, with a history to go back.
 */
export class Viewer {
  private doc: ViewerDocument | null = null
  private history: { doc: ViewerDocument; scrollY: number }[] = []
  private scrollY = 0
  private maxScroll = 0
  /** The zoom in use: the user's, or less when the page was fitted to the width. */
  private zoom = 1
  /** The zoom the user chose with +, - and 0. */
  private userZoom = 1
  /** Last pointer position, and the hover state derived from it. */
  private pointer: { x: number; y: number } | null = null
  private hoverCell: string | null = null
  private hoverTarget: { x: number; y: number } | null = null
  private hoverHref: string | null = null
  private hovering: Promise<void> | null = null
  /** GIFs on screen, the overlay image shown for each, and the animation loop. */
  private animated: { col: number; row: number; cols: number; rows: number; clip: { x: number; y: number; width: number; height: number } }[] = []
  private overlayIds: number[] = []
  /** The last frame sent for each animated image, to skip unchanged ones. */
  private lastFrames: Buffer[] = []
  private animTimer: ReturnType<typeof setInterval> | null = null
  private animating: Promise<void> | null = null
  private imageId = 0
  private message = ""
  private dirty = false
  private drawing: Promise<void> | null = null

  private constructor(
    private page: Page,
    private readonly opts: ViewerOptions,
    private size: ViewerSize,
  ) {}

  static async create(opts: ViewerOptions): Promise<Viewer> {
    return new Viewer(await newPage(opts.size, opts.scale), opts, opts.size)
  }

  /** Current zoom, 1 = 100%. */
  get zoomLevel(): number {
    return this.zoom
  }

  /**
   * Device pixels per CSS pixel. Zooming in lays the page out in fewer CSS
   * pixels and renders each at more device pixels, so the captured frame keeps
   * the terminal's pixel size and stays sharp.
   */
  private get effectiveScale(): number {
    return this.opts.scale * this.zoom
  }

  /** The current document's path (undefined for stdin), for status and tests. */
  get currentPath(): string | undefined {
    return this.doc?.path
  }

  get scrollTop(): number {
    return this.scrollY
  }

  private get contentRows(): number {
    return Math.max(1, this.size.rows - 1)
  }

  /** CSS pixels per terminal row. */
  private get rowHeight(): number {
    return this.size.cell.height / this.effectiveScale
  }

  async open(doc: ViewerDocument, fragment?: string): Promise<void> {
    await this.idle()
    // Each document starts at the user's zoom, then shrinks if it is too wide
    if (this.zoom !== this.userZoom) {
      this.zoom = this.userZoom
      await this.replacePage()
    }
    await this.load(doc)
    await this.fitWidth()
    if (fragment) await this.scrollToFragment(fragment)
    await this.redraw()
  }

  /**
   * Zoom out until the page is no wider than the viewport, as a browser does
   * when it fits a page to the window. Pages laid out for a wide screen would
   * otherwise be cut off at the right. Zooming out can make a responsive page
   * reflow, so the width is measured again after each step.
   */
  private async fitWidth(): Promise<void> {
    for (let attempt = 0; attempt < 3 && this.doc; attempt++) {
      const { scrollWidth, innerWidth } = await this.page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      if (scrollWidth <= innerWidth + 1) return
      const fitted = Math.max(MIN_ZOOM, (this.zoom * innerWidth) / scrollWidth)
      if (this.zoom - fitted < 0.005) return
      this.zoom = fitted
      await this.replacePage()
      await this.load(this.doc)
    }
  }

  /**
   * Render a document into the page without drawing a frame, so the caller
   * can set the scroll position first. Leaves scrollY at 0 and maxScroll set.
   */
  private async load(doc: ViewerDocument): Promise<void> {
    // Never replace the page while a frame is being captured from it
    await this.idle()
    // GIF positions belong to the old page; the next frame finds them again
    this.stopAnimation()
    this.animated = []
    await this.animating
    if (doc.kind === "html" && doc.path) {
      // Open the file itself so its relative CSS, images and scripts load
      // as in a browser. Pages that keep the network busy are shown once
      // loaded instead of waiting for the network to go idle.
      await this.page.goto(pathToFileURL(doc.path).href, { waitUntil: "load", timeout: 15_000 }).catch(() => {})
    } else if (doc.kind === "html") {
      await this.page.setContent(doc.source, { waitUntil: "load" })
      await inlineLocalImages(this.page, doc.basePath)
    } else if (doc.kind === "image" && doc.path) {
      await this.page.setContent(imagePage(doc.path, this.opts.render), { waitUntil: "load" })
      await inlineLocalImages(this.page, doc.basePath)
    } else if (doc.kind === "pdf" && doc.path) {
      const pdf = await readFile(doc.path)
      await this.page.setContent(pdfPage(pdf, basename(doc.path), this.opts.render), { waitUntil: "load" })
      // pdf.js draws the pages after the page has loaded
      await this.page.waitForFunction(() => document.body.dataset.pdf, { timeout: 60_000 }).catch(() => {})
    } else {
      const html = await markdownToDocument(doc.source, { ...this.opts.render, basePath: doc.basePath })
      await this.page.setContent(html, { waitUntil: "load" })
      await inlineLocalImages(this.page, doc.basePath)
      await waitForMermaid(this.page)
    }
    this.doc = doc
    this.scrollY = 0
    this.maxScroll = await this.page.evaluate(() =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    )
  }

  /** Handle one input event. Returns "quit" when the viewer should close. */
  async handle(event: InputEvent): Promise<"quit" | void> {
    // Pointer motion must not clear a message; it only updates the hover state
    if (event.type === "move") return this.hover(event.x, event.y)
    this.message = ""
    if (event.type === "wheel") return this.scrollBy((event.direction === "down" ? 3 : -3) * this.rowHeight)
    if (event.type === "click") return this.click(event.x, event.y)

    const line = 2 * this.rowHeight
    const pageStep = this.contentRows * this.rowHeight - line
    switch (event.key) {
      case "q":
      case "ctrl-c":
        return "quit"
      case "j":
      case "down":
        return this.scrollBy(line)
      case "k":
      case "up":
        return this.scrollBy(-line)
      case " ":
      case "f":
      case "pagedown":
        return this.scrollBy(pageStep)
      case "b":
      case "pageup":
        return this.scrollBy(-pageStep)
      case "g":
      case "home":
        return this.scrollTo(0)
      case "G":
      case "end":
        return this.scrollTo(Number.MAX_SAFE_INTEGER)
      case "h":
      case "left":
      case "backspace":
        return this.back()
      case "r":
        return this.reload()
      case "+":
      case "=":
        return this.setZoom(ZOOM_STEPS.find((z) => z > this.zoom + 1e-9) ?? this.zoom)
      case "-":
        return this.setZoom([...ZOOM_STEPS].reverse().find((z) => z < this.zoom - 1e-9) ?? this.zoom)
      case "0":
        return this.setZoom(1)
      case "s":
        return this.save("html")
      case "p":
        return this.save("png")
    }
  }

  /**
   * Save the current Markdown document next to its file: "html" writes the
   * page as shown (local images embedded, Mermaid drawn), "png" the whole page
   * at the current width and zoom. Existing files are never overwritten.
   */
  private async save(format: "html" | "png"): Promise<void> {
    if (!this.doc) return
    if (this.doc.kind && this.doc.kind !== "markdown") {
      this.message = "Saving is available for Markdown documents"
      return this.redraw()
    }
    await this.idle()
    const target = exportPath(this.doc, format)
    const data = format === "html" ? await this.page.content() : await this.page.screenshot({ type: "png", fullPage: true })
    await writeFile(target, data)
    // The file sits next to the document, so its name is enough when the
    // folder is outside the cwd and a full path would not fit the status line
    const rel = relative(process.cwd(), target)
    this.message = `Saved ${rel.startsWith("..") ? basename(target) : rel}`
    await this.redraw()
  }

  /** Change the zoom, keeping the same relative position in the document. */
  /**
   * Set the zoom the user asked for (+, -, 0). It is kept as asked even if the
   * page then overflows; fitting to the width only happens when a document is
   * opened or the terminal is resized.
   */
  async setZoom(zoom: number): Promise<void> {
    if (zoom === this.zoom && zoom === this.userZoom) return
    await this.idle()
    this.userZoom = zoom
    this.zoom = zoom
    await this.rebuildPage({ fit: false })
  }

  /** A page at the current size and effective scale (a page's device scale factor cannot change). */
  private async replacePage(): Promise<void> {
    // No GIF capture may run against the page being closed
    this.stopAnimation()
    this.animated = []
    await this.animating
    const old = this.page
    this.page = await newPage(this.size, this.effectiveScale)
    await old.close()
    this.opts.output.write("\x1b[2J")
  }

  /**
   * Replace the page and re-render the document at the same relative scroll
   * position. With fit, start from the user's zoom and fit to the width again.
   */
  private async rebuildPage(opts: { fit: boolean }): Promise<void> {
    const ratio = this.maxScroll > 0 ? this.scrollY / this.maxScroll : 0
    if (opts.fit) this.zoom = this.userZoom
    await this.replacePage()
    if (!this.doc) return
    await this.load(this.doc)
    if (opts.fit) await this.fitWidth()
    this.scrollTo(Math.round(ratio * this.maxScroll))
    await this.idle()
  }

  async resize(size: ViewerSize): Promise<void> {
    await this.idle()
    const cellChanged = size.cell.width !== this.size.cell.width || size.cell.height !== this.size.cell.height
    this.size = size
    if (cellChanged || this.zoom !== this.userZoom) {
      // A new font size (e.g. Cmd +/- in Ghostty) needs frames of a new pixel
      // size, and a page that was fitted to the old width must be fitted again
      return this.rebuildPage({ fit: true })
    }
    await this.page.setViewportSize(viewportFor(size, this.effectiveScale))
    this.opts.output.write("\x1b[2J")
    const ratio = this.maxScroll > 0 ? this.scrollY / this.maxScroll : 0
    await this.fitWidth()
    this.scrollTo(Math.round(ratio * this.maxScroll))
    await this.idle()
  }

  async close(): Promise<void> {
    this.stopAnimation()
    await this.animating
    await this.page.close()
  }

  /** Resolves once every requested frame has been drawn. */
  async idle(): Promise<void> {
    await this.drawing
    await this.hovering
  }

  // Scrolling only moves the target position and requests a frame; it does not
  // wait for the frame. A burst of wheel or key-repeat events (e.g. trackpad
  // momentum) therefore collapses into one frame at the latest position,
  // instead of queueing a frame per event and scrolling on after input stops.
  private scrollBy(delta: number): void {
    this.scrollTo(this.scrollY + delta)
  }

  private scrollTo(y: number): void {
    this.scrollY = Math.max(0, Math.min(y, this.maxScroll || y))
    void this.redraw()
  }

  private async click(x: number, y: number): Promise<void> {
    // Hit-test the page as it is on screen, not mid-scroll
    await this.idle()
    const link = await this.linkAt(x, y)
    if (link) await this.follow(link)
  }

  /** The link under a terminal cell (1-based), or null. */
  private async linkAt(x: number, y: number): Promise<Link | null> {
    if (y > this.contentRows) return null
    // Centre of the cell, in CSS pixels of the viewport
    const cx = ((x - 1 + 0.5) * this.size.cell.width) / this.effectiveScale
    const cy = (y - 1 + 0.5) * this.rowHeight
    return this.page.evaluate(([px, py]) => {
      const a = document.elementFromPoint(px, py)?.closest("a")
      return a ? { raw: a.getAttribute("href") ?? "", href: a.href } : null
    }, [cx, cy])
  }

  /**
   * Track the pointer: over a link, switch to the hand pointer and show the
   * link's target in the status line. Motion events arrive far faster than
   * hit tests; only the latest position is tested, once per cell.
   */
  private hover(x: number, y: number): void {
    this.pointer = { x, y }
    const cell = `${x},${y}`
    if (cell === this.hoverCell) return
    this.hoverCell = cell
    this.hoverTarget = { x, y }
    this.hovering ??= (async () => {
      while (this.hoverTarget) {
        const target = this.hoverTarget
        this.hoverTarget = null
        const link = await this.linkAt(target.x, target.y).catch(() => null)
        this.setHover(link ? link.href : null)
      }
      this.hovering = null
    })()
  }

  private setHover(href: string | null): void {
    if (href === this.hoverHref) return
    this.hoverHref = href
    this.opts.output.write(
      pointerShape(href ? "pointer" : "default") +
        statusLine(this.size.rows, this.size.cols, this.statusLeft(), this.statusRight()),
    )
  }

  /** After the page moved under a still pointer, test the pointer's cell again. */
  private rehover(): void {
    if (!this.pointer) return
    this.hoverCell = null
    this.hover(this.pointer.x, this.pointer.y)
  }

  /** The link target under the pointer, for tests. */
  get hoveredLink(): string | null {
    return this.hoverHref
  }

  private async follow(link: Link): Promise<void> {
    if (link.raw.startsWith("#")) {
      await this.scrollToFragment(link.raw.slice(1))
      return this.redraw()
    }
    let url: URL
    try {
      url = new URL(link.href)
    } catch {
      return
    }
    if (url.protocol === "file:") {
      const fragment = url.hash.slice(1)
      url.hash = ""
      url.search = ""
      const path = fileURLToPath(url)
      if (path === this.doc?.path && fragment) {
        await this.scrollToFragment(fragment)
        return this.redraw()
      }
      const kind = documentKind(path)
      if (kind && existsSync(path)) {
        this.history.push({ doc: this.doc!, scrollY: this.scrollY })
        // Images and PDFs are shown from their path; there is no text to read
        const source = BINARY_KINDS.includes(kind) ? "" : await readFile(path, "utf-8")
        return this.open({ source, path, basePath: dirname(path), kind }, fragment)
      }
    }
    this.opts.openExternal(link.href)
    this.message = `Opened ${link.href}`
    await this.redraw()
  }

  private async back(): Promise<void> {
    const prev = this.history.pop()
    if (!prev) return
    await this.load(prev.doc)
    this.scrollTo(prev.scrollY)
    await this.idle()
  }

  /** Re-read the current file from disk, keeping the scroll position. */
  private async reload(): Promise<void> {
    if (!this.doc?.path) return
    const y = this.scrollY
    const source = this.doc.kind && BINARY_KINDS.includes(this.doc.kind) ? "" : await readFile(this.doc.path, "utf-8")
    await this.load({ ...this.doc, source })
    this.scrollTo(y)
    await this.idle()
  }

  private async scrollToFragment(fragment: string): Promise<void> {
    const top: number | null = await this.page.evaluate((id) => {
      let decoded = id
      try {
        decoded = decodeURIComponent(id)
      } catch {}
      const el = document.getElementById(id) ?? document.getElementById(decoded)
      return el ? el.getBoundingClientRect().top + window.scrollY : null
    }, fragment)
    if (top !== null) this.scrollY = Math.max(0, top - 8)
  }

  /** Redraw, coalescing requests that arrive while a frame is being captured. */
  private redraw(): Promise<void> {
    this.dirty = true
    this.drawing ??= (async () => {
      while (this.dirty) {
        this.dirty = false
        await this.drawFrame()
      }
      this.drawing = null
    })()
    return this.drawing
  }

  private async drawFrame(): Promise<void> {
    // Never capture while a GIF update is capturing from the same page
    await this.animating
    const requested = this.scrollY
    const { scrollY, maxScroll } = await this.page.evaluate((y) => {
      window.scrollTo(0, y)
      return {
        scrollY: window.scrollY,
        maxScroll: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      }
    }, requested)
    this.maxScroll = maxScroll
    // Adopt the browser's clamped position, unless the user scrolled again meanwhile
    if (this.scrollY === requested) this.scrollY = scrollY

    const png = new Uint8Array(await this.page.screenshot({ type: "png" }))
    // Show the new frame before deleting the old one, so nothing flickers
    const previous = this.imageId
    this.imageId = previous === 1 ? 2 : 1
    const { cols } = this.size
    // The new frame already shows each GIF where it is now; drop the overlays
    const overlays = this.overlayIds.filter(Boolean).map(deleteImage).join("")
    this.overlayIds = []
    this.opts.output.write(
      placeImage(png, { id: this.imageId, cols, rows: this.contentRows }) +
        (previous ? deleteImage(previous) : "") +
        overlays +
        statusLine(this.size.rows, cols, this.statusLeft(), this.statusRight()),
    )
    // The page moved under the pointer: the link below it may have changed
    this.rehover()
    await this.findAnimated()
  }

  /**
   * Find the GIFs now on screen, as cell-aligned rectangles, and run the
   * animation timer only while there are any.
   */
  private async findAnimated(): Promise<void> {
    const rects: { left: number; top: number; right: number; bottom: number }[] = await this.page.evaluate(() =>
      Array.from(document.images)
        // GIF and WebP can be animated; static ones cost a capture per tick
        // but send nothing once their frame stops changing (see animate)
        .filter((img) => /^data:image\/(?:gif|webp)|\.(?:gif|webp)(?:$|[?#])/i.test(img.currentSrc || img.src))
        .map((img) => img.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth)
        .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })),
    )
    // Cell size in CSS pixels; rectangles are widened to whole cells so the
    // captured frame lines up exactly with the cells it is drawn over
    const cw = this.size.cell.width / this.effectiveScale
    const ch = this.rowHeight
    this.animated = rects
      .map((r) => {
        const col0 = Math.max(0, Math.floor(r.left / cw))
        const row0 = Math.max(0, Math.floor(r.top / ch))
        const col1 = Math.min(this.size.cols, Math.ceil(r.right / cw))
        const row1 = Math.min(this.contentRows, Math.ceil(r.bottom / ch))
        return {
          col: col0 + 1,
          row: row0 + 1,
          cols: col1 - col0,
          rows: row1 - row0,
          clip: { x: col0 * cw, y: row0 * ch, width: (col1 - col0) * cw, height: (row1 - row0) * ch },
        }
      })
      .filter((r) => r.cols > 0 && r.rows > 0)
    // The page frame just drawn shows these images; compare new captures with it
    this.lastFrames = []

    if (this.animated.length > 0 && !this.animTimer) {
      this.animTimer = setInterval(() => this.animate(), ANIMATION_INTERVAL_MS)
      this.animTimer.unref?.()
    } else if (this.animated.length === 0) {
      this.stopAnimation()
    }
  }

  /**
   * Capture the current frame of each visible animated image and draw it over
   * the page frame at its cells, alternating two image ids per image so the
   * old overlay is removed only after the new one is shown. A frame identical
   * to the last one sent is not sent again, so static images cost no output.
   * Skipped while a full frame is being drawn, which already contains them.
   */
  private animate(): void {
    if (this.drawing || this.animating || this.animated.length === 0) return
    const targets = this.animated
    this.animating = (async () => {
      let out = ""
      const ids = [...this.overlayIds]
      const frames = [...this.lastFrames]
      for (const [i, r] of targets.entries()) {
        const png = await this.page.screenshot({ type: "png", clip: r.clip })
        if (frames[i]?.equals(png)) continue
        frames[i] = png
        const prev = ids[i]
        const id = OVERLAY_ID_BASE + i * 2 + (prev === OVERLAY_ID_BASE + i * 2 ? 1 : 0)
        out += placeImage(png, { id, cols: r.cols, rows: r.rows, at: { row: r.row, col: r.col }, z: 1 })
        if (prev) out += deleteImage(prev)
        ids[i] = id
      }
      // A full frame started meanwhile: it shows the images itself
      if (this.drawing || targets !== this.animated) return
      if (out) this.opts.output.write(out)
      this.overlayIds = ids
      this.lastFrames = frames
    })()
      .catch(() => {})
      .finally(() => {
        this.animating = null
      })
  }

  private stopAnimation(): void {
    if (this.animTimer) clearInterval(this.animTimer)
    this.animTimer = null
  }

  private statusLeft(): string {
    const title = this.doc?.path ? basename(this.doc.path) : "stdin"
    const back = this.history.length > 0 ? "  [h] back" : ""
    if (this.message) return `${title}  ${this.message}`
    if (this.hoverHref) return `${title}  ${readableUrl(this.hoverHref)}`
    return `${title}${back}`
  }

  private statusRight(): string {
    const pos = this.maxScroll <= 0 ? "All" : this.scrollY <= 0 ? "Top" : this.scrollY >= this.maxScroll ? "Bot" : `${Math.round((this.scrollY / this.maxScroll) * 100)}%`
    const zoom = this.zoom === 1 ? "" : `${Math.round(this.zoom * 100)}%  `
    // A message or a hovered link's target takes the room of the key help
    return this.message || this.hoverHref
      ? `${zoom}${pos}`
      : `${zoom}${pos}  [j/k] scroll  [+/-] zoom  [click] link  [q] quit`
  }
}

/** The CSS viewport that fills cols x (rows - 1) cells at the given scale. */
export function viewportFor(size: ViewerSize, scale: number): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round((size.cols * size.cell.width) / scale)),
    height: Math.max(1, Math.round((Math.max(1, size.rows - 1) * size.cell.height) / scale)),
  }
}
