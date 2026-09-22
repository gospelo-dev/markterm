import { detectProtocol, type Protocol } from "./detect.js"
import { buildDirectDisplay as kittyDisplay, KITTY_MAX_IMAGE_DIMENSION } from "./kitty.js"
import {
  buildDirectDisplay as iterm2Display,
  iterm2MaxBandHeight,
  ITERM2_MAX_IMAGE_DIMENSION,
  ITERM2_MAX_ROWS,
} from "./iterm2.js"
import { buildDirectDisplay as sixelDisplay } from "./sixel.js"
import { getTerminalSize } from "../terminal.js"

export {
  detectProtocol,
  KITTY_MAX_IMAGE_DIMENSION,
  ITERM2_MAX_IMAGE_DIMENSION,
  ITERM2_MAX_ROWS,
  iterm2MaxBandHeight,
  type Protocol,
}

/**
 * Tallest band, in pixels, that the given protocol displays in one piece for a
 * render `pixelWidth` wide on this terminal, or null when the protocol has no
 * such limit (sixel, file).
 */
export function maxBandHeightFor(protocol: Protocol, pixelWidth: number): number | null {
  switch (protocol) {
    case "kitty":
      return KITTY_MAX_IMAGE_DIMENSION
    case "iterm2":
      return iterm2MaxBandHeight(pixelWidth, getTerminalSize().cols)
    case "sixel":
    case "file":
      return null
  }
}

export type DisplayOptions = {
  protocol?: Protocol
}

/**
 * Build the escape sequence that displays a PNG inline, or null for the file
 * protocol (and for sixel when img2sixel is unavailable).
 *
 * Given an array of PNGs (horizontal bands of one render, top to bottom), each
 * band is converted and the results are joined with "\n": after an image is
 * placed, the cursor sits at the end of its last row, so the newline moves to
 * the next line and the following band lands directly underneath.
 */
export function displayInline(png: Uint8Array | Uint8Array[], opts?: DisplayOptions): string | null {
  const p = opts?.protocol ?? detectProtocol()
  if (p === "file") return null
  const size = getTerminalSize()
  const images = Array.isArray(png) ? png : [png]

  const parts: string[] = []
  for (const img of images) {
    const part = buildOne(p, img, size.cols)
    if (part === null) return null
    parts.push(part)
  }
  return parts.join("\n")
}

function buildOne(p: Protocol, png: Uint8Array, cols: number | undefined): string | null {
  switch (p) {
    case "kitty":
      return kittyDisplay(png, cols)
    case "iterm2":
      return iterm2Display(png, cols)
    case "sixel":
      return sixelDisplay(png)
    case "file":
      return null
  }
}
