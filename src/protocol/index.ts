import { detectProtocol, type Protocol } from "./detect.js"
import { buildDirectDisplay as kittyDisplay } from "./kitty.js"
import { buildDirectDisplay as iterm2Display } from "./iterm2.js"
import { buildDirectDisplay as sixelDisplay } from "./sixel.js"
import { getTerminalSize } from "../terminal.js"

export { detectProtocol, type Protocol }

export type DisplayOptions = {
  protocol?: Protocol
}

export function displayInline(png: Uint8Array, opts?: DisplayOptions): string | null {
  const p = opts?.protocol ?? detectProtocol()
  const size = getTerminalSize()

  switch (p) {
    case "kitty":
      return kittyDisplay(png, size.cols)
    case "iterm2":
      return iterm2Display(png, size.cols)
    case "sixel":
      return sixelDisplay(png)
    case "file":
      return null
  }
}
