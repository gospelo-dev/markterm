import type { Readable, Writable } from "stream"

const CHUNK_SIZE = 4096

/**
 * Enter the alternate screen, hide the cursor, and report mouse clicks, wheel
 * and motion (1003: any-event tracking, for link hover) in SGR form.
 */
export const ENTER = "\x1b[?1049h\x1b[?25l\x1b[?1000h\x1b[?1003h\x1b[?1006h"
/** Delete all images, restore the mouse pointer, and undo ENTER. */
export const LEAVE =
  "\x1b_Ga=d,d=A,q=2\x1b\\\x1b]22;default\x1b\\\x1b[?1006l\x1b[?1003l\x1b[?1000l\x1b[?25h\x1b[?1049l"

/**
 * Set the mouse pointer shape (OSC 22, CSS cursor names). Ghostty and Kitty
 * support it; other terminals ignore it.
 */
export function pointerShape(shape: "pointer" | "default"): string {
  return `\x1b]22;${shape}\x1b\\`
}

/**
 * Transmit a PNG and show it scaled to cols x rows cells, without moving the
 * cursor: at the top-left, or at `at` (1-based row and column). `id` names the
 * image so it can be deleted later; `z` stacks it above lower images.
 */
export function placeImage(
  png: Uint8Array,
  opts: { id: number; cols: number; rows: number; at?: { row: number; col: number }; z?: number },
): string {
  const b64 = Buffer.from(png).toString("base64")
  const z = opts.z ? `,z=${opts.z}` : ""
  const head = `a=T,f=100,i=${opts.id},q=2,c=${opts.cols},r=${opts.rows},C=1${z}`
  const parts: string[] = [opts.at ? `\x1b[${opts.at.row};${opts.at.col}H` : "\x1b[H"]
  for (let offset = 0; offset < b64.length || offset === 0; offset += CHUNK_SIZE) {
    const chunk = b64.slice(offset, offset + CHUNK_SIZE)
    const more = offset + CHUNK_SIZE < b64.length ? 1 : 0
    parts.push(offset === 0 ? `\x1b_G${head},m=${more};${chunk}\x1b\\` : `\x1b_Gm=${more},q=2;${chunk}\x1b\\`)
  }
  return parts.join("")
}

/** Delete an image and its placements, freeing its data. */
export function deleteImage(id: number): string {
  return `\x1b_Ga=d,d=I,i=${id},q=2\x1b\\`
}

/** Draw a one-line status bar on the given row, in reverse video, fitted to cols. */
export function statusLine(row: number, cols: number, left: string, right: string): string {
  const width = Math.max(0, cols - 2)
  const r = right.length >= width ? "" : right
  const l = left.slice(0, Math.max(0, width - r.length - 1))
  const gap = Math.max(1, width - l.length - r.length)
  return `\x1b[${row};1H\x1b[2K\x1b[7m ${l}${" ".repeat(gap)}${r} \x1b[0m`
}

export type CellSize = { width: number; height: number }

/** Used when the terminal does not report its cell size. */
export const FALLBACK_CELL: CellSize = { width: 8, height: 16 }

/**
 * Kitty graphics support probe: a query for a 1x1 image (a=q: check, do not
 * store), followed by Primary Device Attributes, which every terminal answers.
 * A terminal with Kitty graphics replies "i=31;OK" before the DA reply.
 */
export const KITTY_GRAPHICS_QUERY = "\x1b_Gi=31,s=1,v=1,a=q,t=d,f=24;AAAA\x1b\\\x1b[c"

/** Whether the terminal answers the Kitty graphics query; false on no answer in time. */
export function queryKittyGraphics(input: Readable, output: Writable, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolvePromise) => {
    let buf = ""
    const done = (value: boolean) => {
      clearTimeout(timer)
      input.off("data", onData)
      resolvePromise(value)
    }
    const onData = (chunk: Buffer | string) => {
      buf += chunk.toString()
      if (/\x1b_Gi=31;OK\x1b\\/.test(buf)) done(true)
      // The DA reply came first: no Kitty graphics
      else if (/\x1b\[\?[\d;]*c/.test(buf)) done(false)
    }
    const timer = setTimeout(() => done(false), timeoutMs)
    input.on("data", onData)
    output.write(KITTY_GRAPHICS_QUERY)
  })
}

/** Cell size requests: CSI 16 t, iTerm2's ReportCellSize, and CSI 14 t (text area). */
export const CELL_SIZE_QUERIES = "\x1b[16t\x1b]1337;ReportCellSize\x07\x1b[14t"

/**
 * The cell size from terminal replies, preferring the most direct answer:
 * CSI 6;h;w t (Ghostty, Kitty, WezTerm), then iTerm2's ReportCellSize (in
 * points, times its scale), then the text area from CSI 4;h;w t divided by
 * the grid. Null if none of them is there.
 */
export function parseCellSize(replies: string, grid: { cols: number; rows: number }): CellSize | null {
  const direct = /\x1b\[6;(\d+);(\d+)t/.exec(replies)
  if (direct) return { height: Number(direct[1]), width: Number(direct[2]) }
  const iterm = /\x1b\]1337;ReportCellSize=([\d.]+);([\d.]+)(?:;([\d.]+))?(?:\x07|\x1b\\)/.exec(replies)
  if (iterm) {
    const scale = iterm[3] ? Number(iterm[3]) : 1
    return { height: Number(iterm[1]) * scale, width: Number(iterm[2]) * scale }
  }
  const area = /\x1b\[4;(\d+);(\d+)t/.exec(replies)
  if (area && grid.cols > 0 && grid.rows > 0) {
    return { height: Number(area[1]) / grid.rows, width: Number(area[2]) / grid.cols }
  }
  return null
}

/**
 * Ask the terminal for the pixel size of one cell. Sends every kind of
 * request at once (terminals ignore those they do not know) and uses the best
 * reply: it stops as soon as a direct CSI 6 answer arrives, otherwise it waits
 * for the timeout and falls back to the other answers. Null if none arrives.
 */
export function requestCellSize(
  input: Readable,
  output: Writable,
  grid: { cols: number; rows: number },
  timeoutMs = 300,
): Promise<CellSize | null> {
  return new Promise((resolvePromise) => {
    let buf = ""
    const done = () => {
      clearTimeout(timer)
      input.off("data", onData)
      resolvePromise(parseCellSize(buf, grid))
    }
    const onData = (chunk: Buffer | string) => {
      buf += chunk.toString()
      if (/\x1b\[6;\d+;\d+t/.test(buf)) done()
    }
    const timer = setTimeout(done, timeoutMs)
    input.on("data", onData)
    output.write(CELL_SIZE_QUERIES)
  })
}
