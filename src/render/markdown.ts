import { Marked } from "marked"

const mermaidExtension = {
  name: "mermaid",
  level: "block" as const,
  start(src: string) {
    return src.match(/```mermaid/)?.index
  },
  tokenizer(src: string) {
    const match = src.match(/^```mermaid\s*\n([\s\S]*?)```/)
    if (match) {
      return {
        type: "mermaid",
        raw: match[0],
        text: match[1].trim(),
      }
    }
  },
  renderer(token: { text: string }) {
    return `<pre class="mermaid">${token.text}</pre>\n`
  },
}

const marked = new Marked()
marked.use({ extensions: [mermaidExtension] })

export function renderMarkdown(source: string): string {
  return marked.parse(source) as string
}
