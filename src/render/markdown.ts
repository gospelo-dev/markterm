import { Marked, type Tokens } from "marked"
import { highlightCode } from "./highlight.js"

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

/** Highlighted HTML for code tokens, filled in by renderMarkdownHighlighted before parsing. */
const highlighted = new WeakMap<object, string>()

const marked = new Marked()
marked.use({
  extensions: [mermaidExtension],
  renderer: {
    code(token) {
      const html = highlighted.get(token)
      // false: fall back to marked's default <pre><code> rendering
      return html === undefined ? false : `${html}\n`
    },
  },
})

export function renderMarkdown(source: string): string {
  return marked.parse(source) as string
}

export type HighlightOptions = {
  /** Shiki theme name, e.g. "github-dark-default". */
  codeTheme: string
}

/**
 * Like renderMarkdown, with fenced code blocks that name a language highlighted
 * by Shiki. Blocks without a language, or with one Shiki does not know, are
 * rendered as plain code blocks.
 */
export async function renderMarkdownHighlighted(source: string, opts: HighlightOptions): Promise<string> {
  const tokens = marked.lexer(source)
  const pending: Promise<void>[] = []
  marked.walkTokens(tokens, (token) => {
    if (token.type !== "code") return
    const code = token as Tokens.Code
    // The info string may carry more than the language ("ts title=a.ts")
    const lang = code.lang?.trim().split(/\s+/)[0]
    if (!lang) return
    pending.push(
      highlightCode(code.text, lang, opts.codeTheme).then((html) => {
        if (html !== null) highlighted.set(token, html)
      }),
    )
  })
  await Promise.all(pending)
  return marked.parser(tokens)
}
