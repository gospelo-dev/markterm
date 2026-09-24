import type { Multiplexer } from "./protocol/index.js"

export type DisplayMode = "viewer" | "image"

/**
 * Whether markterm opens the full-screen viewer or prints one image, like
 * `less` pages on a terminal and prints through a pipe. The viewer needs a
 * terminal on stdout with Kitty graphics, outside tmux/screen; -o (save to a
 * file) and -i (image) always print.
 */
export function chooseMode(opts: {
  output: boolean
  image: boolean
  stdoutIsTTY: boolean
  multiplexer: Multiplexer | null
  /** The terminal draws Kitty graphics (detected as kitty, or answered the probe). */
  kittyGraphics: boolean
}): DisplayMode {
  if (opts.output || opts.image) return "image"
  if (!opts.stdoutIsTTY || opts.multiplexer) return "image"
  return opts.kittyGraphics ? "viewer" : "image"
}

/**
 * Whether it is worth asking the terminal about Kitty graphics: it was
 * detected (not forced with -p or MARKTERM_PROTOCOL) as iTerm2, which supports
 * Kitty graphics in later versions, and nothing else rules the viewer out.
 */
export function shouldProbeKittyGraphics(opts: {
  output: boolean
  image: boolean
  stdoutIsTTY: boolean
  multiplexer: Multiplexer | null
  protocol: string
  protocolForced: boolean
}): boolean {
  return (
    opts.protocol === "iterm2" &&
    !opts.protocolForced &&
    chooseMode({ ...opts, kittyGraphics: true }) === "viewer"
  )
}
