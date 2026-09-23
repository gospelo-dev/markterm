# markterm

[![License: MIT](https://img.shields.io/badge/License-MIT-1E90FF.svg?style=flat)](https://github.com/gospelo-dev/markterm/blob/main/LICENSE) [![Mermaid](https://img.shields.io/badge/Mermaid-11.16.0_(default)-FF3670.svg?style=flat&logo=mermaid&logoColor=white)](https://mermaid.js.org/) [![Playwright](https://img.shields.io/badge/Playwright-Chromium-2EAD33.svg?style=flat&logo=playwright&logoColor=white)](https://playwright.dev/) [![Ghostty](https://img.shields.io/badge/Ghostty-supported-1C1C1C.svg?style=flat)](https://ghostty.org/) [![iTerm2](https://img.shields.io/badge/iTerm2-supported-000000.svg?style=flat)](https://iterm2.com/) [![herdr](https://img.shields.io/badge/herdr-supported-8B5CF6.svg?style=flat)](https://herdr.dev/)

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/hero.jpg?raw=true" alt="markterm: Render Markdown inline in any terminal" width="820"></p>

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/demo.gif?raw=true" alt="markterm demo: rendering README.md inline in Ghostty" width="820"></p>

Render Markdown + MermaidJS as inline images in your terminal.

markterm takes a Markdown file, renders it with full styling and MermaidJS diagram support in a headless Chromium, and displays the resulting PNG directly in your terminal using the terminal's native image protocol. The colors follow your terminal's own background and foreground, so the preview looks like part of the terminal.

See [docs/QUICKSTART.md](docs/QUICKSTART.md) for a step-by-step setup guide. 日本語版: [README_ja.md](README_ja.md)

## Requirements

| Requirement | Notes |
|-------------|-------|
| Node.js >= 20 or Bun >= 1.1 | Either runtime works. The `markterm` command runs on Node.js; without Node.js, run it with `bunx --bun markterm`. |
| Chromium | Installed once with `npx playwright install chromium` (or `bunx playwright install chromium`). A headless browser is launched on every run. |
| Network access | MermaidJS is loaded from the jsDelivr CDN at render time. Offline, Mermaid blocks stay as raw text. |
| `img2sixel` (Sixel terminals only) | From libsixel. Not needed for Kitty Graphics or iTerm2 terminals. |

## Supported Terminals

| Protocol | Terminals | Auto-detected by |
|----------|-----------|------------------|
| Kitty Graphics | Ghostty, Kitty, WezTerm | `TERM=xterm-ghostty`, `TERM_PROGRAM` containing `ghostty` / `kitty` / `WezTerm`, or `GHOSTTY_RESOURCES_DIR`, `GHOSTTY_BIN_DIR`, `KITTY_WINDOW_ID`, `KITTY_PID`, `WEZTERM_PANE` |
| iTerm2 Inline Images | iTerm2 (3.5 or later for renders over 1 MiB) | `TERM_PROGRAM=iTerm.app` or `LC_TERMINAL=iTerm2` |
| Sixel | foot, xterm, mlterm, Konsole, mintty (Git Bash), Black Box | `TERM_PROGRAM` containing `foot` / `mlterm` / `konsole` / `mintty` / `blackbox`, or `TERM=xterm`. Only selected when `img2sixel` is on `PATH`. |
| file (fallback) | Any terminal | Used when nothing above matches. The PNG is saved to a temp file and its path is printed instead of an inline image. |

Detection runs in the order listed. `markterm --help` prints the detected protocol for the current terminal.

**Multiplexers**: [herdr](https://herdr.dev/) is supported — inline images display correctly inside herdr sessions with no special configuration. tmux and screen are detected but inline display is disabled because image escape sequences do not pass through them reliably; markterm falls back to saving the PNG and printing its path. Consider migrating from tmux/screen to herdr for full image support.

Forcing `-p kitty` in iTerm2 does not work (verified with iTerm2 3.7.2: nothing is drawn); use the auto-detected `iterm2` protocol there.

## Install

```bash
npm install -g markterm
# or: bun install -g markterm
# Without Node.js, run it as: bunx --bun markterm

# Chromium is required for rendering (one time)
npx playwright install chromium
# or: bunx playwright install chromium

# For Sixel terminals only
# macOS:  brew install libsixel
# Linux:  apt install libsixel-bin
```

## Usage

```bash
# Display inline in the terminal
markterm README.md

# Zoom out to 50%: content shrinks, image still fills the terminal width
markterm README.md -z 50

# Save as PNG instead of displaying
markterm README.md -o output.png

# Read from stdin
cat README.md | markterm

# Use a built-in color theme instead of the terminal's colors
markterm README.md -t light
markterm README.md -t solarized-light

# Use exact colors
markterm README.md --bg "#ffffff" --fg "#1e1e2e"
```

When Markdown comes from stdin, terminal color auto-detection is skipped (see [Theme](#theme)) and the `dark` theme is used unless `-t` selects another one.

## Options

```
-t, --theme <name>             Use a built-in color theme instead of the terminal's colors (see Theme)
    --bg <#hex>                Background color (#rgb or #rrggbb). Overrides the detected or theme value.
    --fg <#hex>                Foreground color (#rgb or #rrggbb). Overrides the detected or theme value.
-w, --width <auto|px>          Viewport width in CSS px. auto estimates it from the terminal (default: auto)
    --font <family>            Body font, as a CSS font-family list (e.g. "Noto Sans JP")
    --code-font <family>       Font for inline code and code blocks (e.g. "JetBrains Mono")
    --font-size <px>           Body font size in CSS px (default: 16)
-s, --scale <factor>           Device scale factor passed to Chromium (default: 2)
    --mermaid <version>        MermaidJS version loaded from jsDelivr (default: 11.16.0)
-z, --zoom <percent>           Display zoom, 1-100 (default: 100)
-p, --protocol <name>          Force the image protocol: kitty, iterm2, sixel, file
-o, --output <file.png>        Save the PNG to a file instead of displaying it
-h, --help                     Show help, the detected protocol and terminal columns
-v, --version                  Show version
```

Positional argument: a Markdown file path. If omitted, Markdown is read from stdin.

Protocol precedence: `-p` > `MARKTERM_PROTOCOL` > auto-detection.

Theme and font precedence: command-line option > environment variable (`MARKTERM_THEME`, `MARKTERM_FONT`, `MARKTERM_CODE_FONT`) > default. See [Environment Variables](#environment-variables).

### Fonts

`--font` and `--code-font` take a CSS `font-family` list, so several fonts can be given in order of preference (`--font "Inter, Noto Sans JP"`). A generic family (`sans-serif` for `--font`, `monospace` for `--code-font`) is appended automatically, so a font that is not installed falls back to a similar one. Fonts are resolved by headless Chromium from the fonts installed on the system. Without these options the body uses the system UI font and code uses the browser's default monospace font. Values containing `;`, `{`, `}`, `<` or `>` are rejected with exit code `1`.

## Theme

By default markterm does not use a fixed color scheme. On every run it asks the terminal for its colors and builds the page style from them:

1. Background via `OSC 11`, foreground via `OSC 10`, and the palette's blue (used for links) via `OSC 4;4`. Each query waits up to 500 ms for a reply.
2. From the background and foreground it derives the code-block background, table borders, and picks the MermaidJS theme (`dark` or `default`) based on background luminance.
3. `--bg` and `--fg` override individual detected values. If both are given, the terminal is not queried at all and the link color falls back to `#89b4fa`.
4. If the query fails or is not possible, the `dark` theme is used.

Auto-detection requires both stdin and stdout to be a TTY. It is therefore skipped when Markdown is piped in, when output is redirected, and inside some multiplexers. In those cases use `-t` or `--bg`/`--fg`.

### Built-in themes

`-t <name>` sets background, foreground and link color at once from a built-in theme and skips the terminal query. To use a theme by default, set `MARKTERM_THEME` (for example `export MARKTERM_THEME=nord` in your shell profile); `-t` overrides it. `--bg` and `--fg` can still override individual colors on top of it (`-t nord --bg "#000000"`).

| Name | Background | Foreground | Link |
|------|------------|------------|------|
| `dark` | `#1e1e2e` | `#cdd6f4` | `#89b4fa` |
| `light` | `#ffffff` | `#1e1e2e` | `#1e66f5` |
| `catppuccin-mocha` | `#1e1e2e` | `#cdd6f4` | `#89b4fa` |
| `catppuccin-latte` | `#eff1f5` | `#4c4f69` | `#1e66f5` |
| `dracula` | `#282a36` | `#f8f8f2` | `#bd93f9` |
| `nord` | `#2e3440` | `#d8dee9` | `#81a1c1` |
| `gruvbox-dark` | `#282828` | `#ebdbb2` | `#83a598` |
| `gruvbox-light` | `#fbf1c7` | `#3c3836` | `#076678` |
| `solarized-dark` | `#002b36` | `#839496` | `#268bd2` |
| `solarized-light` | `#fdf6e3` | `#657b83` | `#268bd2` |
| `tokyo-night` | `#1a1b26` | `#c0caf5` | `#7aa2f7` |
| `one-dark` | `#282c34` | `#abb2bf` | `#61afef` |
| `github-dark` | `#0d1117` | `#e6edf3` | `#4493f8` |
| `github-light` | `#ffffff` | `#1f2328` | `#0969da` |

`markterm --help` also lists the names. An unknown name (from `-t` or `MARKTERM_THEME`), or a `--bg`/`--fg` value that is not a hex color, exits with code `1`.

## Width and Zoom

The page is laid out at a viewport width in CSS px and captured at `--scale` times that resolution.

- `-w auto` estimates the width as `terminal columns x 8 px / scale`. Pixel dimensions are not queried from the terminal, so terminals with wide fonts may need an explicit `-w`.
- `-w <px>` sets the viewport width directly.
- `-z <percent>` multiplies the viewport width by `100 / zoom`, so at `-z 50` the page is laid out twice as wide and then displayed at terminal width, which makes the content appear at half size. It does not change the image's on-screen width.
- The rendered image is transmitted with a column count equal to the terminal width, so it always spans the full terminal width for Kitty Graphics and iTerm2. Sixel output is sent at native pixel size.
- **Tall documents**: terminals limit the size of one inline image. Ghostty rejects Kitty Graphics images taller than 10000 px; iTerm2 rejects images of 10000 px or more and shows at most 255 rows per image. When a render is taller than the limit, markterm cuts it into horizontal bands and transmits them one after another, so the document still appears as one continuous image. Bands are at most 10000 px for Kitty Graphics, and for iTerm2 as tall as 255 rows allow at the current terminal width (about 3300 px for a 640 px render on 80 columns). Cut positions are measured in Chromium and placed in the gap between blocks, or at a table row, list item or text line boundary inside a block that is itself taller than a band; never inside an image or diagram. The terminal may leave up to one blank row at each seam. Width is not split, so keep `--width x --scale` below 10000 px. Sixel output is not split. The temp file and `-o` always receive the whole render.
- **Large images in iTerm2**: iTerm2 accepts at most 1 MiB per control sequence. Bands whose base64 payload would exceed that are sent with the multipart form (`MultipartFile`, `FilePart`, `FileEnd`) introduced in iTerm2 3.5. Smaller ones keep the classic single `File=` sequence, which works on every iTerm2 version.

## Output and Temp Files

- The rendered PNG is always written to `$TMPDIR/markterm-<timestamp>.png` (`/tmp/` if `TMPDIR` is unset). markterm never deletes these files.
- Inline display: the image escape sequence is written to stdout, then the temp file path is written to stderr.
- `-o <file>`: the PNG is written to the given path and `Saved to <file> (<bytes> bytes)` is printed. Nothing is displayed inline.
- `file` protocol, or Sixel without `img2sixel`: nothing is displayed; `Saved to: <temp path>` is printed so the image can be opened elsewhere.

Exit codes: `0` on success, `1` if the input file does not exist or the Markdown is empty.

## How It Works

1. **marked** parses Markdown to HTML with a custom extension that turns ` ```mermaid ` fences into `<pre class="mermaid">` blocks
2. **Playwright** loads the HTML in headless Chromium with MermaidJS from CDN and waits until every Mermaid block has produced an SVG (up to 10 seconds; rendering proceeds after that even if some blocks are still raw)
3. The `<body>` element is captured as a PNG screenshot. For Kitty Graphics and iTerm2, a render taller than the terminal's limit is also captured as bands cut at measured block boundaries (see [Width and Zoom](#width-and-zoom))
4. The PNG (or each band in turn) is transmitted to the terminal via the selected image protocol

## MermaidJS Support

markterm loads MermaidJS from the jsDelivr CDN at render time, so any published version can be used by passing `--mermaid <version>`.

| MermaidJS version | Status |
|-------------------|--------|
| 11.16.0 | Default. Used when `--mermaid` is not given. Verified. |
| 12.0.0 | Latest release as of 2026-09-22. Verified with `--mermaid 12.0.0`. |
| Other versions | Any version available on jsDelivr can be specified. Not individually verified. |

All diagram types provided by the selected MermaidJS version are supported: Flowchart, Sequence, Class, State, ER, Gantt, Pie, Git Graph, and more. The Mermaid theme is chosen automatically (`dark` for dark backgrounds, `default` for light ones).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MARKTERM_PROTOCOL` | Override auto-detected protocol (`kitty`, `iterm2`, `sixel`, `file`). `-p` takes precedence over this variable. |
| `MARKTERM_THEME` | Default built-in theme, as with `-t`. `-t` takes precedence. An empty value is ignored. |
| `MARKTERM_FONT` | Default body font, as with `--font`. `--font` takes precedence. |
| `MARKTERM_CODE_FONT` | Default code font, as with `--code-font`. `--code-font` takes precedence. |
| `TMPDIR` | Directory for the temp PNG. Defaults to `/tmp/`. |

## Library Usage

markterm can also be used as a library from Node.js or Bun. It ships as ES modules with TypeScript type definitions.

```typescript
import { writeFile } from "node:fs/promises"
import { markdownToImage, dispose, fallbackTheme } from "markterm"

const png = await markdownToImage("# Hello\n\n```mermaid\ngraph LR\n  A-->B\n```", {
  colors: fallbackTheme("dark"),
  width: 800,
  fontSize: 16,
  deviceScaleFactor: 2,
  mermaidVersion: "11.16.0",
})

await writeFile("output.png", png)
await dispose() // closes the shared Chromium instance
```

To match the current terminal's colors from a TTY, replace `fallbackTheme("dark")` with:

```typescript
import { queryTerminalColors, deriveTheme, fallbackTheme } from "markterm"

const detected = await queryTerminalColors()
const colors = detected
  ? deriveTheme(detected.bg, detected.fg, detected.blue)
  : fallbackTheme("dark")
```

Exported API:

| Export | Description |
|--------|-------------|
| `markdownToImage(source, options?)` | Render Markdown to a PNG `Uint8Array`. Options: `width`, `fontSize`, `fontFamily`, `codeFontFamily`, `colors`, `mermaidVersion`, `deviceScaleFactor`. Font values are used as-is (no generic fallback is appended). |
| `markdownToImageBands(source, options)` | Like `markdownToImage`, plus `maxBandHeight` (px). Returns `{ png, bands }`: the whole render and its horizontal bands, each at most `maxBandHeight` tall, cut at measured block boundaries. `bands` has one element (`=== png`) when no split is needed. |
| `measureCutCandidates(source, options?)` | Render and return `{ height, candidates }`: the body height and the cut positions markterm would consider, in CSS px. For debugging. |
| `chooseCuts(candidates, totalHeight, maxBand)` | The band selection itself: greedy, lowest candidate within reach, hard cut when none. Pure function. |
| `dispose()` | Close the shared Chromium instance. Call once when done. |
| `renderMarkdown(source)` | Markdown to HTML string (marked + Mermaid extension). |
| `buildHtml(html, options?)` | Wrap rendered HTML in the styled page template. |
| `detectProtocol()` | Return the protocol for the current terminal: `kitty`, `iterm2`, `sixel`, or `file`. |
| `detectMultiplexer()` | Return `"tmux"`, `"screen"`, or `null` based on the `TMUX` and `STY` environment variables. |
| `displayInline(png, { protocol? })` | Build the escape sequence string that displays the PNG inline, or `null` for `file`. `png` may also be an array of bands, which are joined so they display one under another. |
| `maxBandHeightFor(protocol, pixelWidth)` | The `maxBandHeight` the CLI uses for a protocol: `KITTY_MAX_IMAGE_DIMENSION` for `kitty`, `iterm2MaxBandHeight(pixelWidth, columns)` for `iterm2`, `null` for `sixel` and `file`. |
| `KITTY_MAX_IMAGE_DIMENSION` | `10000`. The per-dimension limit Ghostty enforces on Kitty Graphics images. |
| `ITERM2_MAX_IMAGE_DIMENSION`, `ITERM2_MAX_ROWS`, `iterm2MaxBandHeight(pixelWidth, cols)` | iTerm2's limits (`10000`, rejected when reached; `255` rows per image) and the band height that keeps a `pixelWidth`-wide render within 255 rows on `cols` columns. |
| `getTerminalSize()` | Columns and rows of the terminal (`pixelWidth`/`pixelHeight` are always `null` in this version). |
| `estimateViewportWidth(scale)` | The `-w auto` heuristic. |
| `queryTerminalColors()` | Query `bg`, `fg`, `blue` via OSC. Returns `null` if stdin/stdout is not a TTY or the terminal does not answer. |
| `deriveTheme(bg, fg, blue)` | Build `ThemeColors` from three hex colors. |
| `fallbackTheme("dark" \| "light")` | Built-in `ThemeColors`. |
| `getTheme(name)` | `ThemeColors` for a built-in theme name (see [Built-in themes](#built-in-themes)), or `null` if unknown. |
| `THEME_NAMES` | All names accepted by `getTheme`. |
| `normalizeHex(value)` | `"#rgb"` / `"#rrggbb"` to lowercase `"#rrggbb"`, or `null` if not a hex color. |
| `isDark(hex)` | Luminance check used to pick the Mermaid theme. |

Types: `ScreenshotOptions`, `BandOptions`, `ImageBands`, `MeasuredCandidates`, `TemplateOptions`, `ThemeColors`, `TerminalColors`, `TerminalSize`, `Protocol`, `Multiplexer`.

## License

MIT
