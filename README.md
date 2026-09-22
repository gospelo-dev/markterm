# markterm

<p align="center"><img src="https://github.com/gospelo-dev/markterm/blob/main/assets/hero.jpg?raw=true" alt="markterm: Render Markdown inline in any terminal" width="820"></p>

Render Markdown + MermaidJS as inline images in your terminal.

markterm takes a Markdown file, renders it with full styling and MermaidJS diagram support, and displays the result as an inline image directly in your terminal.

## Supported Terminals

| Protocol | Terminals |
|----------|-----------|
| Kitty Graphics | Ghostty, Kitty, WezTerm |
| iTerm2 IIP | iTerm2 |
| Sixel | foot, xterm, mlterm, Konsole, mintty (Git Bash), Black Box |

## Install

```bash
bun install -g markterm

# Chromium is required for rendering
bunx playwright install chromium

# For Sixel terminals only
# macOS:  brew install libsixel
# Linux:  apt install libsixel-bin
```

## Usage

```bash
# Display inline in terminal
markterm README.md

# Zoom out to 50% (shrink content, full-width display)
markterm README.md -z 50

# Light theme
markterm README.md -t light

# Save as PNG
markterm README.md -o output.png

# Read from stdin
cat README.md | markterm
```

## Options

```
-t, --theme <dark|light>       Color theme (default: dark)
-w, --width <auto|px>          Viewport width (default: auto)
    --font-size <px>           Body font size (default: 16)
-s, --scale <factor>           Device scale factor (default: 2)
    --mermaid <version>        MermaidJS version (default: 11.16.0)
-z, --zoom <percent>           Zoom: 1-100% (default: 100)
-p, --protocol <name>          Force protocol: kitty, iterm2, sixel, file
-o, --output <file.png>        Save PNG to file
-h, --help                     Show help
-v, --version                  Show version
```

## How It Works

1. **marked** parses Markdown to HTML with a custom MermaidJS extension
2. **Playwright** renders the HTML in a headless Chromium browser with MermaidJS loaded from CDN
3. The page is captured as a PNG screenshot
4. The PNG is transmitted to the terminal via the appropriate image protocol (auto-detected)

## MermaidJS Support

markterm loads MermaidJS directly from CDN, so it always supports the version you specify. All diagram types are supported:

- Flowchart, Sequence, Class, State, ER, Gantt, Pie, Git Graph, and more
- Default: MermaidJS v11.16.0 (override with `--mermaid <version>`)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MARKTERM_PROTOCOL` | Override auto-detected protocol (`kitty`, `iterm2`, `sixel`, `file`) |

## Library Usage

markterm can also be used as a library:

```typescript
import { markdownToImage, dispose } from "markterm"

const png = await markdownToImage("# Hello\n\n```mermaid\ngraph LR\n  A-->B\n```", {
  theme: "dark",
  width: 800,
})

await Bun.write("output.png", png)
await dispose()
```

## License

MIT
