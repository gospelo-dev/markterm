import { afterAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "playwright"
import { markdownToDocument } from "../render/document.js"
import { buildHtml } from "../render/template.js"
import { getTheme } from "../render/themes.js"

const dir = mkdtempSync(join(tmpdir(), "markterm-doc-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe("buildHtml interactive", () => {
  test("a captured page keeps the fixed width and has no interactive script", () => {
    const html = buildHtml("<p>x</p>", { width: 640 })
    expect(html).toContain("width: 640px;")
    expect(html).not.toContain("const base =")
  })

  test("an interactive page fills the window and paints the whole page background", () => {
    const html = buildHtml("<p>x</p>", { width: 640, colors: getTheme("nord")!, interactive: { baseUrl: "file:///d/" } })
    expect(html).not.toContain("width: 640px;")
    expect(html).toContain("max-width: 980px;")
    expect(html).toContain("html { background: #2e3440; }")
  })

  test("the base URL cannot close the script element", () => {
    const html = buildHtml("", { interactive: { baseUrl: "file:///d/</script><b>x/" } })
    expect(html).not.toContain("</script><b>")
  })
})

describe("markdownToDocument in a browser", () => {
  test("resolves relative images and links against basePath, keeps anchors, and adds heading ids", async () => {
    const md = [
      "# Getting Started",
      "",
      "## テーマ",
      "",
      "## Getting Started",
      "",
      "![img](img/a.png) [doc](docs/Quick%20Start.md#install) [top](#テーマ) [web](https://example.com)",
    ].join("\n")
    const html = await markdownToDocument(md, { basePath: "/base/dir", highlight: false })
    const file = join(dir, "page.html")
    writeFileSync(file, html)

    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.goto(pathToFileURL(file).href)
      const result = await page.evaluate(() => ({
        img: document.querySelector("img")!.getAttribute("src"),
        links: Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href")),
        ids: Array.from(document.querySelectorAll("h1, h2")).map((h) => h.id),
      }))
      expect(result.img).toBe("file:///base/dir/img/a.png")
      expect(result.links).toEqual([
        "file:///base/dir/docs/Quick%20Start.md#install",
        // marked percent-encodes the fragment; the browser decodes it to find the id
        "#%E3%83%86%E3%83%BC%E3%83%9E",
        "https://example.com",
      ])
      expect(result.ids).toEqual(["getting-started", "テーマ", "getting-started-1"])

      // The in-page link stays on the page and targets the heading
      await page.click('a[href^="#"]')
      expect(await page.evaluate(() => document.querySelector(":target")?.id)).toBe("テーマ")
      expect(page.url()).toBe(`${pathToFileURL(file).href}#%E3%83%86%E3%83%BC%E3%83%9E`)
    } finally {
      await browser.close()
    }
  }, 30_000)
})
