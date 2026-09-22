import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { detectProtocol, displayInline } from "../protocol/index.js"
import { buildDirectDisplay as kittyDisplay } from "../protocol/kitty.js"
import { buildDirectDisplay as iterm2Display } from "../protocol/iterm2.js"
import { isSixelAvailable } from "../protocol/sixel.js"

const ENV_KEYS = [
  "MARKTERM_PROTOCOL",
  "TERM",
  "TERM_PROGRAM",
  "LC_TERMINAL",
  "GHOSTTY_RESOURCES_DIR",
  "GHOSTTY_BIN_DIR",
  "KITTY_WINDOW_ID",
  "KITTY_PID",
  "WEZTERM_PANE",
]

let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = {}
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe("detectProtocol", () => {
  test("falls back to file when nothing matches", () => {
    process.env.TERM = "dumb"
    expect(detectProtocol()).toBe("file")
  })

  test("MARKTERM_PROTOCOL overrides detection, case-insensitively", () => {
    process.env.TERM_PROGRAM = "iTerm.app"
    process.env.MARKTERM_PROTOCOL = "Kitty"
    expect(detectProtocol()).toBe("kitty")
    process.env.MARKTERM_PROTOCOL = "file"
    expect(detectProtocol()).toBe("file")
  })

  test("ignores an unknown MARKTERM_PROTOCOL value", () => {
    process.env.TERM_PROGRAM = "iTerm.app"
    process.env.MARKTERM_PROTOCOL = "bogus"
    expect(detectProtocol()).toBe("iterm2")
  })

  test.each([
    ["TERM", "xterm-ghostty"],
    ["TERM_PROGRAM", "ghostty"],
    ["GHOSTTY_RESOURCES_DIR", "/x"],
    ["GHOSTTY_BIN_DIR", "/x"],
    ["TERM_PROGRAM", "kitty"],
    ["KITTY_WINDOW_ID", "1"],
    ["KITTY_PID", "1"],
    ["TERM_PROGRAM", "WezTerm"],
    ["WEZTERM_PANE", "0"],
  ])("detects kitty from %s=%s", (key, value) => {
    process.env[key] = value
    expect(detectProtocol()).toBe("kitty")
  })

  test.each([
    ["TERM_PROGRAM", "iTerm.app"],
    ["LC_TERMINAL", "iTerm2"],
  ])("detects iterm2 from %s=%s", (key, value) => {
    process.env[key] = value
    expect(detectProtocol()).toBe("iterm2")
  })

  test("kitty wins over iterm2 when both are present", () => {
    process.env.TERM_PROGRAM = "iTerm.app"
    process.env.KITTY_WINDOW_ID = "1"
    expect(detectProtocol()).toBe("kitty")
  })

  test.each([
    ["TERM_PROGRAM", "foot"],
    ["TERM_PROGRAM", "mlterm"],
    ["TERM_PROGRAM", "konsole"],
    ["TERM_PROGRAM", "mintty"],
    ["TERM_PROGRAM", "blackbox"],
    ["TERM", "xterm"],
  ])("sixel terminal %s=%s resolves to sixel only when img2sixel is installed", (key, value) => {
    process.env[key] = value
    expect(detectProtocol()).toBe(isSixelAvailable() ? "sixel" : "file")
  })
})

describe("kitty buildDirectDisplay", () => {
  test("small payload is a single APC with f=100 and column count", () => {
    const png = new Uint8Array([1, 2, 3])
    const out = kittyDisplay(png, 120)
    const b64 = Buffer.from(png).toString("base64")
    expect(out).toBe(`\x1b_Ga=T,f=100,q=2,c=120;${b64}\x1b\\`)
  })

  test("omits the column attribute when cols is not given", () => {
    const out = kittyDisplay(new Uint8Array([9]))
    expect(out.startsWith("\x1b_Ga=T,f=100,q=2;")).toBe(true)
  })

  test("large payload is chunked into 4096-byte base64 pieces with m=1 ... m=0", () => {
    const png = new Uint8Array(10_000).fill(7)
    const b64 = Buffer.from(png).toString("base64")
    const out = kittyDisplay(png, 80)
    const parts = out.split("\x1b\\").filter(Boolean)
    expect(parts.length).toBe(Math.ceil(b64.length / 4096))
    expect(parts[0].startsWith("\x1b_Ga=T,f=100,m=1,q=2,c=80;")).toBe(true)
    for (const p of parts.slice(1, -1)) expect(p.startsWith("\x1b_Gm=1,q=2;")).toBe(true)
    expect(parts[parts.length - 1].startsWith("\x1b_Gm=0,q=2;")).toBe(true)
    const joined = parts.map((p) => p.slice(p.indexOf(";") + 1)).join("")
    expect(joined).toBe(b64)
  })
})

describe("iterm2 buildDirectDisplay", () => {
  test("emits an OSC 1337 File sequence with inline=1 and width in columns", () => {
    const png = new Uint8Array([1, 2, 3, 4])
    const out = iterm2Display(png, 100)
    const b64 = Buffer.from(png).toString("base64")
    const name = Buffer.from("markterm.png").toString("base64")
    expect(out).toBe(`\x1b]1337;File=inline=1;preserveAspectRatio=1;size=4;name=${name};width=100:${b64}\x07`)
  })

  test("falls back to width=100% when cols is not given", () => {
    expect(iterm2Display(new Uint8Array([1]))).toContain(";width=100%:")
  })
})

describe("displayInline", () => {
  const png = new Uint8Array([137, 80, 78, 71])

  test("returns null for the file protocol", () => {
    expect(displayInline(png, { protocol: "file" })).toBeNull()
  })

  test("builds kitty and iterm2 sequences when forced", () => {
    expect(displayInline(png, { protocol: "kitty" })).toStartWith("\x1b_G")
    expect(displayInline(png, { protocol: "iterm2" })).toStartWith("\x1b]1337;File=")
  })

  test("uses detectProtocol when no protocol is given", () => {
    process.env.TERM = "dumb"
    expect(displayInline(png)).toBeNull()
    process.env.MARKTERM_PROTOCOL = "kitty"
    expect(displayInline(png)).toStartWith("\x1b_G")
  })
})
