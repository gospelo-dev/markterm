import { describe, expect, test } from "bun:test"
import { queryTerminalColors } from "../colorquery.js"

describe("queryTerminalColors", () => {
  test("returns null when stdin or stdout is not a TTY", async () => {
    // Under `bun test` stdout is piped, so the query must bail out without writing OSC sequences.
    if (process.stdin.isTTY && process.stdout.isTTY) {
      // Interactive run: the terminal may answer; only assert the shape when it does.
      const c = await queryTerminalColors()
      if (c) {
        expect(c.bg).toMatch(/^#[0-9a-f]{6}$/)
        expect(c.fg).toMatch(/^#[0-9a-f]{6}$/)
        expect(c.blue).toMatch(/^#[0-9a-f]{6}$/)
      }
      return
    }
    expect(await queryTerminalColors()).toBeNull()
  })
})
