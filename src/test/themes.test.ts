import { describe, expect, test } from "bun:test"
import {
  adjustBrightness,
  deriveTheme,
  fallbackTheme,
  getTheme,
  isDark,
  normalizeHex,
  THEME_NAMES,
} from "../render/themes.js"

describe("isDark", () => {
  test("classifies dark and light backgrounds by luminance", () => {
    expect(isDark("#000000")).toBe(true)
    expect(isDark("#1e1e2e")).toBe(true)
    expect(isDark("#ffffff")).toBe(false)
    expect(isDark("#f5f0eb")).toBe(false)
  })
})

describe("adjustBrightness", () => {
  test("shifts each channel by the given amount", () => {
    expect(adjustBrightness("#101010", 16)).toBe("#202020")
    expect(adjustBrightness("#808080", -128)).toBe("#000000")
  })

  test("clamps channels to 00..ff", () => {
    expect(adjustBrightness("#fafafa", 40)).toBe("#ffffff")
    expect(adjustBrightness("#050505", -40)).toBe("#000000")
  })
})

describe("deriveTheme", () => {
  test("dark background: brightens code/border and picks the dark Mermaid theme", () => {
    const t = deriveTheme("#000000", "#ffffff", "#89b4fa")
    expect(t.bg).toBe("#000000")
    expect(t.fg).toBe("#ffffff")
    expect(t.link).toBe("#89b4fa")
    expect(t.codeBg).toBe("#141414")
    expect(t.border).toBe("#282828")
    expect(t.mermaid).toBe("dark")
  })

  test("light background: darkens code/border and picks the default Mermaid theme", () => {
    const t = deriveTheme("#ffffff", "#000000", "#1e66f5")
    expect(t.codeBg).toBe("#f0f0f0")
    expect(t.border).toBe("#e1e1e1")
    expect(t.mermaid).toBe("default")
  })
})

describe("fallbackTheme", () => {
  test("returns the built-in dark and light palettes", () => {
    const dark = fallbackTheme("dark")
    expect(dark.bg).toBe("#1e1e2e")
    expect(dark.mermaid).toBe("dark")
    const light = fallbackTheme("light")
    expect(light.bg).toBe("#ffffff")
    expect(light.mermaid).toBe("default")
  })
})

describe("getTheme", () => {
  test("dark and light are the fallback palettes", () => {
    expect(getTheme("dark")).toBe(fallbackTheme("dark"))
    expect(getTheme("light")).toBe(fallbackTheme("light"))
  })

  test("named schemes derive a full theme from their bg, fg and link", () => {
    const t = getTheme("solarized-light")!
    expect(t.bg).toBe("#fdf6e3")
    expect(t.fg).toBe("#657b83")
    expect(t.link).toBe("#268bd2")
    expect(t.mermaid).toBe("default")
    expect(getTheme("dracula")!.mermaid).toBe("dark")
  })

  test("every listed name resolves to valid hex colors", () => {
    for (const name of THEME_NAMES) {
      const t = getTheme(name)!
      for (const c of [t.bg, t.fg, t.codeBg, t.border, t.link]) {
        expect(normalizeHex(c)).toBe(c)
      }
    }
  })

  test("returns null for unknown names", () => {
    expect(getTheme("no-such-theme")).toBeNull()
  })
})

describe("normalizeHex", () => {
  test("accepts #rrggbb and #rgb in any case", () => {
    expect(normalizeHex("#FFFFFF")).toBe("#ffffff")
    expect(normalizeHex("#1e1e2e")).toBe("#1e1e2e")
    expect(normalizeHex("#fA0")).toBe("#ffaa00")
  })

  test("rejects names and malformed values", () => {
    expect(normalizeHex("light")).toBeNull()
    expect(normalizeHex("ffffff")).toBeNull()
    expect(normalizeHex("#ffff")).toBeNull()
    expect(normalizeHex("#gggggg")).toBeNull()
  })
})
