function base64Encode(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64")
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export function buildDirectDisplay(png: Uint8Array, cols?: number): string {
  const args = [
    "inline=1",
    "preserveAspectRatio=1",
    `size=${png.length}`,
    `name=${base64Encode(new TextEncoder().encode("markterm.png"))}`,
  ]
  if (cols) args.push(`width=${cols}`)
  else args.push("width=100%")
  const b64 = base64Encode(png)
  return `\x1b]1337;File=${args.join(";")}:${b64}\x07`
}
