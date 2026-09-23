import { bundledLanguages, bundledThemes, createHighlighter, type Highlighter } from "shiki"

let highlighterPromise: Promise<Highlighter> | null = null

/** One shared highlighter; languages and themes are loaded on first use. */
function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({ themes: [], langs: [] })
  return highlighterPromise
}

/** Whether Shiki knows the language id or alias (e.g. "ts", "sh", "typescript"). */
export function isHighlightLanguage(lang: string): boolean {
  return Object.hasOwn(bundledLanguages, lang.toLowerCase())
}

/** Whether Shiki ships the theme (e.g. "dracula", "github-dark-default"). */
export function isHighlightTheme(theme: string): boolean {
  return Object.hasOwn(bundledThemes, theme)
}

/**
 * Highlight code as a Shiki <pre class="shiki"> block. Returns null when the
 * language or theme is unknown, so the caller can fall back to a plain block.
 */
export async function highlightCode(code: string, lang: string, theme: string): Promise<string | null> {
  const id = lang.toLowerCase()
  if (!isHighlightLanguage(id) || !isHighlightTheme(theme)) return null

  const highlighter = await getHighlighter()
  if (!highlighter.getLoadedThemes().includes(theme)) await highlighter.loadTheme(theme as keyof typeof bundledThemes)
  if (!highlighter.getLoadedLanguages().includes(id)) await highlighter.loadLanguage(id as keyof typeof bundledLanguages)
  return highlighter.codeToHtml(code, { lang: id, theme })
}
