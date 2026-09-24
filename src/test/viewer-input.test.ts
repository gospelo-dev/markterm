import { describe, expect, test } from "bun:test"
import { InputParser } from "../viewer/input.js"
import { RESIZE_SETTLE_MS, settle } from "../viewer/index.js"
import {
  CELL_SIZE_QUERIES,
  deleteImage,
  ENTER,
  LEAVE,
  parseCellSize,
  placeImage,
  pointerShape,
  requestCellSize,
  queryKittyGraphics,
  statusLine,
} from "../viewer/screen.js"
import { PassThrough } from "node:stream"

describe("InputParser", () => {
  const parse = (...chunks: string[]) => {
    const p = new InputParser()
    return chunks.flatMap((c) => p.push(c))
  }

  test("plain keys and control keys", () => {
    expect(parse("jq \r\x7f\x03")).toEqual([
      { type: "key", key: "j" },
      { type: "key", key: "q" },
      { type: "key", key: " " },
      { type: "key", key: "enter" },
      { type: "key", key: "backspace" },
      { type: "key", key: "ctrl-c" },
    ])
  })

  test("arrow, page and home/end keys in CSI and SS3 forms", () => {
    expect(parse("\x1b[A\x1b[B\x1bOC\x1b[D\x1b[5~\x1b[6~\x1b[H\x1b[4~\x1b[1;5A")).toEqual(
      ["up", "down", "right", "left", "pageup", "pagedown", "home", "end", "up"].map((key) => ({ type: "key", key })),
    )
  })

  test("SGR mouse: left press is a click, wheel is a scroll, motion is a move, others are ignored", () => {
    expect(parse("\x1b[<0;12;5M\x1b[<0;12;5m\x1b[<64;3;4M\x1b[<65;3;4M\x1b[<35;7;8M\x1b[<2;1;1M\x1b[<32;1;1M")).toEqual([
      { type: "click", x: 12, y: 5 },
      { type: "wheel", direction: "up", x: 3, y: 4 },
      { type: "wheel", direction: "down", x: 3, y: 4 },
      { type: "move", x: 7, y: 8 },
    ])
  })

  test("a sequence split across chunks is joined", () => {
    expect(parse("\x1b[<0;1", "0;7M", "\x1b", "[B")).toEqual([
      { type: "click", x: 10, y: 7 },
      { type: "key", key: "down" },
    ])
  })

  test("a lone ESC is the escape key; unknown sequences are dropped", () => {
    expect(parse("\x1bx", "\x1b[99z")).toEqual([
      { type: "key", key: "escape" },
      { type: "key", key: "x" },
    ])
  })

  test("terminal replies (OSC, APC, DCS) are not keys, even across chunks", () => {
    // iTerm2's cell size reply contains r and 0, which are viewer keys
    expect(parse("\x1b]1337;ReportCellSize=17.0;8.0;2.0\x07j")).toEqual([{ type: "key", key: "j" }])
    expect(parse("\x1b_Gi=1;OK\x1b\\k")).toEqual([{ type: "key", key: "k" }])
    expect(parse("\x1bP1$r0m\x1b\\")).toEqual([])
    expect(parse("\x1b]1337;ReportCell", "Size=17;8\x07", "q")).toEqual([{ type: "key", key: "q" }])
    expect(parse("\x1b]11;rgb:1e1e/1e1e/2e2e\x1b", "\\g")).toEqual([{ type: "key", key: "g" }])
  })

  test("non-ASCII characters stay whole", () => {
    expect(parse("あ")).toEqual([{ type: "key", key: "あ" }])
  })
})

describe("settle", () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  test("a burst of calls, like resize events while dragging, runs once after the last", async () => {
    let runs = 0
    const onResize = settle(() => runs++, 40)
    for (let i = 0; i < 10; i++) {
      onResize()
      await wait(10)
    }
    // Still dragging: nothing has run yet
    expect(runs).toBe(0)
    await wait(80)
    expect(runs).toBe(1)
  })

  test("calls far apart each run", async () => {
    let runs = 0
    const onResize = settle(() => runs++, 20)
    onResize()
    await wait(50)
    onResize()
    await wait(50)
    expect(runs).toBe(2)
  })

  test("cancel drops a pending call", async () => {
    let runs = 0
    const onResize = settle(() => runs++, 20)
    onResize()
    onResize.cancel()
    await wait(50)
    expect(runs).toBe(0)
  })

  test("the viewer waits a quarter second for the size to settle", () => {
    expect(RESIZE_SETTLE_MS).toBe(250)
  })
})

describe("screen", () => {
  test("placeImage homes the cursor and sends one placement sized in cells", () => {
    const out = placeImage(new Uint8Array([1, 2, 3]), { id: 2, cols: 80, rows: 23 })
    expect(out).toBe("\x1b[H\x1b_Ga=T,f=100,i=2,q=2,c=80,r=23,C=1,m=0;AQID\x1b\\")
  })

  test("placeImage can place at a cell and above other images", () => {
    const out = placeImage(new Uint8Array([1, 2, 3]), { id: 100, cols: 20, rows: 5, at: { row: 3, col: 7 }, z: 1 })
    expect(out).toBe("\x1b[3;7H\x1b_Ga=T,f=100,i=100,q=2,c=20,r=5,C=1,z=1,m=0;AQID\x1b\\")
  })

  test("placeImage chunks large payloads", () => {
    const out = placeImage(new Uint8Array(10_000), { id: 1, cols: 10, rows: 5 })
    const chunks = out.split("\x1b_G").slice(1)
    expect(chunks.length).toBe(4)
    expect(chunks[0]).toStartWith("a=T,f=100,i=1,q=2,c=10,r=5,C=1,m=1;")
    expect(chunks[3]).toStartWith("m=0,q=2;")
  })

  test("pointerShape sets the pointer with OSC 22", () => {
    expect(pointerShape("pointer")).toBe("\x1b]22;pointer\x1b\\")
    expect(pointerShape("default")).toBe("\x1b]22;default\x1b\\")
  })

  test("ENTER turns on motion reporting and LEAVE restores the pointer and turns it off", () => {
    expect(ENTER).toContain("\x1b[?1003h")
    expect(LEAVE).toContain("\x1b]22;default\x1b\\")
    expect(LEAVE).toContain("\x1b[?1003l")
  })

  test("deleteImage frees one image by id", () => {
    expect(deleteImage(1)).toBe("\x1b_Ga=d,d=I,i=1,q=2\x1b\\")
  })

  test("statusLine fits the text to the width and drops the right side first", () => {
    expect(statusLine(24, 20, "doc.md", "Top")).toBe("\x1b[24;1H\x1b[2K\x1b[7m doc.md         Top \x1b[0m")
    expect(statusLine(24, 12, "doc.md", "a long right side")).toBe("\x1b[24;1H\x1b[2K\x1b[7m doc.md     \x1b[0m")
  })

  test("queryKittyGraphics: OK before the DA reply means supported", async () => {
    const answer = async (reply: string, timeout = 500) => {
      const input = new PassThrough()
      const output = new PassThrough()
      output.on("data", () => reply && input.write(reply))
      return queryKittyGraphics(input, output, timeout)
    }
    expect(await answer("\x1b_Gi=31;OK\x1b\\\x1b[?62;4;22c")).toBe(true)
    // Only the DA reply: no Kitty graphics, and no need to wait for the timeout
    const t = Date.now()
    expect(await answer("\x1b[?62;22c", 5_000)).toBe(false)
    expect(Date.now() - t).toBeLessThan(1_000)
    // An error reply is not support either
    expect(await answer("\x1b_Gi=31;EINVAL:bad\x1b\\\x1b[?62c")).toBe(false)
    expect(await answer("", 20)).toBe(false)
  })

  const grid = { cols: 100, rows: 40 }

  test("requestCellSize sends every request and stops at a direct CSI 6 reply", async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const sent: string[] = []
    output.on("data", (d) => {
      sent.push(d.toString())
      input.write("noise\x1b[6;34;16t")
    })
    expect(await requestCellSize(input, output, grid, 5_000)).toEqual({ width: 16, height: 34 })
    expect(sent).toEqual([CELL_SIZE_QUERIES])
    expect(await requestCellSize(new PassThrough(), new PassThrough(), grid, 20)).toBeNull()
  })

  test("requestCellSize falls back to iTerm2's answer when there is no CSI 6 reply", async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    output.on("data", () => input.write("\x1b]1337;ReportCellSize=17.0;8.0;2.0\x07\x1b[4;1360;1600t"))
    expect(await requestCellSize(input, output, grid, 50)).toEqual({ width: 16, height: 34 })
  })

  test("parseCellSize prefers CSI 6, then iTerm2's ReportCellSize, then the text area", () => {
    const direct = "\x1b[6;20;10t"
    const iterm = "\x1b]1337;ReportCellSize=17.5;7.5;2\x1b\\"
    const area = "\x1b[4;1400;1500t"
    expect(parseCellSize(direct + iterm + area, grid)).toEqual({ width: 10, height: 20 })
    // Points times the scale factor
    expect(parseCellSize(iterm + area, grid)).toEqual({ width: 15, height: 35 })
    expect(parseCellSize("\x1b]1337;ReportCellSize=16;8\x07", grid)).toEqual({ width: 8, height: 16 })
    // Text area divided by the grid
    expect(parseCellSize(area, grid)).toEqual({ width: 15, height: 35 })
    expect(parseCellSize("nothing", grid)).toBeNull()
  })
})
