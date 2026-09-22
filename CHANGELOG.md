# Changelog

All notable changes to markterm are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 0.2.0 - 2026-09-23

### Added

- Local image support: relative and absolute paths, `file://` URIs, and HTML `<img>` tags in Markdown are embedded as data URIs before rendering, so local images display correctly
- Multiplexer detection: `detectMultiplexer()` detects tmux and screen via `TMUX` and `STY` environment variables
- herdr support: inline images display correctly inside herdr sessions with no special configuration
- tmux/screen detection with guidance: when a terminal multiplexer is detected, inline display is skipped and a message recommends migrating to herdr for image support
- `--help` now shows the detected multiplexer
- Library API: `detectMultiplexer`, `Multiplexer` type

## 0.1.0 - 2026-09-22

Initial release.

### Added

- CLI that renders Markdown + MermaidJS to a PNG with headless Chromium (Playwright) and displays it inline in the terminal
- Image protocols: Kitty Graphics (Ghostty, Kitty, WezTerm), iTerm2 inline images, Sixel via `img2sixel`, and a `file` fallback that saves the PNG and prints its path
- Automatic splitting of tall renders into bands, cut at block, table row, list item and text line boundaries measured in Chromium: at most 10000 px per band for Kitty Graphics (Ghostty rejects larger images), and at most 255 rows per band for iTerm2 (its per-image limit; it also rejects 10000 px images)
- iTerm2 multipart transfer (`MultipartFile` / `FilePart` / `FileEnd`, iTerm2 3.5+) for bands over iTerm2's 1 MiB per-sequence limit; smaller ones keep the single `File=` sequence
- Automatic protocol detection from environment variables, with `-p` and `MARKTERM_PROTOCOL` overrides
- Theme auto-detection from the terminal's own colors via OSC 10/11/4, with `-t dark|light` fallback and `--bg`/`--fg` overrides
- `-w auto` viewport width estimation from terminal columns, `-z` zoom, `-s` device scale factor, `--font-size`
- `--mermaid <version>` to select the MermaidJS version loaded from jsDelivr (default 11.16.0)
- `-o` to save the PNG to a file
- Library API: `markdownToImage`, `dispose`, `renderMarkdown`, `buildHtml`, `detectProtocol`, `displayInline`, `getTerminalSize`, `estimateViewportWidth`, `queryTerminalColors`, `deriveTheme`, `fallbackTheme`, `isDark`
