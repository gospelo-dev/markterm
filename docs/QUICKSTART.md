# Quickstart

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

Only needed if your terminal uses the Sixel protocol (foot, xterm, mlterm, Konsole, mintty, Black Box).

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
# Check detected protocol
markterm --help

# Render a test file
markterm README.md
```

## Examples

### Basic display

```bash
markterm document.md
```

### Zoom out for long documents

```bash
# 50% zoom - content shrinks, image fills terminal width
markterm document.md -z 50
```

### Light theme

```bash
markterm document.md -t light
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

# Use iTerm2 IIP explicitly
markterm document.md -p iterm2
```

### Pipe from stdin

```bash
echo "# Hello World" | markterm
```

## Troubleshooting

### "Terminal protocol not supported"

Your terminal was not auto-detected. Try forcing a protocol:

```bash
markterm --help  # Check "Detected terminal protocol"
markterm document.md -p kitty   # or iterm2, sixel
```

Or set the environment variable:

```bash
export MARKTERM_PROTOCOL=kitty
```

### "Sixel display requires img2sixel"

Install libsixel (see step 3 above).

### Image not filling terminal width

Try adjusting the width or zoom:

```bash
markterm document.md -w 1200
markterm document.md -z 75
```

### Mermaid diagrams not rendering

Ensure you have internet access (MermaidJS is loaded from CDN). If offline, the Markdown will render but Mermaid blocks will appear as raw text.
