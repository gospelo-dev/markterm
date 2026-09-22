import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { detectMultiplexer } from "../protocol/passthrough.js"

describe("detectMultiplexer", () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    saved.TMUX = process.env.TMUX
    saved.STY = process.env.STY
    delete process.env.TMUX
    delete process.env.STY
  })

  afterEach(() => {
    if (saved.TMUX !== undefined) process.env.TMUX = saved.TMUX
    else delete process.env.TMUX
    if (saved.STY !== undefined) process.env.STY = saved.STY
    else delete process.env.STY
  })

  test("returns tmux when TMUX is set", () => {
    process.env.TMUX = "/tmp/tmux-501/default,12345,0"
    expect(detectMultiplexer()).toBe("tmux")
  })

  test("returns screen when STY is set", () => {
    process.env.STY = "12345.pts-0.host"
    expect(detectMultiplexer()).toBe("screen")
  })

  test("returns null when neither is set", () => {
    expect(detectMultiplexer()).toBeNull()
  })

  test("tmux takes precedence over screen", () => {
    process.env.TMUX = "/tmp/tmux-501/default,12345,0"
    process.env.STY = "12345.pts-0.host"
    expect(detectMultiplexer()).toBe("tmux")
  })
})
