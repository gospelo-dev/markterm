import { spawnSync } from "child_process"

export type TerminalSize = {
  cols: number
  rows: number
  pixelWidth: number | null
  pixelHeight: number | null
}

export function getTerminalSize(): TerminalSize {
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24

  const pixel = queryPixelSize()

  return {
    cols,
    rows,
    pixelWidth: pixel?.width ?? null,
    pixelHeight: pixel?.height ?? null,
  }
}

function queryPixelSize(): { width: number; height: number } | null {
  // macOS/Linux: try `stty size -p` or parse from resize command
  // Most reliable cross-platform: use tput + font metrics heuristic
  try {
    const result = spawnSync("stty", ["-a"], {
      encoding: "utf-8",
      stdio: ["inherit", "pipe", "pipe"],
    })
    if (result.status === 0) {
      // Some stty implementations report pixel size, but most don't.
      // Fall through to heuristic.
    }
  } catch {}

  return null
}

/**
 * Estimate the viewport pixel width that best matches the terminal.
 * When pixel dimensions are known, use them directly.
 * Otherwise, use columns * estimated cell pixel width.
 */
export function estimateViewportWidth(scale: number): number {
  const size = getTerminalSize()

  if (size.pixelWidth) {
    return Math.round(size.pixelWidth / scale)
  }

  // Heuristic: typical cell width varies by font/terminal.
  // 8px is standard for monospace at ~14px font, 9-10px for larger fonts.
  // We use 8 as a conservative default and divide by scale since
  // Playwright's deviceScaleFactor multiplies the viewport.
  const cellWidth = 8
  return Math.round((size.cols * cellWidth) / scale)
}
