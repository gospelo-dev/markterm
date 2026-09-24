import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import pkg from "../../package.json" with { type: "json" }

const CLI = join(import.meta.dir, "..", "cli.ts")
const ROOT = join(import.meta.dir, "..", "..")

function run(args: string[], stdin?: string, env: Record<string, string> = {}) {
  const proc = Bun.spawnSync(["bun", CLI, ...args], {
    cwd: ROOT,
    stdin: stdin === undefined ? "ignore" : Buffer.from(stdin),
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      MARKTERM_PROTOCOL: "file",
      MARKTERM_THEME: "",
      MARKTERM_FONT: "",
      MARKTERM_CODE_FONT: "",
      ...env,
    },
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
    expect(r.stdout).toContain("Usage: markterm [options] [file]")
    expect(r.stdout).toContain("--bg <#hex>")
    expect(r.stdout).toContain("Detected terminal protocol: file")
  })

  test("--help lists the built-in themes", () => {
    const r = run(["--help"])
    expect(r.stdout).toContain("catppuccin-mocha")
    expect(r.stdout).toContain("solarized-light")
  })

  test("exits 1 on a non-hex --bg and points to -t for theme names", () => {
    const r = run(["--bg", "light"], "# Hi\n")
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('Invalid --bg "light"')
    expect(r.stderr).toContain("-t light")
  })

  test("exits 1 on an unknown theme and lists the available ones", () => {
    const r = run(["-t", "no-such-theme"], "# Hi\n")
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('Unknown theme "no-such-theme"')
    expect(r.stderr).toContain("dracula")
  })

  test("exits 1 on an unknown MARKTERM_THEME and names the variable", () => {
    const r = run([], "# Hi\n", { MARKTERM_THEME: "no-such-theme" })
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('Unknown theme "no-such-theme" (from MARKTERM_THEME)')
  })

  test("-t takes precedence over MARKTERM_THEME", () => {
    // An invalid env value is never looked at when -t is given
    const r = run(["-t", "no-such-theme"], "# Hi\n", { MARKTERM_THEME: "light" })
    expect(r.stderr).toContain('Unknown theme "no-such-theme".')
  })

  test("exits 1 on a font name that could break the stylesheet", () => {
    const r = run(["--font", "x; } body { color: red"], "# Hi\n")
    expect(r.code).toBe(1)
    expect(r.stderr).toContain("Invalid --font")
    const e = run([], "# Hi\n", { MARKTERM_CODE_FONT: "<script>" })
    expect(e.code).toBe(1)
    expect(e.stderr).toContain("Invalid MARKTERM_CODE_FONT")
  })

  test(
    "lists the document's links after the image, and --no-links turns it off",
    () => {
      const doc = "# Doc\n\nSee [docs](docs/QUICKSTART.md) and [site](https://example.com).\n"
      const r = run(["-t", "light", "-w", "300", "-s", "1"], doc)
      expect(r.code).toBe(0)
      expect(r.stdout).toContain("Links:")
      expect(r.stdout).toMatch(/\[0\] Rendered image {2}file:\/\/\S+\/markterm-\d+\.png/)
      expect(r.stdout).toContain(`[1] docs  file://${ROOT}/docs/QUICKSTART.md`)
      expect(r.stdout).toContain("[2] site  https://example.com")
      // stdout is a pipe here, so no OSC 8 sequences
      expect(r.stdout).not.toContain("\x1b]8;;")

      const off = run(["-t", "light", "-w", "300", "-s", "1", "--no-links"], doc)
      expect(off.stdout).not.toContain("Links:")
      expect(off.stdout).toContain("Saved to: ")
    },
    60_000,
  )

  test(
    "-o file.html writes a self-contained page: local images embedded, code highlighted",
    () => {
      const fs = require("node:fs")
      const dir = mkdtempSync(join(tmpdir(), "markterm-cli-html-"))
      try {
        fs.copyFileSync(join(import.meta.dir, "fixtures", "red-1x1.png"), join(dir, "dot.png"))
        const md = join(dir, "doc.md")
        fs.writeFileSync(md, "# Doc\n\n![dot](dot.png)\n\n```ts\nconst a = 1\n```\n")
        const out = join(dir, "out", "doc.html")
        fs.mkdirSync(join(dir, "out"))
        const r = run([md, "-o", out, "-t", "light"])
        expect(r.code).toBe(0)
        expect(r.stdout).toContain(`Saved to ${out}`)
        const html = fs.readFileSync(out, "utf-8") as string
        expect(html).toContain("<h1")
        expect(html).toContain('src="data:image/png;base64,')
        expect(html).not.toContain('src="file:')
        expect(html).toContain('class="shiki')
        // No PNG is written for an .html output
        expect(r.stdout).not.toContain("Links:")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
    60_000,
  )

  describe("viewer and image modes", () => {
    test("with piped output, Markdown is printed as an image (and -i does the same)", () => {
      // The test environment forces MARKTERM_PROTOCOL=file and stdout is a pipe
      const r = run(["-t", "light", "-w", "300", "-s", "1"], "# Hi\n")
      expect(r.code).toBe(0)
      expect(r.stdout).toContain("Saved to: ")
      const i = run(["-i", "-t", "light", "-w", "300", "-s", "1"], "# Hi\n")
      expect(i.code).toBe(0)
      expect(i.stdout).toContain("Saved to: ")
    }, 60_000)

    test("files only the viewer can show fail with the reason when an image is printed", () => {
      const dir = mkdtempSync(join(tmpdir(), "markterm-cli-kind-"))
      try {
        const page = join(dir, "page.html")
        require("node:fs").writeFileSync(page, "<p>x</p>")
        const r = run([page, "-t", "light"])
        expect(r.code).toBe(1)
        expect(r.stderr).toContain("can only be shown in the viewer")
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })

    test("-b is gone", () => {
      const r = run(["-b", "-t", "light"], "# Hi\n")
      expect(r.code).not.toBe(0)
      expect(r.stderr).toContain("-b")
    })

    test("--help describes the default viewer, -i and the viewer keys", () => {
      const r = run(["--help"])
      expect(r.stdout).toContain("Opens a full-screen viewer")
      expect(r.stdout).toContain("-i, --image")
      expect(r.stdout).toContain("Viewer keys:")
      expect(r.stdout).not.toContain("--browser")
    })
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
      // The temp PNG is listed as [0] after the image
      expect(r.stdout).toMatch(/\[0\] Rendered image {2}file:\/\/\S+\/markterm-\d+\.png/)
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
