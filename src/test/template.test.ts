import { describe, expect, test } from "bun:test"
import { buildHtml } from "../render/template.js"
import { fallbackTheme } from "../render/themes.js"

describe("buildHtml", () => {
  test("codeFontFamily adds a code font rule only when set", () => {
    expect(buildHtml("<p>x</p>")).not.toContain("code, pre { font-family")
    const html = buildHtml("<p>x</p>", { codeFontFamily: "JetBrains Mono, monospace" })
    expect(html).toContain("code, pre { font-family: JetBrains Mono, monospace; }")
  })

  const diagram = '<pre class="mermaid">graph LR\n  A --> B</pre>'

  test("uses defaults: 800px, 16px, dark fallback theme, MermaidJS 11.16.0", () => {
    const html = buildHtml(`<p>x</p>${diagram}`)
    expect(html).toContain("width: 800px;")
    expect(html).toContain("font-size: 16px;")
    expect(html).toContain("background: #1e1e2e;")
    expect(html).toContain("https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.min.js")
    expect(html).toContain("theme: 'dark'")
    expect(html).toContain("<p>x</p>")
  })

  test("loads MermaidJS only when the document has a diagram", () => {
    const html = buildHtml("<p>no diagrams</p>")
    expect(html).not.toContain("mermaid.min.js")
    expect(html).not.toContain("mermaid.initialize")
  })

  test("applies width, font size, colors and mermaid version options", () => {
    const html = buildHtml(`<p>y</p>${diagram}`, {
      width: 1200,
      fontSize: 20,
      fontFamily: "Menlo, monospace",
      colors: fallbackTheme("light"),
      mermaidVersion: "12.0.0",
    })
    expect(html).toContain("width: 1200px;")
    expect(html).toContain("font-size: 20px;")
    expect(html).toContain("font-family: Menlo, monospace;")
    expect(html).toContain("background: #ffffff;")
    expect(html).toContain("color: #1e1e2e;")
    expect(html).toContain("mermaid@12.0.0/")
    expect(html).toContain("theme: 'default'")
  })

  test("uses the theme's link color for anchors", () => {
    const html = buildHtml("", { colors: { ...fallbackTheme("dark"), link: "#abcdef" } })
    expect(html).toContain("a { color: #abcdef; }")
  })
})
