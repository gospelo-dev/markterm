import { describe, expect, test } from "bun:test"
import { renderMarkdown, renderMarkdownHighlighted } from "../render/markdown.js"

describe("renderMarkdown", () => {
  test("renders standard Markdown to HTML", () => {
    const html = renderMarkdown("# Title\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n")
    expect(html).toContain("<h1>Title</h1>")
    expect(html).toContain("<li>one</li>")
    expect(html).toContain("<table>")
    expect(html).toContain("<td>1</td>")
  })

  test("turns a mermaid fence into <pre class=\"mermaid\"> with the raw diagram text", () => {
    const html = renderMarkdown("```mermaid\ngraph LR\n  A --> B\n```\n")
    expect(html).toBe('<pre class="mermaid">graph LR\n  A --> B</pre>\n')
  })

  test("leaves other code fences as normal code blocks", () => {
    const html = renderMarkdown("```js\nconsole.log(1)\n```\n")
    expect(html).toContain('<pre><code class="language-js">')
    expect(html).not.toContain('class="mermaid"')
  })

  test("handles mermaid fences mixed with other content", () => {
    const html = renderMarkdown("# Doc\n\n```mermaid\npie\n  \"A\" : 1\n```\n\nafter\n")
    expect(html).toContain("<h1>Doc</h1>")
    expect(html).toContain('<pre class="mermaid">pie\n  "A" : 1</pre>')
    expect(html).toContain("<p>after</p>")
  })
})

describe("renderMarkdownHighlighted", () => {
  const opts = { codeTheme: "dracula" }

  test("highlights a fence with a known language using the given Shiki theme", async () => {
    const html = await renderMarkdownHighlighted("```ts\nconst a = 1\n```\n", opts)
    expect(html).toContain('<pre class="shiki dracula"')
    expect(html).toContain('<span style="color:#FF79C6">const</span>')
  })

  test("accepts aliases and ignores extra words in the info string", async () => {
    const html = await renderMarkdownHighlighted("```sh title=run.sh\necho hi\n```\n", opts)
    expect(html).toContain('class="shiki dracula"')
  })

  test("escapes HTML inside highlighted code", async () => {
    const html = await renderMarkdownHighlighted("```html\n<script>alert(1)</script>\n```\n", opts)
    expect(html).not.toContain("<script>")
  })

  test("leaves fences without a language or with an unknown one as plain code blocks", async () => {
    const html = await renderMarkdownHighlighted("```\nx\n```\n\n```no-such-lang\ny\n```\n", opts)
    expect(html).not.toContain("shiki")
    expect(html).toContain("<pre><code>x\n</code></pre>")
    expect(html).toContain('<pre><code class="language-no-such-lang">y\n</code></pre>')
  })

  test("does not touch mermaid fences or the rest of the document", async () => {
    const html = await renderMarkdownHighlighted("# Doc\n\n```mermaid\ngraph LR\n  A --> B\n```\n", opts)
    expect(html).toContain("<h1>Doc</h1>")
    expect(html).toContain('<pre class="mermaid">graph LR\n  A --> B</pre>')
  })

  test("renderMarkdown stays unhighlighted after a highlighted render", async () => {
    await renderMarkdownHighlighted("```js\n1\n```\n", opts)
    expect(renderMarkdown("```js\n1\n```\n")).toContain('<pre><code class="language-js">')
  })
})
