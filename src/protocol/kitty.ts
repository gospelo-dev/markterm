const CHUNK_SIZE = 4096

function base64Encode(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64")
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export function buildDirectDisplay(png: Uint8Array, cols?: number): string {
  const b64 = base64Encode(png)
  const colAttr = cols ? `,c=${cols}` : ""

  if (b64.length <= CHUNK_SIZE) {
    return `\x1b_Ga=T,f=100,q=2${colAttr};${b64}\x1b\\`
  }

  const parts: string[] = []
  let offset = 0
  let first = true
  while (offset < b64.length) {
    const next = Math.min(offset + CHUNK_SIZE, b64.length)
    const isLast = next >= b64.length
    const chunk = b64.slice(offset, next)
    if (first) {
      parts.push(`\x1b_Ga=T,f=100,m=${isLast ? 0 : 1},q=2${colAttr};${chunk}\x1b\\`)
      first = false
    } else {
      parts.push(`\x1b_Gm=${isLast ? 0 : 1},q=2;${chunk}\x1b\\`)
    }
    offset = next
  }
  return parts.join("")
}
