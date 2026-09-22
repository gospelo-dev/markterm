import { describe, expect, test } from "bun:test"
import { renderMarkdown } from "../render/markdown.js"

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
