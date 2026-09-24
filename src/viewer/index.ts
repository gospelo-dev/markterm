import { spawn } from "child_process"
import { openSync } from "fs"
import { ReadStream } from "tty"
import type { DocumentOptions } from "../render/document.js"
import { InputParser } from "./input.js"
import { ENTER, FALLBACK_CELL, LEAVE, requestCellSize, queryKittyGraphics } from "./screen.js"
import { Viewer, type ViewerDocument } from "./viewer.js"

export {
  documentKind,
  exportPath,
  Viewer,
  viewportFor,
  ZOOM_STEPS,
  type DocumentKind,
  type ViewerDocument,
  type ViewerOptions,
  type ViewerSize,
} from "./viewer.js"
export { InputParser, type InputEvent } from "./input.js"

/**
 * How long the terminal size must stay unchanged before the viewer re-renders.
 * Dragging a window edge sends a stream of resize events; re-rendering (and
 * re-fitting the zoom) for each one makes the screen flicker.
 */
export const RESIZE_SETTLE_MS = 250

/**
 * Wrap fn so that a burst of calls runs it once, `ms` after the last call.
 * `cancel` drops a pending call.
 */
export function settle(fn: () => void, ms: number): { (): void; cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  const call = () => {
    clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
  call.cancel = () => clearTimeout(timer)
  return call
}

/**
 * Ask the terminal (through /dev/tty) whether it supports Kitty graphics.
 * Used for terminals detected as iTerm2, which gained Kitty graphics support
 * in later versions. False when there is no terminal to ask.
 */
export async function probeKittyGraphics(): Promise<boolean> {
  let input: ReadStream
  try {
    input = new ReadStream(openSync("/dev/tty", "r"))
  } catch {
    return false
  }
  try {
    input.setRawMode(true)
    return await queryKittyGraphics(input, process.stdout)
  } finally {
    input.setRawMode(false)
    input.destroy()
  }
}

/** Open a URL with the system's default handler (browser, mail client, viewer). */
export function openExternal(url: string): void {
  const [cmd, args] =
    process.platform === "darwin" ? ["open", [url]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
    : ["xdg-open", [url]]
  try {
    spawn(cmd, args as string[], { detached: true, stdio: "ignore" }).on("error", () => {}).unref()
  } catch {}
}

/**
 * Run the full-screen viewer until the user quits. Keys are read from /dev/tty,
 * so the Markdown itself may come from stdin. The terminal is always restored.
 */
export async function runViewer(
  doc: ViewerDocument,
  opts: { render: Omit<DocumentOptions, "basePath">; scale: number },
): Promise<void> {
  const output = process.stdout
  const input = new ReadStream(openSync("/dev/tty", "r"))
  input.setRawMode(true)
  input.setEncoding("utf-8")

  const grid = () => ({ cols: output.columns || 80, rows: output.rows || 24 })
  let cell = (await requestCellSize(input, output, grid())) ?? FALLBACK_CELL
  const size = () => ({ cols: output.columns || 80, rows: output.rows || 24, cell })

  let restored = false
  const restore = () => {
    if (restored) return
    restored = true
    output.write(LEAVE)
    input.setRawMode(false)
    input.destroy()
  }
  process.once("exit", restore)

  output.write(ENTER)
  // Set once the event handlers are attached; stops a pending resize on exit
  let cleanup = () => {}
  const viewer = await Viewer.create({ output, size: size(), scale: opts.scale, render: opts.render, openExternal })
  try {
    await viewer.open(doc)
    await new Promise<void>((resolve, reject) => {
      const parser = new InputParser()
      // Handle events one at a time, in order
      let queue: Promise<unknown> = Promise.resolve()
      const enqueue = (task: () => Promise<unknown>) => {
        queue = queue.then(task).catch(reject)
      }
      input.on("data", (chunk: string) => {
        for (const event of parser.push(chunk)) {
          enqueue(async () => {
            if ((await viewer.handle(event)) === "quit") resolve()
          })
        }
      })
      // Re-render once the size has settled, not for every step of a drag.
      // A resize may also mean a new font size (e.g. Cmd +/- in Ghostty), so
      // ask for the cell size again. The reply also reaches the input parser,
      // which ignores it.
      const onResize = settle(
        () =>
          enqueue(async () => {
            cell = (await requestCellSize(input, output, grid(), 200)) ?? cell
            await viewer.resize(size())
          }),
        RESIZE_SETTLE_MS,
      )
      output.on("resize", onResize)
      cleanup = () => {
        onResize.cancel()
        output.off("resize", onResize)
      }
      process.once("SIGTERM", () => resolve())
    })
  } finally {
    cleanup()
    await viewer.close().catch(() => {})
    restore()
  }
}
