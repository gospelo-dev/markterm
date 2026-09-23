#!/usr/bin/env node
import { resolve, dirname } from "path"
import { parseArgs } from "util"
import { readFile, writeFile } from "fs/promises"
import { existsSync } from "fs"
import { markdownToImage, markdownToImageBands, dispose } from "./render/screenshot.js"
import { detectProtocol, detectMultiplexer, displayInline, maxBandHeightFor, type Protocol } from "./protocol/index.js"
import { estimateViewportWidth } from "./terminal.js"
import { extractLinks, formatFilePath, formatLinkList } from "./links.js"
import { queryTerminalColors } from "./colorquery.js"
import {
  deriveTheme,
  fallbackTheme,
  getTheme,
  isDark,
  normalizeHex,
  THEME_NAMES,
  type ThemeColors,
} from "./render/themes.js"
import pkg from "../package.json" with { type: "json" }

const VERSION: string = pkg.version

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    theme: { type: "string", short: "t" },
    bg: { type: "string" },
    fg: { type: "string" },
    width: { type: "string", short: "w", default: "auto" },
    font: { type: "string" },
    "code-font": { type: "string" },
    "font-size": { type: "string", default: "16" },
    "no-highlight": { type: "boolean", default: false },
    "no-links": { type: "boolean", default: false },
    scale: { type: "string", short: "s", default: "2" },
    mermaid: { type: "string", default: "11.16.0" },
    zoom: { type: "string", short: "z", default: "100" },
    protocol: { type: "string", short: "p" },
    output: { type: "string", short: "o" },
    help: { type: "boolean", short: "h", default: false },
    version: { type: "boolean", short: "v", default: false },
  },
  allowPositionals: true,
})

if (values.version) {
  console.log(`markterm ${VERSION}`)
  process.exit(0)
}

if (values.help) {
  const detected = detectProtocol()
  console.log(`markterm - Render Markdown + MermaidJS as inline terminal images

Usage: markterm [options] [file.md]

Reads from stdin if no file is given.

Options:
  -t, --theme <name>             Use a built-in color theme instead of the terminal's colors
      --bg <#hex>                Override background color
      --fg <#hex>                Override foreground color
      --font <family>            Body font, e.g. "Noto Sans JP" (a CSS font-family list)
      --code-font <family>       Font for code and code blocks, e.g. "JetBrains Mono"
  -w, --width <auto|px>          Viewport width: auto fits terminal (default: auto)
      --font-size <px>           Body font size (default: 16)
      --no-highlight             Disable syntax highlighting of code blocks
      --no-links                 Do not list the document's links after the image
  -s, --scale <factor>           Device scale factor (default: 2)
      --mermaid <version>        MermaidJS version (default: 11.16.0)
  -z, --zoom <percent>           Display zoom: 1-100% of terminal width (default: 100)
  -p, --protocol <name>          Force protocol: kitty, iterm2, sixel, file
  -o, --output <file.png>        Save PNG to file instead of displaying
  -h, --help                     Show this help
  -v, --version                  Show version

Themes:
  Without -t or MARKTERM_THEME, markterm queries your terminal's colors via
  OSC 10/11 escape sequences on every run, and falls back to "dark" if that
  fails. -t <name> uses a built-in theme and skips the query. --bg/--fg
  override individual colors in either case.
  Built-in: ${THEME_NAMES.join(", ")}

Detected terminal protocol: ${detected}
Multiplexer: ${detectMultiplexer() ?? "none"}
Terminal columns: ${process.stdout.columns || "unknown"}

Supported terminals:
  kitty     Ghostty, Kitty, WezTerm
  iterm2    iTerm2 (native, no deps)
  sixel     foot, xterm, mlterm, Konsole, mintty, Black Box

Prerequisites:
  Sixel output requires img2sixel (libsixel).
    macOS:  brew install libsixel
    Linux:  apt install libsixel-bin

Environment (command-line options take precedence):
  MARKTERM_PROTOCOL    Override auto-detected protocol
  MARKTERM_THEME       Default theme, like -t
  MARKTERM_FONT        Default body font, like --font
  MARKTERM_CODE_FONT   Default code font, like --code-font`)
  process.exit(0)
}

function parseColorOption(name: "bg" | "fg"): string | undefined {
  const raw = values[name]
  if (raw === undefined) return undefined
  const hex = normalizeHex(raw)
  if (!hex) {
    console.error(`Invalid --${name} "${raw}": expected a hex color such as #ffffff.`)
    if (THEME_NAMES.includes(raw)) console.error(`To use the "${raw}" theme, pass -t ${raw}.`)
    process.exit(1)
  }
  return hex
}

const bgOption = parseColorOption("bg")
const fgOption = parseColorOption("fg")

// -t takes precedence over MARKTERM_THEME
const themeName = values.theme ?? (process.env.MARKTERM_THEME || undefined)
let namedTheme: ThemeColors | null = null
if (themeName !== undefined) {
  namedTheme = getTheme(themeName)
  if (!namedTheme) {
    const from = values.theme !== undefined ? "" : " (from MARKTERM_THEME)"
    console.error(`Unknown theme "${themeName}"${from}. Available: ${THEME_NAMES.join(", ")}`)
    process.exit(1)
  }
}

/**
 * Validate a font option and append a generic fallback so a missing font does
 * not fall back to the browser's serif default. The value goes into a <style>
 * block, so characters that could end the declaration are rejected.
 */
function parseFontOption(value: string | undefined, source: string, generic: string): string | undefined {
  if (value === undefined || !value.trim()) return undefined
  if (/[;{}<>]/.test(value)) {
    console.error(`Invalid ${source} "${value}": font names cannot contain ; { } < >`)
    process.exit(1)
  }
  return `${value.trim()}, ${generic}`
}

const fontFamily =
  parseFontOption(values.font, "--font", "sans-serif") ??
  parseFontOption(process.env.MARKTERM_FONT, "MARKTERM_FONT", "sans-serif")
const codeFontFamily =
  parseFontOption(values["code-font"], "--code-font", "monospace") ??
  parseFontOption(process.env.MARKTERM_CODE_FONT, "MARKTERM_CODE_FONT", "monospace")

/** Apply --bg / --fg on top of a base theme. */
function withOverrides(base: ThemeColors): ThemeColors {
  if (!bgOption && !fgOption) return base
  const bg = bgOption ?? base.bg
  // Keep the theme's code colors unless --bg flips the page between dark and light
  const codeTheme = isDark(bg) === isDark(base.bg) ? base.codeTheme : undefined
  return deriveTheme(bg, fgOption ?? base.fg, base.link, codeTheme)
}

async function resolveColors(): Promise<ThemeColors> {
  // -t: use the named theme as is, without querying the terminal
  if (namedTheme) return withOverrides(namedTheme)

  if (bgOption && fgOption) {
    return deriveTheme(bgOption, fgOption, "#89b4fa")
  }

  const detected = await queryTerminalColors()
  if (detected) {
    return deriveTheme(bgOption ?? detected.bg, fgOption ?? detected.fg, detected.blue)
  }

  return withOverrides(fallbackTheme("dark"))
}

const colors = await resolveColors()

const fontSize = parseInt(values["font-size"]!, 10)
const scale = parseFloat(values.scale!)
const mermaidVersion = values.mermaid!

const zoom = Math.max(1, Math.min(100, parseInt(values.zoom!, 10)))
const baseWidth = values.width === "auto"
  ? estimateViewportWidth(scale)
  : parseInt(values.width!, 10)
const width = Math.round(baseWidth * (100 / zoom))

let source: string
let basePath: string
if (positionals.length > 0) {
  if (!existsSync(positionals[0])) {
    console.error(`File not found: ${positionals[0]}`)
    process.exit(1)
  }
  source = await readFile(positionals[0], "utf-8")
  basePath = dirname(resolve(positionals[0]))
} else {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  source = Buffer.concat(chunks).toString("utf-8")
  basePath = process.cwd()
}

if (!source.trim()) {
  console.error("No markdown content to render.")
  process.exit(1)
}

const PROTOCOLS: Protocol[] = ["kitty", "iterm2", "sixel", "file"]
let proto: Protocol
if (values.protocol && PROTOCOLS.includes(values.protocol as Protocol)) {
  proto = values.protocol as Protocol
} else {
  if (values.protocol) console.error(`Unknown protocol "${values.protocol}", using auto-detection.`)
  proto = detectProtocol()
}

const renderOptions = {
  colors,
  width,
  fontSize,
  // Only set when given: an explicit undefined would override the template default
  ...(fontFamily && { fontFamily }),
  ...(codeFontFamily && { codeFontFamily }),
  deviceScaleFactor: scale,
  mermaidVersion,
  basePath,
  highlight: !values["no-highlight"],
}

// Ghostty rejects Kitty Graphics images taller than 10000 px; iTerm2 rejects
// 10000 px and shows at most 255 rows per image. Tall renders are therefore
// cut into bands for display. The temp file and -o always get the whole render.
const maxBandHeight = values.output ? null : maxBandHeightFor(proto, Math.round(width * scale))
const { png, bands } = maxBandHeight !== null
  ? await markdownToImageBands(source, { ...renderOptions, maxBandHeight })
  : await markdownToImage(source, renderOptions).then((png) => ({ png, bands: [png] }))

const tmpDir = process.env.TMPDIR || "/tmp/"
const tmpPath = `${tmpDir}markterm-${Date.now()}.png`
await writeFile(tmpPath, png)

// Printed file paths are OSC 8 hyperlinks when the stream is a terminal
const stdoutLinks = { hyperlinks: !!process.stdout.isTTY }
const stderrLinks = { hyperlinks: !!process.stderr.isTTY }

if (values.output) {
  await writeFile(values.output, png)
  console.log(`Saved to ${formatFilePath(values.output, stdoutLinks)} (${png.length} bytes)`)
} else {
  const mux = detectMultiplexer()
  if (mux) {
    console.error(`Terminal multiplexer detected (${mux}). Inline image display is not supported.`)
    console.error("Consider using herdr (https://herdr.dev/) for multiplexer support.")
    console.error("")
  }
  // Links in the image cannot be clicked, so list them after it, with the
  // rendered image itself as [0]. OSC 8 makes each URL clickable in terminals
  // that support it (only when stdout is a TTY).
  const linkList = values["no-links"]
    ? ""
    : formatLinkList(extractLinks(source, basePath), { ...stdoutLinks, image: tmpPath })

  const escape = mux ? null : displayInline(bands, { protocol: proto })
  if (escape) {
    process.stdout.write(escape)
    process.stdout.write("\n")
    process.stdout.write(linkList)
    // The list already shows the image as [0]
    if (!linkList) console.error(formatFilePath(tmpPath, stderrLinks))
  } else {
    if (proto === "sixel") {
      console.error("Sixel display requires img2sixel (libsixel).")
      console.error("  macOS:  brew install libsixel")
      console.error("  Linux:  apt install libsixel-bin")
      console.error("")
    }
    console.log(`Saved to: ${formatFilePath(tmpPath, stdoutLinks)}`)
    process.stdout.write(linkList)
  }
}

await dispose()
