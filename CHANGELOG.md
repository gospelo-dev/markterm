# Changelog

All notable changes to markterm are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- Built-in color themes for `-t`: `catppuccin-mocha`, `catppuccin-latte`, `dracula`, `nord`, `gruvbox-dark`, `gruvbox-light`, `solarized-dark`, `solarized-light`, `tokyo-night`, `one-dark`, `github-dark`, `github-light`, in addition to `dark` and `light`. Each sets background, foreground and link color at once; `--help` lists them
- `MARKTERM_THEME` environment variable: default theme, as with `-t` (`-t` takes precedence)
- `--font` / `--code-font` options and `MARKTERM_FONT` / `MARKTERM_CODE_FONT` environment variables to set the body and code fonts. A generic fallback (`sans-serif` / `monospace`) is appended
- Library API: `getTheme`, `THEME_NAMES`, `normalizeHex`, and the `codeFontFamily` render option
- Syntax highlighting of fenced code blocks that name a language, with [Shiki](https://shiki.style/). Colors follow the theme (each built-in theme maps to a Shiki theme; detected colors use `github-dark-default` / `github-light-default`). Runs locally, no network needed. `--no-highlight` disables it
- Library API: `renderMarkdownHighlighted`, the `highlight` render option, and `ThemeColors.codeTheme`
- Link list: links in the rendered image cannot be clicked, so the document's links are printed after the image, numbered, as OSC 8 hyperlinks when stdout is a terminal. `[0]` is the rendered PNG itself. Relative paths become `file://` URLs. `--no-links` turns it off; `-o` never prints it
- Printed file paths (the temp PNG, the `-o` file) are OSC 8 hyperlinks when the output stream is a terminal
- Library API: `extractLinks`, `formatLinkList`, `formatFilePath`, `MarkdownLink` type

### Changed

- With the link list enabled (the default), the temp PNG path after an inline image is shown as `[0]` in the list on stdout instead of on its own line on stderr. `--no-links` restores the previous stderr line
- `-t <name>` now always applies the named theme and skips the terminal color query. Previously it was only a fallback used when auto-detection failed, so `-t light` had no effect in a terminal that answered the query. `--bg`/`--fg` still override individual colors on top of the theme
- `--bg`/`--fg` must be hex colors (`#rgb` or `#rrggbb`). Other values such as `--bg light` now exit with code 1 instead of rendering with an invalid color. An unknown `-t` name also exits with code 1

- Node.js support: the CLI and the library now run on Node.js 20+ as well as Bun 1.1+. `npm install -g markterm` and `npx markterm` work without Bun
- The `markterm` command runs on Node.js (`#!/usr/bin/env node`). Environments without Node.js can use `bunx --bun markterm`
- The library is published as compiled ES modules with `.d.ts` type definitions (`dist/`) instead of TypeScript source (`src/`)

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
