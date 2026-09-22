import { afterAll, describe, expect, test } from "bun:test"
import { resolve, dirname } from "path"
import { markdownToImage, dispose } from "../render/screenshot.js"

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const FIXTURES = resolve(dirname(import.meta.path), "fixtures")
const RED_PNG = resolve(FIXTURES, "red-1x1.png")

afterAll(async () => {
  await dispose()
})

describe("local image embedding", () => {
  test(
    "renders a Markdown image with a relative path",
    async () => {
      const md = `# Test\n\n![red](fixtures/red-1x1.png)\n`
      const png = await markdownToImage(md, {
        width: 200,
        deviceScaleFactor: 1,
        basePath: dirname(import.meta.path),
      })
      expect(Array.from(png.slice(0, 8))).toEqual(PNG_MAGIC)
    },
    60_000,
  )

  test(
    "renders a Markdown image with an absolute path",
    async () => {
      const md = `# Test\n\n![red](${RED_PNG})\n`
      const png = await markdownToImage(md, {
        width: 200,
        deviceScaleFactor: 1,
        basePath: FIXTURES,
      })
      expect(Array.from(png.slice(0, 8))).toEqual(PNG_MAGIC)
    },
    60_000,
  )

  test(
    "renders an HTML img tag with a relative path",
    async () => {
      const md = `# Test\n\n<img src="fixtures/red-1x1.png" alt="red">\n`
      const png = await markdownToImage(md, {
        width: 200,
        deviceScaleFactor: 1,
        basePath: dirname(import.meta.path),
      })
      expect(Array.from(png.slice(0, 8))).toEqual(PNG_MAGIC)
    },
    60_000,
  )

  test(
    "renders a file:// URI",
    async () => {
      const fileUri = `file://${RED_PNG}`
      const md = `![red](${fileUri})\n`
      const png = await markdownToImage(md, {
        width: 200,
        deviceScaleFactor: 1,
        basePath: FIXTURES,
      })
      expect(Array.from(png.slice(0, 8))).toEqual(PNG_MAGIC)
    },
    60_000,
  )

  test(
    "leaves http URLs untouched",
    async () => {
      const md = `![remote](https://via.placeholder.com/1x1.png)\n`
      const png = await markdownToImage(md, {
        width: 200,
        deviceScaleFactor: 1,
        basePath: FIXTURES,
      })
      expect(Array.from(png.slice(0, 8))).toEqual(PNG_MAGIC)
    },
    60_000,
  )

  test(
    "leaves data URIs untouched",
    async () => {
      const dataUri = "data:image/gif;base64,R0lGODlhAQABAAAAACw="
      const md = `![gif](${dataUri})\n`
      const png = await markdownToImage(md, {
        width: 200,
        deviceScaleFactor: 1,
        basePath: FIXTURES,
      })
      expect(Array.from(png.slice(0, 8))).toEqual(PNG_MAGIC)
    },
    60_000,
  )

  test(
    "non-existent file does not break rendering",
    async () => {
      const md = `# Test\n\n![missing](no-such-file.png)\n\ntext after\n`
      const png = await markdownToImage(md, {
        width: 200,
        deviceScaleFactor: 1,
        basePath: FIXTURES,
      })
      expect(Array.from(png.slice(0, 8))).toEqual(PNG_MAGIC)
    },
    60_000,
  )
})
