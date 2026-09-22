import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { detectProtocol, displayInline, maxBandHeightFor } from "../protocol/index.js"
import { buildDirectDisplay as kittyDisplay, KITTY_MAX_IMAGE_DIMENSION } from "../protocol/kitty.js"
import { buildDirectDisplay as iterm2Display, iterm2MaxBandHeight } from "../protocol/iterm2.js"
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

  test("payloads that fit in one sequence stay a single File= sequence", () => {
    // 700,000 bytes -> 933,336 base64 characters + header, under 1,048,576
    const out = iterm2Display(new Uint8Array(700_000).fill(1), 80)
    expect(out.startsWith("\x1b]1337;File=inline=1;")).toBe(true)
    expect(out).not.toContain("MultipartFile")
    expect(out.length).toBeLessThanOrEqual(1_048_576)
  })

  test("payloads over 1 MiB use the multipart form, in parts of at most 64 KiB, and no sequence over the limit", () => {
    const png = new Uint8Array(900_000).fill(3) // 1,200,000 base64 characters
    const b64 = Buffer.from(png).toString("base64")
    const out = iterm2Display(png, 80)
    expect(out.startsWith("\x1b]1337;MultipartFile=inline=1;preserveAspectRatio=1;size=900000;")).toBe(true)
    expect(out).toContain(";width=80\x07")
    expect(out.endsWith("\x1b]1337;FileEnd\x07")).toBe(true)
    const seqs = out.split("\x07").filter(Boolean)
    const prefix = "\x1b]1337;FilePart="
    const partSeqs = seqs.filter((s) => s.startsWith(prefix))
    expect(partSeqs.length).toBe(Math.ceil(b64.length / 65_536))
    expect(seqs.length).toBe(partSeqs.length + 2)
    for (const s of partSeqs) expect(s.length - prefix.length).toBeLessThanOrEqual(65_536)
    for (const s of seqs) expect(s.length + 1).toBeLessThanOrEqual(1_048_576)
    expect(partSeqs.map((s) => s.slice(prefix.length)).join("")).toBe(b64)
  })
})

describe("iterm2MaxBandHeight", () => {
  test("allows 255 rows of cells at a conservative 1.6 height/width ratio", () => {
    // 640 px over 80 columns: 8 px cells -> 255 * 1.6 * 8
    expect(iterm2MaxBandHeight(640, 80)).toBe(3264)
    expect(iterm2MaxBandHeight(1280, 80)).toBe(6528)
  })

  test("stays below iTerm2's 10000 px dimension limit", () => {
    expect(iterm2MaxBandHeight(8000, 80)).toBe(9999)
  })

  test("treats a missing column count as one column", () => {
    expect(iterm2MaxBandHeight(640, 0)).toBe(9999)
    expect(iterm2MaxBandHeight(3, 0)).toBe(Math.floor(255 * 1.6 * 3))
  })
})

describe("maxBandHeightFor", () => {
  test("kitty uses the Ghostty dimension limit, sixel and file have none", () => {
    expect(maxBandHeightFor("kitty", 640)).toBe(KITTY_MAX_IMAGE_DIMENSION)
    expect(maxBandHeightFor("sixel", 640)).toBeNull()
    expect(maxBandHeightFor("file", 640)).toBeNull()
  })

  test("iterm2 derives the limit from the terminal width", () => {
    const cols = process.stdout.columns || 80
    expect(maxBandHeightFor("iterm2", 640)).toBe(iterm2MaxBandHeight(640, cols))
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

  test("joins an array of bands with newlines, one image sequence per band", () => {
    const a = new Uint8Array([1, 2])
    const b = new Uint8Array([3, 4, 5])
    const out = displayInline([a, b], { protocol: "kitty" })!
    const parts = out.split("\n")
    expect(parts.length).toBe(2)
    expect(parts[0]).toBe(displayInline(a, { protocol: "kitty" })!)
    expect(parts[1]).toBe(displayInline(b, { protocol: "kitty" })!)
  })

  test("a single-element array produces the same output as the bare PNG", () => {
    expect(displayInline([png], { protocol: "kitty" })).toBe(displayInline(png, { protocol: "kitty" }))
    expect(displayInline([png], { protocol: "iterm2" })).toBe(displayInline(png, { protocol: "iterm2" }))
  })

  test("returns null for the file protocol with an array too", () => {
    expect(displayInline([png, png], { protocol: "file" })).toBeNull()
  })
})
