import { describe, expect, test } from "bun:test"
import { extractLinks, formatLinkList } from "../links.js"

describe("extractLinks", () => {
  test("collects links in document order, including tables and autolinks", () => {
    const links = extractLinks(
      "See [docs](https://a.example) and <https://b.example>.\n\n| x |\n|---|\n| [cell](https://c.example) |\n",
      "/base",
    )
    expect(links.map((l) => l.url)).toEqual(["https://a.example", "https://b.example", "https://c.example"])
    expect(links[0].text).toBe("docs")
  })

  test("uses the alt text of an image inside a link (badges)", () => {
    const [link] = extractLinks("[![License: MIT](https://img.example/x.svg)](https://example.com/LICENSE)", "/base")
    expect(link).toEqual({ text: "License: MIT", href: "https://example.com/LICENSE", url: "https://example.com/LICENSE" })
  })

  test("flattens formatted link text to plain text", () => {
    const [link] = extractLinks("[**bold** `code`](https://x.example)", "/base")
    expect(link.text).toBe("bold code")
  })

  test("resolves relative and absolute paths to file:// URLs and keeps the fragment", () => {
    const links = extractLinks("[q](docs/Quick%20Start.md#install) [abs](/etc/hosts)", "/base/dir")
    expect(links[0].url).toBe("file:///base/dir/docs/Quick%20Start.md#install")
    expect(links[0].href).toBe("docs/Quick%20Start.md#install")
    expect(links[1].url).toBe("file:///etc/hosts")
  })

  test("skips in-page anchors and plain images, and removes duplicates", () => {
    const links = extractLinks(
      "[top](#top) ![img](https://img.example/a.png) [a](https://a.example) [again](https://a.example)",
      "/base",
    )
    expect(links).toHaveLength(1)
    expect(links[0].text).toBe("a")
  })

  test("keeps mailto and other schemes as is", () => {
    const [link] = extractLinks("[mail](mailto:me@example.com)", "/base")
    expect(link.url).toBe("mailto:me@example.com")
  })

  test("strips control characters so a document cannot inject escape sequences", () => {
    const [link] = extractLinks("[evil\u001b]0;title\u0007](https://x.example/\u001b[2J)", "/base")
    expect(link.text).not.toMatch(/[\u0000-\u001f]/)
    expect(link.url).not.toMatch(/[\u0000-\u001f]/)
  })

  test("returns an empty list for a document without links", () => {
    expect(extractLinks("# Title\n\ntext\n", "/base")).toEqual([])
  })
})

describe("formatLinkList", () => {
  const links = [
    { text: "docs", href: "https://a.example", url: "https://a.example" },
    { text: "https://b.example", href: "https://b.example", url: "https://b.example" },
  ]

  test("numbers links and omits the text when it repeats the URL", () => {
    expect(formatLinkList(links, { hyperlinks: false })).toBe(
      "Links:\n  [1] docs  https://a.example\n  [2] https://b.example\n",
    )
  })

  test("keeps a path-like text when the URL is the resolved file:// form", () => {
    const out = formatLinkList([{ text: "docs/Q.md", href: "docs/Q.md", url: "file:///base/docs/Q.md" }], {
      hyperlinks: false,
    })
    expect(out).toContain("[1] docs/Q.md  file:///base/docs/Q.md")
  })

  test("wraps URLs in OSC 8 hyperlinks when enabled", () => {
    const out = formatLinkList(links, { hyperlinks: true })
    expect(out).toContain("\x1b]8;;https://a.example\x1b\\https://a.example\x1b]8;;\x1b\\")
  })

  test("pads numbers to the same width", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ text: `t${i}`, href: `https://${i}.x`, url: `https://${i}.x` }))
    const out = formatLinkList(many, { hyperlinks: false })
    expect(out).toContain("  [ 1] t0")
    expect(out).toContain("  [10] t9")
  })

  test("returns an empty string for no links", () => {
    expect(formatLinkList([], { hyperlinks: true })).toBe("")
  })
})
