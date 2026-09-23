import type { ThemeColors } from "./themes.js"
import { fallbackTheme } from "./themes.js"

const MERMAID_VERSION = "11.16.0"

export type TemplateOptions = {
  width?: number
  fontSize?: number
  fontFamily?: string
  /** CSS font-family for code and code blocks. Unset: the browser's default monospace font. */
  codeFontFamily?: string
  colors?: ThemeColors
  mermaidVersion?: string
}

const DEFAULTS = {
  width: 800,
  fontSize: 16,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  mermaidVersion: MERMAID_VERSION,
}

export function buildHtml(markdownHtml: string, opts?: TemplateOptions): string {
  const o = { ...DEFAULTS, ...opts }
  const c = o.colors ?? fallbackTheme("dark")

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${o.width}px;
    font-family: ${o.fontFamily};
    font-size: ${o.fontSize}px;
    line-height: 1.6;
    color: ${c.fg};
    background: ${c.bg};
    padding: 24px 32px;
  }
  h1 { font-size: 1.8em; margin: 0.6em 0 0.4em; }
  h2 { font-size: 1.4em; margin: 0.5em 0 0.3em; }
  h3 { font-size: 1.2em; margin: 0.4em 0 0.2em; }
  p { margin: 0.4em 0; }
  ul, ol { margin: 0.4em 0; padding-left: 1.5em; }
  code {
    background: ${c.codeBg};
    padding: 0.15em 0.4em;
    border-radius: 4px;
    font-size: 0.9em;
  }
  pre {
    background: ${c.codeBg};
    padding: 12px 16px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 0.5em 0;
  }
  pre code { background: none; padding: 0; }${o.codeFontFamily ? `
  code, pre { font-family: ${o.codeFontFamily}; }` : ""}
  blockquote {
    border-left: 4px solid ${c.border};
    padding-left: 16px;
    margin: 0.5em 0;
    opacity: 0.85;
  }
  table {
    border-collapse: collapse;
    margin: 0.5em 0;
    width: 100%;
  }
  th, td {
    border: 1px solid ${c.border};
    padding: 6px 12px;
    text-align: left;
  }
  th { background: ${c.codeBg}; }
  .mermaid { margin: 0.8em 0; }
  img { max-width: 100%; }
  a { color: ${c.link}; }
</style>
</head>
<body>
${markdownHtml}
<script src="https://cdn.jsdelivr.net/npm/mermaid@${o.mermaidVersion}/dist/mermaid.min.js"></script>
<script>
  mermaid.initialize({ startOnLoad: true, theme: '${c.mermaid}' });
</script>
</body>
</html>`
}
