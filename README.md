# markterm

[![License: MIT](https://img.shields.io/badge/License-MIT-1E90FF.svg?style=flat)](https://github.com/gospelo-dev/markterm/blob/main/LICENSE) [![Mermaid](https://img.shields.io/badge/Mermaid-11.16.0_(default)-FF3670.svg?style=flat&logo=mermaid&logoColor=white)](https://mermaid.js.org/) [![Playwright](https://img.shields.io/badge/Playwright-Chromium-2EAD33.svg?style=flat&logo=playwright&logoColor=white)](https://playwright.dev/) [![Ghostty](https://img.shields.io/badge/Ghostty-supported-1C1C1C.svg?style=flat)](https://ghostty.org/) [![Kitty](https://img.shields.io/badge/Kitty-supported-784421.svg?style=flat)](https://sw.kovidgoyal.net/kitty/) [![WezTerm](https://img.shields.io/badge/WezTerm-supported-4E49EE.svg?style=flat)](https://wezterm.org/) [![iTerm2](https://img.shields.io/badge/iTerm2-supported-000000.svg?style=flat)](https://iterm2.com/) [![herdr](https://img.shields.io/badge/herdr-supported-8B5CF6.svg?style=flat)](https://herdr.dev/)

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/hero.jpg?raw=true" alt="markterm: Render Markdown inline in any terminal" width="820"></p>

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/demo.gif?raw=true" alt="markterm demo: opening README.md in the viewer, scrolling and following a link" width="820"></p>

View Markdown + MermaidJS in your terminal, rendered like a web page.

markterm renders Markdown with full styling, MermaidJS diagrams and syntax highlighting in a headless Chromium, and shows it in the terminal through the terminal's own graphics protocol. The colors follow your terminal's background and foreground, so the page looks like part of the terminal.

- **Viewer** (the default in terminals with Kitty graphics): a full-screen page you can scroll, zoom and click through. Links to other Markdown, HTML, image and PDF files open in place, animated GIFs and WebPs play, and the page can be saved as HTML or PNG.
- **Image mode** (`-i`, and the fallback everywhere else): the document is printed once as an inline image, followed by a list of its links.

See [docs/QUICKSTART.md](docs/QUICKSTART.md) for a step-by-step setup guide. 日本語版: [README_ja.md](README_ja.md)

## Requirements

| Requirement | Notes |
|-------------|-------|
| Node.js >= 20 or Bun >= 1.1 | Either runtime works. The `markterm` command runs on Node.js; without Node.js, run it with `bunx --bun markterm`. |
| Chromium | Installed once with `npx playwright install chromium` (or `bunx playwright install chromium`). A headless browser is launched on every run. |
| Network access | MermaidJS, and pdf.js for PDFs in the viewer, are loaded from the jsDelivr CDN. Offline, Mermaid blocks stay as raw text and PDFs cannot be shown. |
| `img2sixel` (Sixel terminals only) | From libsixel. Only for image mode on Sixel terminals. |

## Supported Terminals

markterm opens the viewer when stdout is a terminal that draws Kitty graphics, outside tmux/screen, and neither `-i` nor `-o` is given. In every other case it uses image mode, like `less` pages on a terminal and prints through a pipe.

| Terminal | Default | Mouse pointer over links | Verified |
|----------|---------|--------------------------|----------|
| Ghostty | Viewer | Hand pointer | Yes |
| Kitty | Viewer | Hand pointer | Yes |
| WezTerm | Viewer | Unchanged (the link target is shown in the status line) | Yes |
| iTerm2 | Viewer when it answers the Kitty graphics query (3.7.2 does); otherwise image mode | Unchanged (the link target is shown in the status line) | 3.7.2 |
| foot, xterm, mlterm, Konsole, mintty, Black Box | Image mode (Sixel) | - | - |
| Anything else, pipes, CI | Image mode (the PNG is saved and its path printed) | - | - |

The image protocol for image mode is detected in this order:

| Protocol | Terminals | Auto-detected by |
|----------|-----------|------------------|
| Kitty Graphics | Ghostty, Kitty, WezTerm | `TERM=xterm-ghostty`, `TERM_PROGRAM` containing `ghostty` / `kitty` / `WezTerm`, or `GHOSTTY_RESOURCES_DIR`, `GHOSTTY_BIN_DIR`, `KITTY_WINDOW_ID`, `KITTY_PID`, `WEZTERM_PANE` |
| iTerm2 Inline Images | iTerm2 (3.5 or later for renders over 1 MiB) | `TERM_PROGRAM=iTerm.app` or `LC_TERMINAL=iTerm2` |
| Sixel | foot, xterm, mlterm, Konsole, mintty (Git Bash), Black Box | `TERM_PROGRAM` containing `foot` / `mlterm` / `konsole` / `mintty` / `blackbox`, or `TERM=xterm`. Only selected when `img2sixel` is on `PATH`. |
| file (fallback) | Any terminal | Used when nothing above matches. The PNG is saved to a temp file and its path is printed instead of an inline image. |

`markterm --help` prints the detected protocol for the current terminal. For iTerm2, markterm asks the terminal whether it supports Kitty graphics (a 1x1 query followed by a Device Attributes request, so terminals without it answer at once) and opens the viewer only if it does. `-p` or `MARKTERM_PROTOCOL` skips that question.

**Multiplexers**: [herdr](https://herdr.dev/) is supported: the viewer and inline images work inside herdr sessions with no special configuration (verified; the mouse pointer does not change over links there, the status line shows the target). tmux and screen are detected; markterm uses image mode there and, because image escape sequences do not pass through them reliably, saves the PNG and prints its path. Consider migrating from tmux/screen to herdr for full image support.

## Install

```bash
npm install -g markterm
# or: bun install -g markterm
# Without Node.js, run it as: bunx --bun markterm

# Chromium is required for rendering (one time)
npx playwright install chromium
# or: bunx playwright install chromium

# For image mode on Sixel terminals only
# macOS:  brew install libsixel
# Linux:  apt install libsixel-bin
```

## Usage

```bash
# Open the viewer (Ghostty, Kitty, WezTerm, iTerm2 with Kitty graphics)
markterm README.md

# The viewer also opens HTML, image and PDF files
markterm page.html
markterm diagram.png
markterm paper.pdf

# Print one inline image instead
markterm README.md -i

# Save as a self-contained HTML page, or as a PNG
markterm README.md -o README.html
markterm README.md -o README.png

# Read Markdown from stdin (keys are read from the terminal, so the viewer still works)
cat README.md | markterm

# Use a built-in color theme instead of the terminal's colors
markterm README.md -t solarized-light

# Use exact colors
markterm README.md --bg "#ffffff" --fg "#1e1e2e"
```

When Markdown comes from stdin, terminal color auto-detection is skipped (see [Theme](#theme)) and the `dark` theme is used unless `-t` selects another one.

## Viewer

The viewer renders the document in headless Chromium and shows the part that fits the terminal as a Kitty graphics image, with a status line at the bottom. Scrolling and clicks are mapped back onto the page.

### Keys

| Keys | Action |
|------|--------|
| `j` / `k`, arrows, mouse wheel | Scroll |
| `Space` / `b`, `PgDn` / `PgUp` | Page down / up |
| `g` / `G`, `Home` / `End` | Top / bottom |
| Click | Follow a link |
| `h`, `Left`, `Backspace` | Back |
| `+` (or `=`), `-`, `0` | Zoom in, zoom out, reset |
| `r` | Reload the file from disk |
| `s` / `p` | Save as HTML / PNG (Markdown only) |
| `q`, `Ctrl-C` | Quit |

### Links

- Links to local `.md`, `.html`, image and `.pdf` files open in the viewer, with a history for `h`. A fragment (`other.md#install`) scrolls to that heading.
- In-page links (`#section`) scroll the page. Headings get GitHub-style ids, including non-ASCII ones.
- Other links (`https://`, `mailto:`, other files) open with the system's default handler.
- Hovering a link shows its target in the status line. In Ghostty and Kitty the mouse pointer also turns into a hand (OSC 22).

### File types

| Type | Shown as |
|------|----------|
| Markdown (`.md`, `.markdown`, stdin) | Rendered with the theme, fonts, syntax highlighting and MermaidJS, like image mode |
| HTML (`.html`, `.htm`) | The page as it is, with its own CSS, images and scripts. `-t` and the font options do not apply |
| Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.avif`, `.bmp`, `.ico`) | Centred on the theme's background, scaled down to the width when wider |
| PDF (`.pdf`) | Every page drawn with [pdf.js](https://mozilla.github.io/pdf.js/) (loaded from jsDelivr), stacked at the page width. Links inside the PDF are not clickable |

HTML, image and PDF files need the viewer; in image mode markterm exits with code `1` and explains why.

### Zoom and width

- `+` / `-` step through 50% to 300%, like a browser. The page is re-rendered at the new zoom, so text stays sharp. The status line shows the zoom when it is not 100%.
- A page wider than the terminal (common for HTML pages) is zoomed out automatically until it fits, down to 25%. `+` and `-` then work from the fitted level and are kept as chosen.
- `-s` and `-z` set the starting scale and zoom, as in image mode.
- Changing the terminal's font size (for example `Cmd` + `+` in Ghostty) is detected and the page re-rendered at the new cell size.
- While a window is being resized, the viewer waits until the size has been stable for 0.25 s before re-rendering, so dragging does not flicker.

### Animated images

Animated GIFs and WebPs on screen play at up to 10 frames per second. Only the image's cells are captured and drawn over the page, not the whole screen. A frame identical to the last one sent is not sent again, so static images cost no output.

### Saving

- `s` saves the current Markdown page as a self-contained HTML file (local images embedded, Mermaid diagrams drawn), `p` as a PNG of the whole page at the current width and zoom.
- Files are written next to the Markdown file with the same name (`README.html`, `README.png`), or as `markterm.html` / `markterm.png` in the current directory for stdin. An existing file is never overwritten: `README-2.html`, `README-3.html` and so on are used instead.
- Saving is for Markdown documents; for HTML, image and PDF files the viewer says so.

## Options

```
-t, --theme <name>             Use a built-in color theme instead of the terminal's colors (see Theme)
    --bg <#hex>                Background color (#rgb or #rrggbb). Overrides the detected or theme value.
    --fg <#hex>                Foreground color (#rgb or #rrggbb). Overrides the detected or theme value.
-w, --width <auto|px>          Image mode: viewport width in CSS px. auto estimates it from the terminal (default: auto)
    --font <family>            Body font, as a CSS font-family list (e.g. "Noto Sans JP")
    --code-font <family>       Font for inline code and code blocks (e.g. "JetBrains Mono")
    --font-size <px>           Body font size in CSS px (default: 16)
    --no-highlight             Disable syntax highlighting of code blocks
    --no-links                 Image mode: do not list the document's links after the image (see Link list)
-i, --image                    Print one inline image instead of opening the viewer
-s, --scale <factor>           Device scale factor passed to Chromium (default: 2)
    --mermaid <version>        MermaidJS version loaded from jsDelivr (default: 11.16.0)
-z, --zoom <percent>           Zoom, 1-100 (default: 100)
-p, --protocol <name>          Force the image protocol: kitty, iterm2, sixel, file
-o, --output <file>            Save to a file instead of displaying: .png for an image, .html for a self-contained page
-h, --help                     Show help, the detected protocol and the viewer keys
-v, --version                  Show version
```

Positional argument: a file path (Markdown, or for the viewer also HTML, image or PDF). If omitted, Markdown is read from stdin.

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

| Name | Background | Foreground | Link | Code highlighting (Shiki) |
|------|------------|------------|------|---------------------------|
| `dark` | `#1e1e2e` | `#cdd6f4` | `#89b4fa` | `catppuccin-mocha` |
| `light` | `#ffffff` | `#1e1e2e` | `#1e66f5` | `github-light-default` |
| `catppuccin-mocha` | `#1e1e2e` | `#cdd6f4` | `#89b4fa` | `catppuccin-mocha` |
| `catppuccin-latte` | `#eff1f5` | `#4c4f69` | `#1e66f5` | `catppuccin-latte` |
| `dracula` | `#282a36` | `#f8f8f2` | `#bd93f9` | `dracula` |
| `nord` | `#2e3440` | `#d8dee9` | `#81a1c1` | `nord` |
| `gruvbox-dark` | `#282828` | `#ebdbb2` | `#83a598` | `gruvbox-dark-medium` |
| `gruvbox-light` | `#fbf1c7` | `#3c3836` | `#076678` | `gruvbox-light-medium` |
| `solarized-dark` | `#002b36` | `#839496` | `#268bd2` | `solarized-dark` |
| `solarized-light` | `#fdf6e3` | `#657b83` | `#268bd2` | `solarized-light` |
| `tokyo-night` | `#1a1b26` | `#c0caf5` | `#7aa2f7` | `tokyo-night` |
| `one-dark` | `#282c34` | `#abb2bf` | `#61afef` | `one-dark-pro` |
| `github-dark` | `#0d1117` | `#e6edf3` | `#4493f8` | `github-dark-default` |
| `github-light` | `#ffffff` | `#1f2328` | `#0969da` | `github-light-default` |

`markterm --help` also lists the names. An unknown name (from `-t` or `MARKTERM_THEME`), or a `--bg`/`--fg` value that is not a hex color, exits with code `1`.

### Syntax highlighting

Fenced code blocks that name a language (` ```ts `, ` ```python `, ` ```sh `, ...) are highlighted with [Shiki](https://shiki.style/), which supports the same grammars as VS Code. Highlighting runs locally before rendering; it needs no network access.

- The highlighting colors follow the theme: each built-in theme uses the Shiki theme in the table above. With colors detected from the terminal (or set with `--bg`/`--fg`), `github-dark-default` or `github-light-default` is chosen from the background luminance. If `--bg` turns a theme from dark to light or back, the same rule applies.
- The code block keeps the page's code background, so only the text colors come from Shiki.
- Blocks without a language, with an unknown language, and Mermaid blocks are rendered as before.
- `--no-highlight` disables highlighting.

## Image Mode

Image mode prints the document once as an inline image. It is used with `-i`, with `-o`, when output is piped, in tmux/screen, and in terminals without Kitty graphics.

### Width and Zoom

The page is laid out at a viewport width in CSS px and captured at `--scale` times that resolution.

- `-w auto` estimates the width as `terminal columns x 8 px / scale`. Pixel dimensions are not queried from the terminal, so terminals with wide fonts may need an explicit `-w`.
- `-w <px>` sets the viewport width directly.
- `-z <percent>` multiplies the viewport width by `100 / zoom`, so at `-z 50` the page is laid out twice as wide and then displayed at terminal width, which makes the content appear at half size. It does not change the image's on-screen width.
- The rendered image is transmitted with a column count equal to the terminal width, so it always spans the full terminal width for Kitty Graphics and iTerm2. Sixel output is sent at native pixel size.
- **Tall documents**: terminals limit the size of one inline image. Ghostty rejects Kitty Graphics images taller than 10000 px; iTerm2 rejects images of 10000 px or more and shows at most 255 rows per image. When a render is taller than the limit, markterm cuts it into horizontal bands and transmits them one after another, so the document still appears as one continuous image. Bands are at most 10000 px for Kitty Graphics, and for iTerm2 as tall as 255 rows allow at the current terminal width (about 3300 px for a 640 px render on 80 columns). Cut positions are measured in Chromium and placed in the gap between blocks, or at a table row, list item or text line boundary inside a block that is itself taller than a band; never inside an image or diagram. The terminal may leave up to one blank row at each seam. Width is not split, so keep `--width x --scale` below 10000 px. Sixel output is not split. The temp file and `-o` always receive the whole render.
- **Large images in iTerm2**: iTerm2 accepts at most 1 MiB per control sequence. Bands whose base64 payload would exceed that are sent with the multipart form (`MultipartFile`, `FilePart`, `FileEnd`) introduced in iTerm2 3.5. Smaller ones keep the classic single `File=` sequence, which works on every iTerm2 version.
- In image mode iTerm2 always uses its own inline image protocol. Forcing `-p kitty` there draws nothing (iTerm2 3.7.2), although the viewer's Kitty graphics work in the same version.

### Output and Temp Files

- The rendered PNG is always written to `$TMPDIR/markterm-<timestamp>.png` (`/tmp/` if `TMPDIR` is unset). markterm never deletes these files.
- Inline display: the image escape sequence is written to stdout, followed by the link list (see below), whose `[0]` is the temp file. With `--no-links`, the temp file path is written to stderr instead.
- `-o <file>.png`: the PNG is written to the given path and `Saved to <file> (<bytes> bytes)` is printed. Nothing is displayed inline, and no link list is printed.
- `-o <file>.html`: a self-contained HTML page is written instead: the page as the viewer shows it, with local images embedded as data URIs and Mermaid diagrams already drawn as SVG.
- `file` protocol, or Sixel without `img2sixel`: nothing is displayed; `Saved to: <temp path>` is printed so the image can be opened elsewhere, followed by the link list.
- When the output stream is a terminal, printed file paths are clickable OSC 8 hyperlinks, like the link list.

### Link list

Links in the rendered image cannot be clicked, so markterm prints them after the image. `[0]` is the rendered PNG itself; the document's links follow from `[1]`:

```
Links:
  [0] Rendered image  file:///tmp/markterm-1790130710561.png
  [1] License: MIT  https://github.com/gospelo-dev/markterm/blob/main/LICENSE
  [2] docs/QUICKSTART.md  file:///path/to/markterm/docs/QUICKSTART.md
```

- `[0]` is always listed, even when the document has no links.
- When stdout is a terminal, each URL is an [OSC 8 hyperlink](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda), so it can be clicked in terminals that support it (Ghostty, iTerm2, Kitty, WezTerm, foot and others). Other terminals show the plain URL. When stdout is redirected, plain text is written.
- Links are listed in document order, once per URL. The text is the link's plain text, or the alt text of an image inside the link (badges).
- Relative and absolute paths are resolved against the Markdown file's directory (the current directory for stdin) and shown as `file://` URLs.
- In-page anchors (`#section`) and plain images are not listed. Links written as raw HTML `<a>` tags are not listed either.
- Control characters in link text and URLs are removed, so a document cannot inject terminal escape sequences through its links.
- `--no-links` turns the list off; the temp file path is then printed on its own line as before.

Exit codes: `0` on success, `1` if the input file does not exist, the Markdown is empty, or the file can only be shown in the viewer.

## How It Works

1. **marked** parses Markdown to HTML with a custom extension that turns ` ```mermaid ` fences into `<pre class="mermaid">` blocks, and **Shiki** highlights the other fenced code blocks that name a language
2. **Playwright** loads the HTML in headless Chromium with MermaidJS from CDN and waits until every Mermaid block has produced an SVG (up to 10 seconds; rendering proceeds after that even if some blocks are still raw)
3. In the viewer, the visible part of the page is captured and shown as a Kitty graphics image placed in the terminal's cells; the terminal's cell size is queried (`CSI 16 t`, iTerm2's `ReportCellSize`, or `CSI 14 t`) so the page matches the cells exactly. Mouse clicks and motion (SGR mouse reporting) are mapped to page coordinates to find links
4. In image mode, the `<body>` element is captured as a PNG screenshot. For Kitty Graphics and iTerm2, a render taller than the terminal's limit is also captured as bands cut at measured block boundaries (see [Width and Zoom](#width-and-zoom)), and the PNG (or each band in turn) is transmitted to the terminal via the selected image protocol

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
| `markdownToImage(source, options?)` | Render Markdown to a PNG `Uint8Array`. Options: `width`, `fontSize`, `fontFamily`, `codeFontFamily`, `colors`, `mermaidVersion`, `deviceScaleFactor`, `highlight` (default `true`). Font values are used as-is (no generic fallback is appended). The Shiki theme is `colors.codeTheme`, or chosen from the background luminance when unset. |
| `markdownToImageBands(source, options)` | Like `markdownToImage`, plus `maxBandHeight` (px). Returns `{ png, bands }`: the whole render and its horizontal bands, each at most `maxBandHeight` tall, cut at measured block boundaries. `bands` has one element (`=== png`) when no split is needed. |
| `markdownToDocument(source, options?)` | The HTML page the viewer shows: it fills the window, resolves relative images and links against `basePath`, and gives headings GitHub-style ids. Options as `markdownToImage` without `width` and `deviceScaleFactor`, plus `basePath`. |
| `markdownToStandaloneHtml(source, options?)` | The same page as a self-contained HTML string, as written by `-o file.html`: local images embedded as data URIs, Mermaid diagrams drawn as SVG. Uses Chromium. |
| `measureCutCandidates(source, options?)` | Render and return `{ height, candidates }`: the body height and the cut positions markterm would consider, in CSS px. For debugging. |
| `chooseCuts(candidates, totalHeight, maxBand)` | The band selection itself: greedy, lowest candidate within reach, hard cut when none. Pure function. |
| `dispose()` | Close the shared Chromium instance. Call once when done. |
| `renderMarkdown(source)` | Markdown to HTML string (marked + Mermaid extension), without syntax highlighting. |
| `renderMarkdownHighlighted(source, { codeTheme })` | Like `renderMarkdown`, with code blocks highlighted by Shiki using the given Shiki theme name. Async. |
| `buildHtml(html, options?)` | Wrap rendered HTML in the styled page template. |
| `detectProtocol()` | Return the protocol for the current terminal: `kitty`, `iterm2`, `sixel`, or `file`. |
| `detectMultiplexer()` | Return `"tmux"`, `"screen"`, or `null` based on the `TMUX` and `STY` environment variables. |
| `displayInline(png, { protocol? })` | Build the escape sequence string that displays the PNG inline, or `null` for `file`. `png` may also be an array of bands, which are joined so they display one under another. |
| `maxBandHeightFor(protocol, pixelWidth)` | The `maxBandHeight` the CLI uses for a protocol: `KITTY_MAX_IMAGE_DIMENSION` for `kitty`, `iterm2MaxBandHeight(pixelWidth, columns)` for `iterm2`, `null` for `sixel` and `file`. |
| `KITTY_MAX_IMAGE_DIMENSION` | `10000`. The per-dimension limit Ghostty enforces on Kitty Graphics images. |
| `ITERM2_MAX_IMAGE_DIMENSION`, `ITERM2_MAX_ROWS`, `iterm2MaxBandHeight(pixelWidth, cols)` | iTerm2's limits (`10000`, rejected when reached; `255` rows per image) and the band height that keeps a `pixelWidth`-wide render within 255 rows on `cols` columns. |
| `getTerminalSize()` | Columns and rows of the terminal (`pixelWidth`/`pixelHeight` are always `null` in this version). |
| `estimateViewportWidth(scale)` | The `-w auto` heuristic. |
| `extractLinks(source, basePath?)` | The document's links as `MarkdownLink[]` (`{ text, href, url }`), as used for the [link list](#link-list). |
| `formatLinkList(links, { hyperlinks, image? })` | Format links as the CLI's numbered list, with OSC 8 hyperlinks when `hyperlinks` is `true`. With `image` (a file path), that file is listed first as `[0] Rendered image`. |
| `formatFilePath(path, { hyperlinks })` | A file path for printing; with `hyperlinks`, an OSC 8 hyperlink to its absolute `file://` URL that shows the path as given. |
| `queryTerminalColors()` | Query `bg`, `fg`, `blue` via OSC. Returns `null` if stdin/stdout is not a TTY or the terminal does not answer. |
| `deriveTheme(bg, fg, blue, codeTheme?)` | Build `ThemeColors` from three hex colors, plus an optional Shiki theme name. |
| `fallbackTheme("dark" \| "light")` | Built-in `ThemeColors`. |
| `getTheme(name)` | `ThemeColors` for a built-in theme name (see [Built-in themes](#built-in-themes)), or `null` if unknown. |
| `THEME_NAMES` | All names accepted by `getTheme`. |
| `normalizeHex(value)` | `"#rgb"` / `"#rrggbb"` to lowercase `"#rrggbb"`, or `null` if not a hex color. |
| `isDark(hex)` | Luminance check used to pick the Mermaid theme. |

Types: `ScreenshotOptions`, `BandOptions`, `ImageBands`, `DocumentOptions`, `MeasuredCandidates`, `TemplateOptions`, `ThemeColors`, `TerminalColors`, `TerminalSize`, `Protocol`, `Multiplexer`.

## License

MIT
