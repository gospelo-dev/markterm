import { isSixelAvailable } from "./sixel.js"

export type Protocol = "kitty" | "iterm2" | "sixel" | "file"

export function detectProtocol(): Protocol {
  const env = process.env
  const forced = env.MARKTERM_PROTOCOL?.toLowerCase()
  if (forced === "kitty" || forced === "iterm2" || forced === "sixel" || forced === "file") {
    return forced
  }

  if (isKittyCompatible(env)) return "kitty"
  if (isITerm2Compatible(env)) return "iterm2"
  if (isSixelTerminal(env) && isSixelAvailable()) return "sixel"

  return "file"
}

function isKittyCompatible(env: NodeJS.ProcessEnv): boolean {
  return (
    env.TERM === "xterm-ghostty" ||
    /ghostty/i.test(env.TERM_PROGRAM ?? "") ||
    !!env.GHOSTTY_RESOURCES_DIR ||
    !!env.GHOSTTY_BIN_DIR ||
    env.TERM_PROGRAM === "kitty" ||
    !!env.KITTY_WINDOW_ID ||
    !!env.KITTY_PID ||
    /WezTerm/i.test(env.TERM_PROGRAM ?? "") ||
    !!env.WEZTERM_PANE
  )
}

function isITerm2Compatible(env: NodeJS.ProcessEnv): boolean {
  const tp = env.TERM_PROGRAM ?? ""
  const lt = env.LC_TERMINAL ?? ""
  return (
    /^iTerm\.app$/i.test(tp) ||
    /^iTerm2$/i.test(lt)
  )
}

function isSixelTerminal(env: NodeJS.ProcessEnv): boolean {
  const tp = env.TERM_PROGRAM ?? ""
  return (
    /mintty/i.test(tp) ||
    /foot/i.test(tp) ||
    /mlterm/i.test(tp) ||
    env.TERM === "xterm" ||
    /konsole/i.test(tp) ||
    /blackbox/i.test(tp)
  )
}
