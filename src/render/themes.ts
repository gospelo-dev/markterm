export type ThemeColors = {
  bg: string
  fg: string
  codeBg: string
  border: string
  link: string
  mermaid: "dark" | "default" | "forest" | "neutral"
  /** Shiki theme for syntax highlighting. Unset: chosen from the background luminance. */
  codeTheme?: string
}

export const DEFAULT_DARK_CODE_THEME = "github-dark-default"
export const DEFAULT_LIGHT_CODE_THEME = "github-light-default"

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

export function deriveTheme(bg: string, fg: string, blue: string, codeTheme?: string): ThemeColors {
  const dark = isDark(bg)
  return {
    bg,
    fg,
    codeBg: adjustBrightness(bg, dark ? 20 : -15),
    border: adjustBrightness(bg, dark ? 40 : -30),
    link: blue,
    mermaid: dark ? "dark" : "default",
    codeTheme: codeTheme ?? (dark ? DEFAULT_DARK_CODE_THEME : DEFAULT_LIGHT_CODE_THEME),
  }
}

const FALLBACK_DARK: ThemeColors = {
  bg: "#1e1e2e",
  fg: "#cdd6f4",
  codeBg: "#313244",
  border: "#45475a",
  link: "#89b4fa",
  mermaid: "dark",
  codeTheme: "catppuccin-mocha",
}

const FALLBACK_LIGHT: ThemeColors = {
  bg: "#ffffff",
  fg: "#1e1e2e",
  codeBg: "#f0f0f0",
  border: "#e0e0e0",
  link: "#1e66f5",
  mermaid: "default",
  codeTheme: DEFAULT_LIGHT_CODE_THEME,
}

export function fallbackTheme(mode: "dark" | "light"): ThemeColors {
  return mode === "dark" ? FALLBACK_DARK : FALLBACK_LIGHT
}

/** Background, foreground, link (the palette's blue) and Shiki theme of a named color scheme. */
type Scheme = [bg: string, fg: string, link: string, codeTheme: string]

const SCHEMES: Record<string, Scheme> = {
  "catppuccin-mocha": ["#1e1e2e", "#cdd6f4", "#89b4fa", "catppuccin-mocha"],
  "catppuccin-latte": ["#eff1f5", "#4c4f69", "#1e66f5", "catppuccin-latte"],
  dracula: ["#282a36", "#f8f8f2", "#bd93f9", "dracula"],
  nord: ["#2e3440", "#d8dee9", "#81a1c1", "nord"],
  "gruvbox-dark": ["#282828", "#ebdbb2", "#83a598", "gruvbox-dark-medium"],
  "gruvbox-light": ["#fbf1c7", "#3c3836", "#076678", "gruvbox-light-medium"],
  "solarized-dark": ["#002b36", "#839496", "#268bd2", "solarized-dark"],
  "solarized-light": ["#fdf6e3", "#657b83", "#268bd2", "solarized-light"],
  "tokyo-night": ["#1a1b26", "#c0caf5", "#7aa2f7", "tokyo-night"],
  "one-dark": ["#282c34", "#abb2bf", "#61afef", "one-dark-pro"],
  "github-dark": ["#0d1117", "#e6edf3", "#4493f8", "github-dark-default"],
  "github-light": ["#ffffff", "#1f2328", "#0969da", "github-light-default"],
}

/** Names accepted by getTheme(): "dark", "light", then the named schemes. */
export const THEME_NAMES: readonly string[] = ["dark", "light", ...Object.keys(SCHEMES)]

/** Built-in theme by name, or null if the name is unknown. */
export function getTheme(name: string): ThemeColors | null {
  if (name === "dark" || name === "light") return fallbackTheme(name)
  const scheme = SCHEMES[name]
  return scheme ? deriveTheme(...scheme) : null
}

/** Normalize "#rgb" / "#rrggbb" (any case) to lowercase "#rrggbb", or null if invalid. */
export function normalizeHex(value: string): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!m) return null
  const hex = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1]
  return `#${hex.toLowerCase()}`
}
