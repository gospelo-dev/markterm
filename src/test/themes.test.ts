import { describe, expect, test } from "bun:test"
import { adjustBrightness, deriveTheme, fallbackTheme, isDark } from "../render/themes.js"

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
