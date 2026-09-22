import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import pkg from "../../package.json" with { type: "json" }

const CLI = join(import.meta.dir, "..", "cli.ts")
const ROOT = join(import.meta.dir, "..", "..")

function run(args: string[], stdin?: string) {
  const proc = Bun.spawnSync(["bun", CLI, ...args], {
    cwd: ROOT,
    stdin: stdin === undefined ? "ignore" : Buffer.from(stdin),
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, MARKTERM_PROTOCOL: "file" },
  })
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  }
}

describe("markterm CLI", () => {
  test("--version prints the version from package.json", () => {
    const r = run(["--version"])
    expect(r.code).toBe(0)
    expect(r.stdout.trim()).toBe(`markterm ${pkg.version}`)
  })

  test("--help lists options and the detected protocol", () => {
    const r = run(["--help"])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain("Usage: markterm [options] [file.md]")
    expect(r.stdout).toContain("--bg <#hex>")
    expect(r.stdout).toContain("Detected terminal protocol: file")
  })

  test("exits 1 when the input file does not exist", () => {
    const r = run(["no-such-file.md"])
    expect(r.code).toBe(1)
    expect(r.stderr).toContain("File not found")
  })

  test("exits 1 on empty stdin", () => {
    const r = run([], "   \n")
    expect(r.code).toBe(1)
    expect(r.stderr).toContain("No markdown content")
  })

  test(
    "-p kitty sends a tall render as several image sequences",
    () => {
      const doc = Array.from(
        { length: 150 },
        (_, i) => `Paragraph ${i} with enough words in it to wrap onto a second line at three hundred pixels.`,
      ).join("\n\n")
      const r = run(["-p", "kitty", "-t", "light", "-w", "300", "-s", "2"], doc)
      expect(r.code).toBe(0)
      const starts = r.stdout.split("\x1b_Ga=T,").length - 1
      expect(starts).toBeGreaterThanOrEqual(2)
      expect(r.stderr).toContain("markterm-")
    },
    60_000,
  )

  test(
    "-p iterm2 sends a tall render as several images of at most 255 rows",
    () => {
      const doc = Array.from(
        { length: 150 },
        (_, i) => `Paragraph ${i} with enough words in it to wrap onto a second line at three hundred pixels.`,
      ).join("\n\n")
      const r = run(["-p", "iterm2", "-t", "light", "-w", "300", "-s", "2"], doc)
      expect(r.code).toBe(0)
      const files = r.stdout.split("\x1b]1337;File=").length - 1
      const multipart = r.stdout.split("\x1b]1337;MultipartFile=").length - 1
      expect(files + multipart).toBeGreaterThanOrEqual(2)
      expect(r.stdout.split("\x1b]1337;FileEnd\x07").length - 1).toBe(multipart)
    },
    60_000,
  )

  test(
    "-o renders stdin Markdown to a PNG file",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "markterm-cli-"))
      const out = join(dir, "out.png")
      try {
        const r = run(["-o", out, "-t", "light", "-w", "300", "-s", "1"], "# Hi\n\ntext\n")
        expect(r.code).toBe(0)
        expect(r.stdout).toContain(`Saved to ${out}`)
        expect(existsSync(out)).toBe(true)
        const bytes = new Uint8Array(require("node:fs").readFileSync(out))
        expect(Array.from(bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
    60_000,
  )
})
