export type KeyName =
  | "up"
  | "down"
  | "left"
  | "right"
  | "pageup"
  | "pagedown"
  | "home"
  | "end"
  | "enter"
  | "backspace"
  | "escape"
  | "tab"
  | "ctrl-c"

export type InputEvent =
  | { type: "key"; key: KeyName | string }
  /** x and y are 1-based terminal cells, as reported by SGR mouse mode. */
  | { type: "click"; x: number; y: number }
  | { type: "wheel"; direction: "up" | "down"; x: number; y: number }
  /** The pointer moved with no button held. */
  | { type: "move"; x: number; y: number }

const CSI_KEYS: Record<string, KeyName> = {
  A: "up",
  B: "down",
  C: "right",
  D: "left",
  H: "home",
  F: "end",
  "1~": "home",
  "7~": "home",
  "4~": "end",
  "8~": "end",
  "5~": "pageup",
  "6~": "pagedown",
}

// SGR mouse report: ESC [ < button ; x ; y (M = press, m = release)
const SGR_MOUSE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/
// Other CSI / SS3 sequences: ESC [ params final, ESC O final
const CSI = /^\x1b\[([0-9;]*)([A-Za-z~])/
const SS3 = /^\x1bO([A-Za-z])/
// Replies from the terminal, not keys: OSC (ESC ]), APC (ESC _) and DCS (ESC P),
// ended by BEL or ST. E.g. iTerm2's ReportCellSize, Kitty graphics responses.
const STRING_SEQUENCE = /^\x1b[\]_P][^\x07\x1b]*(?:\x07|\x1b\\)/
const STRING_SEQUENCE_START = /^\x1b[\]_P][^\x07\x1b]*\x1b?$/

/**
 * Turns raw terminal input into key and mouse events. Keeps an incomplete
 * escape sequence at the end of a chunk until the next chunk arrives.
 */
export class InputParser {
  private pending = ""

  push(chunk: string): InputEvent[] {
    let buf = this.pending + chunk
    this.pending = ""
    const events: InputEvent[] = []

    while (buf.length > 0) {
      if (buf[0] !== "\x1b") {
        const ch = String.fromCodePoint(buf.codePointAt(0)!)
        buf = buf.slice(ch.length)
        events.push({ type: "key", key: controlKey(ch) })
        continue
      }

      const mouse = SGR_MOUSE.exec(buf)
      if (mouse) {
        buf = buf.slice(mouse[0].length)
        const button = Number(mouse[1])
        const x = Number(mouse[2])
        const y = Number(mouse[3])
        const press = mouse[4] === "M"
        if (button === 64 || button === 65) {
          events.push({ type: "wheel", direction: button === 64 ? "up" : "down", x, y })
        } else if (button === 0 && press) {
          events.push({ type: "click", x, y })
        } else if (button === 35) {
          // 32 (motion) + 3 (no button)
          events.push({ type: "move", x, y })
        }
        // Other buttons, releases and drags are ignored
        continue
      }

      const reply = STRING_SEQUENCE.exec(buf)
      if (reply) {
        buf = buf.slice(reply[0].length)
        continue
      }
      if (STRING_SEQUENCE_START.test(buf)) {
        // A reply cut off by the end of the chunk: wait for the rest
        this.pending = buf
        break
      }

      const csi = CSI.exec(buf) ?? SS3.exec(buf)
      if (csi) {
        buf = buf.slice(csi[0].length)
        const code = csi.length === 3 ? `${csi[1].split(";").pop() ?? ""}${csi[2]}` : csi[1]
        const key = CSI_KEYS[code] ?? CSI_KEYS[csi[csi.length - 1]]
        if (key) events.push({ type: "key", key })
        continue
      }

      // An escape sequence cut off by the end of the chunk: wait for the rest.
      // This also holds back a lone ESC at the very end, which the viewer
      // does not bind to anything.
      if (buf === "\x1b" || buf === "\x1bO" || /^\x1b\[<?[0-9;]*$/.test(buf)) {
        this.pending = buf
        break
      }

      // A lone ESC (or ESC followed by a normal key)
      buf = buf.slice(1)
      events.push({ type: "key", key: "escape" })
    }
    return events
  }
}

function controlKey(ch: string): KeyName | string {
  switch (ch) {
    case "\r":
    case "\n":
      return "enter"
    case "\x7f":
    case "\b":
      return "backspace"
    case "\t":
      return "tab"
    case "\x03":
      return "ctrl-c"
    default:
      return ch
  }
}
