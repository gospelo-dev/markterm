# Quickstart

## 0. Prerequisites

- Node.js 20 or later (`node --version`), or Bun 1.1 or later (`bun --version`).
- A terminal with an image protocol. For the full-screen viewer: Ghostty, Kitty, WezTerm, or iTerm2 with Kitty graphics (3.7.2 works). Other terminals, such as older iTerm2 or Sixel-capable terminals, get image mode. See the README for the full list.
- Network access for the first render (Chromium download), for every render that contains Mermaid diagrams, and for PDFs in the viewer (MermaidJS and pdf.js are loaded from CDN).

## 1. Install markterm

```bash
npm install -g markterm
# or: bun install -g markterm
```

The `markterm` command runs on Node.js. Without Node.js, use `bunx --bun markterm` in place of `markterm` in the steps below.

## 2. Install Chromium

markterm uses Playwright to render Markdown in a headless browser.

```bash
npx playwright install chromium
# or: bunx playwright install chromium
```

## 3. (Sixel only) Install libsixel

Only needed for image mode in terminals that use the Sixel protocol (foot, xterm, mlterm, Konsole, mintty, Black Box). Without `img2sixel`, markterm falls back to saving a PNG file.

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
# Check the detected protocol
markterm --help

# Open a file
markterm README.md
```

In Ghostty, Kitty, WezTerm and iTerm2 with Kitty graphics, `markterm README.md` opens the full-screen viewer: scroll with `j`/`k` or the mouse wheel, click links, and press `q` to quit. In other terminals it prints the document as one image. `markterm --help` prints a line such as `Detected terminal protocol: kitty`. If it says `file`, see Troubleshooting below.

## Examples

### Read a document in the viewer

```bash
markterm document.md
```

| Keys | Action |
|------|--------|
| `j` / `k`, arrows, mouse wheel | Scroll |
| `Space` / `b` | Page down / up |
| `g` / `G` | Top / bottom |
| Click | Follow a link (`.md`, `.html`, images and `.pdf` open in the viewer) |
| `h` | Back |
| `+` / `-` / `0` | Zoom in / out / reset |
| `r` | Reload the file |
| `s` / `p` | Save as HTML / PNG |
| `q` | Quit |

### Open HTML, images and PDFs

```bash
markterm page.html
markterm screenshot.png
markterm paper.pdf
```

### Print one image instead of opening the viewer

```bash
markterm document.md -i

# 50% zoom: content shrinks, the image still fills the terminal width
markterm document.md -i -z 50
```

### Force a theme

By default markterm reads the terminal's background and foreground colors and builds the theme from them. `-t <name>` uses a built-in theme instead and sets background, foreground and link color at once. Run `markterm --help` or see the README for the list of names.

```bash
markterm document.md -t light
markterm document.md -t dracula

# Use a theme and fonts by default (add to your shell profile)
export MARKTERM_THEME=dracula
export MARKTERM_FONT="Noto Sans JP"
export MARKTERM_CODE_FONT="JetBrains Mono"
```

Command-line options (`-t`, `--font`, `--code-font`) take precedence over these variables.

### Use exact colors

```bash
markterm document.md --bg "#282c34" --fg "#abb2bf"
```

### Save to file

```bash
markterm document.md -o preview.png
markterm document.md -o preview.html   # self-contained page with images embedded
```

### Different MermaidJS version

```bash
markterm document.md --mermaid 12.0.0
```

### Force a specific protocol for image mode

```bash
# Use Sixel even in iTerm2
markterm document.md -i -p sixel

# Use iTerm2 inline images explicitly
markterm document.md -p iterm2

# Never display inline, only save the PNG and print its path
markterm document.md -p file
```

### Pipe from stdin

```bash
echo "# Hello World" | markterm
```

When input comes from a pipe, stdin is not a TTY, so color auto-detection is skipped and the `dark` theme is used. Add `-t light` (or another theme) for light terminals. Keys for the viewer are read from the terminal, so the viewer still works.

## Troubleshooting

### The viewer does not open, an image is printed instead

The viewer needs a terminal with Kitty graphics on stdout, outside tmux/screen, without `-i` or `-o`. Check what was detected:

```bash
markterm --help                 # look at "Detected terminal protocol"
```

- Output piped or redirected (`markterm doc.md | less`): image mode is used on purpose.
- Inside tmux or screen: run markterm outside the multiplexer, or use [herdr](https://herdr.dev/), where the viewer works.
- iTerm2: the viewer opens only if iTerm2 answers the Kitty graphics query (3.7.2 does). Older versions get image mode.

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

### "browserType.launch: Executable doesn't exist at .../chromium_headless_shell-NNNN"

The Playwright that markterm uses expects a Chromium build that is not installed. This happens when the Playwright installed with markterm and the one that downloaded Chromium are different versions, for example after upgrading markterm, or when an older Playwright stays installed next to it. markterm 0.4 needs Playwright 1.63 or later.

```bash
# Reinstall markterm so it gets a current Playwright, then download its Chromium
npm install -g markterm
npx playwright install chromium
```

If the error names an older build number again, check which Playwright markterm loads with `npm ls -g playwright`, and install Chromium for that version: `npx playwright@<version> install chromium`.

### "Sixel display requires img2sixel"

Install libsixel (see step 3 above).

### The colors do not match my terminal

Auto-detection needs both stdin and stdout to be a TTY and a terminal that answers `OSC 10`/`OSC 11` queries within 500 ms. If you piped the Markdown in, redirected output, or your terminal does not answer, markterm uses the `dark` theme. Pick a theme with `-t`, or pin the colors with `--bg` and `--fg`.

### Text too small or too large

In the viewer, press `+` or `-`. In image mode, the automatic width is estimated as `columns x 8 px / scale`, which assumes a narrow font. Adjust the width or zoom:

```bash
markterm document.md -i -w 1200
markterm document.md -i -z 75
```

### Mermaid diagrams appear as raw text, or a PDF does not show

Ensure you have internet access (MermaidJS and pdf.js are loaded from CDN). markterm waits up to 10 seconds for diagrams to render, then captures the page as is. If a diagram fails to parse in the selected MermaidJS version, try another with `--mermaid`.

### Temp files piling up

Every run in image mode writes `$TMPDIR/markterm-<timestamp>.png` and does not delete it. Clean them up with:

```bash
rm "${TMPDIR:-/tmp}"/markterm-*.png
```
