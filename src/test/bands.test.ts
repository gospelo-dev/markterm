import { describe, expect, test } from "bun:test"
import { chooseCuts } from "../render/bands.js"

describe("chooseCuts", () => {
  test("returns no cuts when the whole render fits in one band", () => {
    expect(chooseCuts([100, 200], 500, 500)).toEqual([])
    expect(chooseCuts([], 499.5, 500)).toEqual([])
  })

  test("picks the lowest candidate within reach of the limit", () => {
    expect(chooseCuts([100, 350, 480, 520], 900, 500)).toEqual([480])
  })

  test("cuts at the limit itself when no candidate is within reach", () => {
    expect(chooseCuts([600], 900, 500)).toEqual([500])
    expect(chooseCuts([], 1200, 500)).toEqual([500, 1000])
  })

  test("chains bands greedily from each cut", () => {
    const candidates = [90, 190, 290, 390, 490, 590, 690, 790, 890, 990]
    expect(chooseCuts(candidates, 1000, 300)).toEqual([290, 590, 890])
  })

  test("accepts unsorted candidates", () => {
    expect(chooseCuts([480, 100, 520, 350], 900, 500)).toEqual([480])
  })

  test("rounds cuts to whole pixels and never stalls on a candidate that rounds to the start", () => {
    expect(chooseCuts([200.4], 1000, 500)).toEqual([200, 700])
    expect(chooseCuts([0.3], 800, 500)).toEqual([500])
  })

  test("no band is taller than maxBand, whatever the candidates", () => {
    const candidates = Array.from({ length: 135 }, (_, i) => i * 37 + 0.5)
    const total = 5000
    const cuts = chooseCuts(candidates, total, 400)
    const edges = [0, ...cuts, total]
    for (let i = 1; i < edges.length; i++) {
      expect(edges[i] - edges[i - 1]).toBeGreaterThan(0)
      expect(edges[i] - edges[i - 1]).toBeLessThanOrEqual(400)
    }
  })

  test("prefers a block gap over a lower line boundary", () => {
    // first band: gap 300 wins over line 480; second band: no gap left, so line 480 is used
    expect(chooseCuts({ preferred: [300], fallback: [480] }, 900, 500)).toEqual([300, 480])
    expect(chooseCuts({ preferred: [300, 700], fallback: [480] }, 900, 500)).toEqual([300, 700])
  })

  test("falls back to inner boundaries only when no gap is within reach", () => {
    // gap at 100 is behind us after the first cut; the block from 100 to 1300 must be cut inside
    expect(chooseCuts({ preferred: [100, 1300], fallback: [450, 590, 1000] }, 1400, 500)).toEqual([100, 590, 1000])
  })

  test("a gap that rounds to the start does not shadow a usable fallback", () => {
    expect(chooseCuts({ preferred: [0.2], fallback: [400] }, 800, 500)).toEqual([400])
  })

  test("a bare array behaves as preferred candidates only", () => {
    expect(chooseCuts({ preferred: [480] }, 900, 500)).toEqual(chooseCuts([480], 900, 500))
  })

  test("throws on a non-positive maxBand", () => {
    expect(() => chooseCuts([], 10, 0)).toThrow(RangeError)
  })
})
