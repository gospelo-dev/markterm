# markterm

[![License: MIT](https://img.shields.io/badge/License-MIT-1E90FF.svg?style=flat)](https://github.com/gospelo-dev/markterm/blob/main/LICENSE) [![Mermaid](https://img.shields.io/badge/Mermaid-11.16.0_(default)-FF3670.svg?style=flat&logo=mermaid&logoColor=white)](https://mermaid.js.org/) [![Playwright](https://img.shields.io/badge/Playwright-Chromium-2EAD33.svg?style=flat&logo=playwright&logoColor=white)](https://playwright.dev/)

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/hero.jpg?raw=true" alt="markterm: Render Markdown inline in any terminal" width="820"></p>

Render Markdown + MermaidJS as inline images in your terminal.

markterm takes a Markdown file, renders it with full styling and MermaidJS diagram support in a headless Chromium, and displays the resulting PNG directly in your terminal using the terminal's native image protocol. The colors follow your terminal's own background and foreground, so the preview looks like part of the terminal.

See [docs/QUICKSTART.md](docs/QUICKSTART.md) for a step-by-step setup guide. 日本語版: [README_ja.md](README_ja.md)

## Requirements

| Requirement | Notes |
|-------------|-------|
| Bun >= 1.1 | markterm is a Bun application. It does not run on Node.js. |
| Chromium | Installed once with `bunx playwright install chromium`. A headless browser is launched on every run. |
| Network access | MermaidJS is loaded from the jsDelivr CDN at render time. Offline, Mermaid blocks stay as raw text. |
| `img2sixel` (Sixel terminals only) | From libsixel. Not needed for Kitty Graphics or iTerm2 terminals. |

## Supported Terminals

| Protocol | Terminals | Auto-detected by |
|----------|-----------|------------------|
| Kitty Graphics | Ghostty, Kitty, WezTerm | `TERM=xterm-ghostty`, `TERM_PROGRAM` containing `ghostty` / `kitty` / `WezTerm`, or `GHOSTTY_RESOURCES_DIR`, `GHOSTTY_BIN_DIR`, `KITTY_WINDOW_ID`, `KITTY_PID`, `WEZTERM_PANE` |
| iTerm2 Inline Images | iTerm2 | `TERM_PROGRAM=iTerm.app` or `LC_TERMINAL=iTerm2` |
| Sixel | foot, xterm, mlterm, Konsole, mintty (Git Bash), Black Box | `TERM_PROGRAM` containing `foot` / `mlterm` / `konsole` / `mintty` / `blackbox`, or `TERM=xterm`. Only selected when `img2sixel` is on `PATH`. |
| file (fallback) | Any terminal | Used when nothing above matches. The PNG is saved to a temp file and its path is printed instead of an inline image. |

Detection runs in the order listed. `markterm --help` prints the detected protocol for the current terminal. Terminal multiplexers such as tmux or screen are not handled specially; image escape sequences generally do not pass through them, so expect the `file` fallback there.

## Install

```bash
bun install -g markterm

# Chromium is required for rendering (one time)
bunx playwright install chromium

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

# Force a light theme when auto-detection is not available
cat README.md | markterm -t light

# Use exact colors
markterm README.md --bg "#ffffff" --fg "#1e1e2e"
```

When Markdown comes from stdin, terminal color auto-detection is skipped (see [Theme](#theme)) and the fallback theme selected by `-t` is used.

## Options

```
-t, --theme <dark|light>       Fallback theme when color auto-detection fails (default: dark)
    --bg <#hex>                Background color. Overrides the detected value.
    --fg <#hex>                Foreground color. Overrides the detected value.
-w, --width <auto|px>          Viewport width in CSS px. auto estimates it from the terminal (default: auto)
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

## Theme

markterm does not ship a fixed color scheme. On every run it asks the terminal for its colors and builds the page style from them:

1. Background via `OSC 11`, foreground via `OSC 10`, and the palette's blue (used for links) via `OSC 4;4`. Each query waits up to 500 ms for a reply.
2. From the background and foreground it derives the code-block background, table borders, and picks the MermaidJS theme (`dark` or `default`) based on background luminance.
3. `--bg` and `--fg` override individual detected values. If both are given, the terminal is not queried at all and the link color falls back to `#89b4fa`.
4. If the query fails or is not possible, the fallback theme selected by `-t` is used: `dark` (Catppuccin-like, `#1e1e2e` on `#cdd6f4`) or `light` (`#ffffff` on `#1e1e2e`).

Auto-detection requires both stdin and stdout to be a TTY. It is therefore skipped when Markdown is piped in, when output is redirected, and inside some multiplexers. In those cases use `-t` or `--bg`/`--fg`.

## Width and Zoom

The page is laid out at a viewport width in CSS px and captured at `--scale` times that resolution.

- `-w auto` estimates the width as `terminal columns x 8 px / scale`. Pixel dimensions are not queried from the terminal, so terminals with wide fonts may need an explicit `-w`.
- `-w <px>` sets the viewport width directly.
- `-z <percent>` multiplies the viewport width by `100 / zoom`, so at `-z 50` the page is laid out twice as wide and then displayed at terminal width, which makes the content appear at half size. It does not change the image's on-screen width.
- The rendered image is transmitted with a column count equal to the terminal width, so it always spans the full terminal width for Kitty Graphics and iTerm2. Sixel output is sent at native pixel size.

## Output and Temp Files

- The rendered PNG is always written to `$TMPDIR/markterm-<timestamp>.png` (`/tmp/` if `TMPDIR` is unset). markterm never deletes these files.
- Inline display: the image escape sequence is written to stdout, then the temp file path is written to stderr.
- `-o <file>`: the PNG is written to the given path and `Saved to <file> (<bytes> bytes)` is printed. Nothing is displayed inline.
- `file` protocol, or Sixel without `img2sixel`: nothing is displayed; `Saved to: <temp path>` is printed so the image can be opened elsewhere.

Exit codes: `0` on success, `1` if the input file does not exist or the Markdown is empty.

## How It Works

1. **marked** parses Markdown to HTML with a custom extension that turns ` ```mermaid ` fences into `<pre class="mermaid">` blocks
2. **Playwright** loads the HTML in headless Chromium with MermaidJS from CDN and waits until every Mermaid block has produced an SVG (up to 10 seconds; rendering proceeds after that even if some blocks are still raw)
3. The `<body>` element is captured as a PNG screenshot
4. The PNG is transmitted to the terminal via the selected image protocol

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
| `TMPDIR` | Directory for the temp PNG. Defaults to `/tmp/`. |

## Library Usage

markterm can also be used as a library from Bun. The entry point is TypeScript source, so it requires Bun (or a TypeScript-aware bundler).

```typescript
import { markdownToImage, dispose, fallbackTheme } from "markterm"

const png = await markdownToImage("# Hello\n\n```mermaid\ngraph LR\n  A-->B\n```", {
  colors: fallbackTheme("dark"),
  width: 800,
  fontSize: 16,
  deviceScaleFactor: 2,
  mermaidVersion: "11.16.0",
})

await Bun.write("output.png", png)
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
| `markdownToImage(source, options?)` | Render Markdown to a PNG `Uint8Array`. Options: `width`, `fontSize`, `fontFamily`, `colors`, `mermaidVersion`, `deviceScaleFactor`. |
| `dispose()` | Close the shared Chromium instance. Call once when done. |
| `renderMarkdown(source)` | Markdown to HTML string (marked + Mermaid extension). |
| `buildHtml(html, options?)` | Wrap rendered HTML in the styled page template. |
| `detectProtocol()` | Return the protocol for the current terminal: `kitty`, `iterm2`, `sixel`, or `file`. |
| `displayInline(png, { protocol? })` | Build the escape sequence string that displays the PNG inline, or `null` for `file`. |
| `getTerminalSize()` | Columns and rows of the terminal (`pixelWidth`/`pixelHeight` are always `null` in this version). |
| `estimateViewportWidth(scale)` | The `-w auto` heuristic. |
| `queryTerminalColors()` | Query `bg`, `fg`, `blue` via OSC. Returns `null` if stdin/stdout is not a TTY or the terminal does not answer. |
| `deriveTheme(bg, fg, blue)` | Build `ThemeColors` from three hex colors. |
| `fallbackTheme("dark" \| "light")` | Built-in `ThemeColors`. |
| `isDark(hex)` | Luminance check used to pick the Mermaid theme. |

Types: `ScreenshotOptions`, `TemplateOptions`, `ThemeColors`, `TerminalColors`, `TerminalSize`, `Protocol`.

## License

MIT
