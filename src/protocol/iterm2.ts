function base64Encode(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64")
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/**
 * iTerm2 rejects any single control sequence longer than this (documented at
 * https://iterm2.com/documentation-images.html) and shows a broken-image icon.
 */
export const ITERM2_MAX_SEQUENCE_BYTES = 1_048_576

/**
 * Base64 characters per FilePart in the multipart form. A multiple of 4, so
 * every part is valid base64 on its own; far below the sequence limit.
 */
export const ITERM2_PART_SIZE = 65_536

/**
 * iTerm2 discards a decoded image whose width or height is >= this
 * ("Bogus size" in sources/InlineImages/iTermImage.m) and shows the
 * broken-image icon instead.
 */
export const ITERM2_MAX_IMAGE_DIMENSION = 10000

/**
 * One inline image can occupy at most this many terminal rows: iTerm2 keeps
 * the row index within an image in 8 bits (VT100InlineImageHelper.m). Taller
 * images are scaled down, which also shrinks their width.
 */
export const ITERM2_MAX_ROWS = 255

/**
 * Lower bound assumed for a cell's height / width ratio. Monospace cells are
 * about 2.0 (Menlo 12pt: 7 x 14); 1.6 leaves room for wide fonts, so a band
 * computed with it never exceeds ITERM2_MAX_ROWS in practice.
 */
const MIN_CELL_ASPECT = 1.6

/**
 * Tallest band, in image pixels, that iTerm2 will show at full width when the
 * image is `pixelWidth` wide and displayed across `cols` columns: 255 rows of
 * cells whose width in image pixels is pixelWidth / cols, capped below the
 * dimension limit.
 */
export function iterm2MaxBandHeight(pixelWidth: number, cols: number): number {
  const cellWidthPx = pixelWidth / Math.max(1, cols)
  const byRows = Math.floor(ITERM2_MAX_ROWS * MIN_CELL_ASPECT * cellWidthPx)
  return Math.max(1, Math.min(ITERM2_MAX_IMAGE_DIMENSION - 1, byRows))
}

/**
 * Build the iTerm2 inline-image sequence. Payloads that fit in one sequence
 * use the classic `File=` form (works on every iTerm2 version). Larger ones use
 * the multipart form added in iTerm2 3.5, which is also what iTerm2's own
 * imgcat sends: `MultipartFile=<args>`, then `FilePart=<chunk>` repeated,
 * then `FileEnd`.
 */
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

  const single = `\x1b]1337;File=${args.join(";")}:${b64}\x07`
  if (single.length <= ITERM2_MAX_SEQUENCE_BYTES) return single

  const parts: string[] = [`\x1b]1337;MultipartFile=${args.join(";")}\x07`]
  for (let i = 0; i < b64.length; i += ITERM2_PART_SIZE) {
    parts.push(`\x1b]1337;FilePart=${b64.slice(i, i + ITERM2_PART_SIZE)}\x07`)
  }
  parts.push("\x1b]1337;FileEnd\x07")
  return parts.join("")
}
