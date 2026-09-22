# Quickstart

## 0. Prerequisites

- Bun 1.1 or later (`bun --version`). markterm does not run on Node.js.
- A terminal with an image protocol: Ghostty, Kitty, WezTerm, iTerm2, or a Sixel-capable terminal. See the README for the full list.
- Network access for the first render (Chromium download) and for every render that contains Mermaid diagrams (loaded from CDN).

## 1. Install markterm

```bash
bun install -g markterm
```

## 2. Install Chromium

markterm uses Playwright to render Markdown in a headless browser.

```bash
bunx playwright install chromium
```

## 3. (Sixel only) Install libsixel

Only needed if your terminal uses the Sixel protocol (foot, xterm, mlterm, Konsole, mintty, Black Box). Without `img2sixel`, markterm falls back to saving a PNG file.

```bash
# macOS
brew install libsixel

# Debian / Ubuntu
sudo apt install libsixel-bin

# Fedora
sudo dnf install libsixel-utils
```

## 4. Verify

```bash
# Check the detected protocol and terminal columns
markterm --help

# Render a test file
markterm README.md
```

`markterm --help` prints a line such as `Detected terminal protocol: kitty`. If it says `file`, see Troubleshooting below.

## Examples

### Basic display

```bash
markterm document.md
```

### Zoom out for long documents

```bash
# 50% zoom: content shrinks, the image still fills the terminal width
markterm document.md -z 50
```

### Force a theme

By default markterm reads the terminal's background and foreground colors and builds the theme from them. `-t` only matters when that detection is not possible (for example when piping from stdin).

```bash
markterm document.md -t light
```

### Use exact colors

```bash
markterm document.md --bg "#282c34" --fg "#abb2bf"
```

### Save to file

```bash
markterm document.md -o preview.png
```

### Different MermaidJS version

```bash
markterm document.md --mermaid 12.0.0
```

### Force a specific protocol

```bash
# Use Sixel even in iTerm2
markterm document.md -p sixel

# Use iTerm2 inline images explicitly
markterm document.md -p iterm2

# Never display inline, only save the PNG and print its path
markterm document.md -p file
```

### Pipe from stdin

```bash
echo "# Hello World" | markterm
```

When input comes from a pipe, stdin is not a TTY, so color auto-detection is skipped and the `-t` fallback theme (default `dark`) is used. Add `-t light` for light terminals.

## Troubleshooting

### Output says `Saved to: /tmp/markterm-....png` instead of showing an image

Your terminal was not auto-detected, or it was detected as Sixel but `img2sixel` is missing. Check what was detected and force the protocol if needed:

```bash
markterm --help                 # look at "Detected terminal protocol"
markterm document.md -p kitty   # or iterm2, sixel
```

Or set the environment variable:

```bash
export MARKTERM_PROTOCOL=kitty
```

Inside tmux or screen, image escape sequences generally do not reach the outer terminal, so markterm falls back to saving the file. Run it outside the multiplexer.

### "Sixel display requires img2sixel"

Install libsixel (see step 3 above).

### The colors do not match my terminal

Auto-detection needs both stdin and stdout to be a TTY and a terminal that answers `OSC 10`/`OSC 11` queries within 500 ms. If you piped the Markdown in, redirected output, or your terminal does not answer, markterm uses the `-t` fallback. Use `-t light`, or pin the colors with `--bg` and `--fg`.

### Image not filling the terminal width, or text too small or too large

The automatic width is estimated as `columns x 8 px / scale`, which assumes a narrow font. Adjust the width or zoom:

```bash
markterm document.md -w 1200
markterm document.md -z 75
```

### Mermaid diagrams appear as raw text

Ensure you have internet access (MermaidJS is loaded from CDN). markterm waits up to 10 seconds for diagrams to render, then captures the page as is. If a diagram fails to parse in the selected MermaidJS version, try another with `--mermaid`.

### Temp files piling up

Every run writes `$TMPDIR/markterm-<timestamp>.png` and does not delete it. Clean them up with:

```bash
rm "${TMPDIR:-/tmp}"/markterm-*.png
```
