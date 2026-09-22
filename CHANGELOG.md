# Changelog

All notable changes to markterm are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 0.1.0 (unreleased)

Initial release.

### Added

- CLI that renders Markdown + MermaidJS to a PNG with headless Chromium (Playwright) and displays it inline in the terminal
- Image protocols: Kitty Graphics (Ghostty, Kitty, WezTerm), iTerm2 inline images, Sixel via `img2sixel`, and a `file` fallback that saves the PNG and prints its path
- Automatic protocol detection from environment variables, with `-p` and `MARKTERM_PROTOCOL` overrides
- Theme auto-detection from the terminal's own colors via OSC 10/11/4, with `-t dark|light` fallback and `--bg`/`--fg` overrides
- `-w auto` viewport width estimation from terminal columns, `-z` zoom, `-s` device scale factor, `--font-size`
- `--mermaid <version>` to select the MermaidJS version loaded from jsDelivr (default 11.16.0)
- `-o` to save the PNG to a file
- Library API: `markdownToImage`, `dispose`, `renderMarkdown`, `buildHtml`, `detectProtocol`, `displayInline`, `getTerminalSize`, `estimateViewportWidth`, `queryTerminalColors`, `deriveTheme`, `fallbackTheme`, `isDark`
