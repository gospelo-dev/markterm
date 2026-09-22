export type TerminalColors = {
  bg: string
  fg: string
  blue: string
}

function parseOscResponse(raw: string): string | null {
  const match = raw.match(/rgb:([0-9a-fA-F]{2,4})\/([0-9a-fA-F]{2,4})\/([0-9a-fA-F]{2,4})/)
  if (!match) return null
  const toHex2 = (s: string) => s.length <= 2 ? s.padStart(2, "0") : s.slice(0, 2)
  const r = toHex2(match[1])
  const g = toHex2(match[2])
  const b = toHex2(match[3])
  return `#${r}${g}${b}`
}

async function queryOscColor(code: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup()
      resolve(null)
    }, timeoutMs)

    let buf = ""

    const onData = (chunk: Buffer) => {
      buf += chunk.toString()
      if (buf.includes("\x07") || buf.includes("\x1b\\")) {
        cleanup()
        resolve(parseOscResponse(buf))
      }
    }

    const cleanup = () => {
      clearTimeout(timer)
      process.stdin.removeListener("data", onData)
      process.stdin.pause()
      if (wasRaw !== undefined) {
        process.stdin.setRawMode(wasRaw)
      }
    }

    let wasRaw: boolean | undefined
    try {
      if (process.stdin.isTTY) {
        wasRaw = process.stdin.isRaw
        process.stdin.setRawMode(true)
      } else {
        resolve(null)
        clearTimeout(timer)
        return
      }
    } catch {
      resolve(null)
      clearTimeout(timer)
      return
    }

    process.stdin.resume()
    process.stdin.on("data", onData)
    process.stdout.write(code)
  })
}

export async function queryTerminalColors(): Promise<TerminalColors | null> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return null

  const TIMEOUT = 500

  const bg = await queryOscColor("\x1b]11;?\x07", TIMEOUT)
  if (!bg) return null

  const fg = await queryOscColor("\x1b]10;?\x07", TIMEOUT)
  if (!fg) return null

  const blue = await queryOscColor("\x1b]4;4;?\x07", TIMEOUT)

  return {
    bg,
    fg,
    blue: blue || "#89b4fa",
  }
}
