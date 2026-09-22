export type ThemeColors = {
  bg: string
  fg: string
  codeBg: string
  border: string
  link: string
  mermaid: "dark" | "default" | "forest" | "neutral"
}

export function isDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance < 0.5
}

export function adjustBrightness(hex: string, amount: number): string {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount))
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount))
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount))
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

export function deriveTheme(bg: string, fg: string, blue: string): ThemeColors {
  const dark = isDark(bg)
  return {
    bg,
    fg,
    codeBg: adjustBrightness(bg, dark ? 20 : -15),
    border: adjustBrightness(bg, dark ? 40 : -30),
    link: blue,
    mermaid: dark ? "dark" : "default",
  }
}

const FALLBACK_DARK: ThemeColors = {
  bg: "#1e1e2e",
  fg: "#cdd6f4",
  codeBg: "#313244",
  border: "#45475a",
  link: "#89b4fa",
  mermaid: "dark",
}

const FALLBACK_LIGHT: ThemeColors = {
  bg: "#ffffff",
  fg: "#1e1e2e",
  codeBg: "#f0f0f0",
  border: "#e0e0e0",
  link: "#1e66f5",
  mermaid: "default",
}

export function fallbackTheme(mode: "dark" | "light"): ThemeColors {
  return mode === "dark" ? FALLBACK_DARK : FALLBACK_LIGHT
}
