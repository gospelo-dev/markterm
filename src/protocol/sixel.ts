import { spawnSync } from "child_process"

let img2sixelPath: string | null | undefined = undefined

function findImg2Sixel(): string | null {
  if (img2sixelPath !== undefined) return img2sixelPath
  const result = spawnSync("which", ["img2sixel"], { encoding: "utf-8" })
  img2sixelPath = result.status === 0 ? result.stdout.trim() : null
  return img2sixelPath
}

export function isSixelAvailable(): boolean {
  return findImg2Sixel() !== null
}

export function buildDirectDisplay(png: Uint8Array): string | null {
  const bin = findImg2Sixel()
  if (!bin) return null

  const result = spawnSync(bin, ["-"], {
    input: Buffer.from(png),
    encoding: "buffer",
    maxBuffer: 50 * 1024 * 1024,
  })
  if (result.status !== 0) return null
  return result.stdout.toString("utf-8")
}
