import { resolve } from "path"
import { pathToFileURL } from "url"
import { renderMarkdown, renderMarkdownHighlighted } from "./markdown.js"
import { buildHtml, type TemplateOptions } from "./template.js"
import { DEFAULT_DARK_CODE_THEME, DEFAULT_LIGHT_CODE_THEME, fallbackTheme, isDark } from "./themes.js"

export type BodyOptions = Pick<TemplateOptions, "colors"> & {
  /** Syntax-highlight fenced code blocks that name a language (default: true). */
  highlight?: boolean
}

/** Markdown to the HTML placed inside <body>, highlighted with the theme's Shiki theme. */
export async function renderBody(source: string, opts?: BodyOptions): Promise<string> {
  if (opts?.highlight === false) return renderMarkdown(source)
  const colors = opts?.colors ?? fallbackTheme("dark")
  const codeTheme = colors.codeTheme ?? (isDark(colors.bg) ? DEFAULT_DARK_CODE_THEME : DEFAULT_LIGHT_CODE_THEME)
  return renderMarkdownHighlighted(source, { codeTheme })
}

export type DocumentOptions = Omit<TemplateOptions, "width" | "interactive"> &
  BodyOptions & {
    /** Directory that relative image and link paths are resolved against (default: cwd). */
    basePath?: string
  }

/**
 * A page for viewing the Markdown interactively (markterm's viewer):
 * the page fills the window, relative images and links point at the
 * Markdown's directory, and headings get ids so "#section" links work.
 */
export async function markdownToDocument(source: string, opts?: DocumentOptions): Promise<string> {
  const baseUrl = pathToFileURL(resolve(opts?.basePath ?? process.cwd())).href.replace(/\/?$/, "/")
  return buildHtml(await renderBody(source, opts), { ...opts, interactive: { baseUrl } })
}
