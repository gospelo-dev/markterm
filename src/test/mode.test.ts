import { describe, expect, test } from "bun:test"
import { chooseMode, shouldProbeKittyGraphics } from "../mode.js"

const base = { output: false, image: false, stdoutIsTTY: true, multiplexer: null, kittyGraphics: true }

describe("chooseMode", () => {
  test("a terminal with Kitty graphics opens the viewer by default", () => {
    expect(chooseMode(base)).toBe("viewer")
  })

  test("-i and -o always print an image", () => {
    expect(chooseMode({ ...base, image: true })).toBe("image")
    expect(chooseMode({ ...base, output: true })).toBe("image")
  })

  test("piped output prints an image, like less does", () => {
    expect(chooseMode({ ...base, stdoutIsTTY: false })).toBe("image")
  })

  test("terminals without Kitty graphics print an image", () => {
    expect(chooseMode({ ...base, kittyGraphics: false })).toBe("image")
  })

  test("tmux and screen print an image", () => {
    expect(chooseMode({ ...base, multiplexer: "tmux" })).toBe("image")
    expect(chooseMode({ ...base, multiplexer: "screen" })).toBe("image")
  })
})

describe("shouldProbeKittyGraphics", () => {
  const iterm = { output: false, image: false, stdoutIsTTY: true, multiplexer: null, protocol: "iterm2", protocolForced: false }

  test("asks a detected iTerm2 when the viewer could open", () => {
    expect(shouldProbeKittyGraphics(iterm)).toBe(true)
  })

  test("does not ask other terminals, or when -p / MARKTERM_PROTOCOL chose the protocol", () => {
    expect(shouldProbeKittyGraphics({ ...iterm, protocol: "kitty" })).toBe(false)
    expect(shouldProbeKittyGraphics({ ...iterm, protocol: "sixel" })).toBe(false)
    expect(shouldProbeKittyGraphics({ ...iterm, protocolForced: true })).toBe(false)
  })

  test("does not ask when an image would be printed anyway", () => {
    expect(shouldProbeKittyGraphics({ ...iterm, image: true })).toBe(false)
    expect(shouldProbeKittyGraphics({ ...iterm, output: true })).toBe(false)
    expect(shouldProbeKittyGraphics({ ...iterm, stdoutIsTTY: false })).toBe(false)
    expect(shouldProbeKittyGraphics({ ...iterm, multiplexer: "tmux" })).toBe(false)
  })
})
