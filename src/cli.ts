#!/usr/bin/env bun
import { resolve, dirname } from "path"
import { parseArgs } from "util"
import { markdownToImage, markdownToImageBands, dispose } from "./render/screenshot.js"
import { detectProtocol, displayInline, maxBandHeightFor, type Protocol } from "./protocol/index.js"
import { estimateViewportWidth } from "./terminal.js"
import { queryTerminalColors } from "./colorquery.js"
import { deriveTheme, fallbackTheme, type ThemeColors } from "./render/themes.js"
import pkg from "../package.json" with { type: "json" }

const VERSION: string = pkg.version

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    theme: { type: "string", short: "t" },
    bg: { type: "string" },
    fg: { type: "string" },
    width: { type: "string", short: "w", default: "auto" },
    "font-size": { type: "string", default: "16" },
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
  -t, --theme <dark|light>       Fallback theme when auto-detect fails (default: dark)
      --bg <#hex>                Override background color
      --fg <#hex>                Override foreground color
  -w, --width <auto|px>          Viewport width: auto fits terminal (default: auto)
      --font-size <px>           Body font size (default: 16)
  -s, --scale <factor>           Device scale factor (default: 2)
      --mermaid <version>        MermaidJS version (default: 11.16.0)
  -z, --zoom <percent>           Display zoom: 1-100% of terminal width (default: 100)
  -p, --protocol <name>          Force protocol: kitty, iterm2, sixel, file
  -o, --output <file.png>        Save PNG to file instead of displaying
  -h, --help                     Show this help
  -v, --version                  Show version

Theme auto-detection:
  markterm queries your terminal's colors via OSC 10/11 escape sequences
  on every run. Use --bg/--fg to override, or -t dark/light as fallback.

Detected terminal protocol: ${detected}
Terminal columns: ${process.stdout.columns || "unknown"}

Supported terminals:
  kitty     Ghostty, Kitty, WezTerm
  iterm2    iTerm2 (native, no deps)
  sixel     foot, xterm, mlterm, Konsole, mintty, Black Box

Prerequisites:
  Sixel output requires img2sixel (libsixel).
    macOS:  brew install libsixel
    Linux:  apt install libsixel-bin

Environment:
  MARKTERM_PROTOCOL    Override auto-detected protocol`)
  process.exit(0)
}

async function resolveColors(): Promise<ThemeColors> {
  if (values.bg && values.fg) {
    return deriveTheme(values.bg, values.fg, "#89b4fa")
  }

  const detected = await queryTerminalColors()
  if (detected) {
    const bg = values.bg || detected.bg
    const fg = values.fg || detected.fg
    return deriveTheme(bg, fg, detected.blue)
  }

  const mode = values.theme === "light" ? "light" : "dark"
  return fallbackTheme(mode)
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
  const file = Bun.file(positionals[0])
  if (!(await file.exists())) {
    console.error(`File not found: ${positionals[0]}`)
    process.exit(1)
  }
  source = await file.text()
  basePath = dirname(resolve(positionals[0]))
} else {
  const chunks: Uint8Array[] = []
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(chunk)
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
  deviceScaleFactor: scale,
  mermaidVersion,
  basePath,
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
await Bun.write(tmpPath, png)

if (values.output) {
  await Bun.write(values.output, png)
  console.log(`Saved to ${values.output} (${png.length} bytes)`)
} else {
  const escape = displayInline(bands, { protocol: proto })
  if (escape) {
    process.stdout.write(escape)
    process.stdout.write("\n")
    console.error(`${tmpPath}`)
  } else {
    if (proto === "sixel") {
      console.error("Sixel display requires img2sixel (libsixel).")
      console.error("  macOS:  brew install libsixel")
      console.error("  Linux:  apt install libsixel-bin")
      console.error("")
    }
    console.log(`Saved to: ${tmpPath}`)
  }
}

await dispose()
