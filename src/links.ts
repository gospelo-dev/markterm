import { resolve } from "path"
import { pathToFileURL } from "url"
import { Marked, type Token } from "marked"

export type MarkdownLink = {
  /** Link text as plain text; the alt text for an image link (e.g. a badge). */
  text: string
  /** The href as written in the Markdown. */
  href: string
  /** Openable URL: the href itself, or a file:// URL for a relative or absolute path. */
  url: string
}

const lexer = new Marked()

// C0 controls and DEL. Removed so link text or URLs from a document cannot
// inject terminal escape sequences when printed.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

function plainText(tokens: Token[] | undefined): string {
  if (!tokens) return ""
  return tokens
    .map((t) => {
      if (t.type === "image") return t.text
      if ("tokens" in t && t.tokens) return plainText(t.tokens)
      return "text" in t ? t.text : ""
    })
    .join("")
}

function toUrl(href: string, basePath: string): string {
  // Has a scheme (https:, mailto:, file:, ...): use as is
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href
  const hash = href.indexOf("#")
  const path = hash === -1 ? href : href.slice(0, hash)
  const fragment = hash === -1 ? "" : href.slice(hash)
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {}
  return pathToFileURL(resolve(basePath, decoded)).href + fragment
}

/**
 * Links in a Markdown document, in document order, without duplicates (by URL).
 * In-page anchors ("#section") and plain images are skipped. Relative paths are
 * resolved against basePath (default: the current directory).
 */
export function extractLinks(source: string, basePath: string = process.cwd()): MarkdownLink[] {
  const links: MarkdownLink[] = []
  const seen = new Set<string>()
  lexer.walkTokens(lexer.lexer(source), (token) => {
    if (token.type !== "link") return
    const href = token.href.replace(CONTROL_CHARS, "").trim()
    if (!href || href.startsWith("#")) return
    const url = toUrl(href, basePath).replace(CONTROL_CHARS, "")
    if (seen.has(url)) return
    seen.add(url)
    const text = plainText(token.tokens).replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim()
    links.push({ text: text || href, href, url })
  })
  return links
}

/** Wrap text in an OSC 8 hyperlink so the terminal makes it clickable. */
function hyperlink(url: string, text: string): string {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`
}

/**
 * A file path as printed text: with hyperlinks, an OSC 8 hyperlink to the file
 * (resolved to an absolute file:// URL) that shows the path as given.
 */
export function formatFilePath(path: string, opts: { hyperlinks: boolean }): string {
  return opts.hyperlinks ? hyperlink(pathToFileURL(resolve(path)).href, path) : path
}

/**
 * Format links as a numbered list for the terminal, starting at [1]. With
 * `image`, the rendered image file is listed first as [0]. With hyperlinks, each
 * URL is an OSC 8 hyperlink; terminals without OSC 8 support show plain text.
 */
export function formatLinkList(links: MarkdownLink[], opts: { hyperlinks: boolean; image?: string }): string {
  const entries: [number, string, string][] = links.map((link, i) => [i + 1, link.text, link.url])
  if (opts.image !== undefined) entries.unshift([0, "Rendered image", pathToFileURL(resolve(opts.image)).href])
  if (entries.length === 0) return ""

  const width = String(links.length).length
  const lines = entries.map(([n, text, rawUrl]) => {
    const num = `[${String(n).padStart(width)}]`
    const url = opts.hyperlinks ? hyperlink(rawUrl, rawUrl) : rawUrl
    // Omit the text only when it is the URL itself (autolinks)
    return text === rawUrl ? `  ${num} ${url}` : `  ${num} ${text}  ${url}`
  })
  return `Links:\n${lines.join("\n")}\n`
}
