import { chromium, type Browser } from "playwright"
import { renderMarkdown } from "./markdown.js"
import { buildHtml, type TemplateOptions } from "./template.js"

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
}

export async function markdownToImage(
  source: string,
  opts?: ScreenshotOptions,
): Promise<Uint8Array> {
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
    await page.waitForFunction(() => {
      const els = document.querySelectorAll("pre.mermaid")
      return Array.from(els).every((el) => el.querySelector("svg") !== null)
    }, { timeout: 10_000 }).catch(() => {})

    const body = page.locator("body")
    const png = await body.screenshot({ type: "png" })
    return new Uint8Array(png)
  } finally {
    await page.close()
  }
}
