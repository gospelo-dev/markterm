/**
 * Splitting a tall render into horizontal bands.
 *
 * Ghostty rejects Kitty Graphics images with any dimension above 10000 px.
 * Instead of cutting the PNG at fixed pixel offsets (which slices text lines),
 * the page is measured in Chromium and cut in the white space between blocks,
 * or at row / item / line boundaries inside a block that is taller than a band.
 */

export type CutCandidates = {
  /** Gaps between blocks: a cut here lands in white space. Tried first. */
  preferred: number[]
  /** Row, item and line boundaries inside blocks. Used only when no preferred candidate is within reach. */
  fallback?: number[]
}

/**
 * Pick the y positions (CSS px, relative to the top of the measured area) at
 * which a render of `totalHeight` is cut so that no band is taller than `maxBand`.
 *
 * Greedy, from the current start: take the lowest preferred candidate within
 * reach; failing that the lowest fallback candidate; failing that (an image
 * taller than a band, say) cut at the limit itself. Cuts are rounded to whole
 * CSS px so that bands line up on pixel boundaries at integer device scale
 * factors. Returns an empty array when no split is needed.
 */
export function chooseCuts(
  candidates: number[] | CutCandidates,
  totalHeight: number,
  maxBand: number,
): number[] {
  if (!(maxBand > 0)) throw new RangeError(`maxBand must be positive, got ${maxBand}`)
  const tiers = Array.isArray(candidates)
    ? [[...candidates].sort((a, b) => a - b)]
    : [[...candidates.preferred].sort((a, b) => a - b), [...(candidates.fallback ?? [])].sort((a, b) => a - b)]

  const cuts: number[] = []
  let start = 0
  while (totalHeight - start > maxBand) {
    const limit = start + maxBand
    let best = -1
    for (const tier of tiers) {
      for (const y of tier) {
        if (y <= start) continue
        if (y > limit) break
        best = y
      }
      if (Math.round(best) > start) break
    }
    let cut = Math.round(best > start ? best : limit)
    if (cut <= start) cut = Math.floor(limit)
    if (cut <= start) cut = start + maxBand
    cuts.push(cut)
    start = cut
  }
  return cuts
}

export type MeasuredCandidates = {
  /** Height of <body> in CSS px */
  height: number
  /** Midpoints of gaps between consecutive blocks (any nesting level), CSS px from the top of <body>, ascending */
  gaps: number[]
  /** Table row, list item and text line boundaries inside blocks, CSS px from the top of <body>, ascending */
  inner: number[]
}

/**
 * Browser-side measurement, evaluated with page.evaluate(). Kept as a string so
 * it does not need the DOM lib in tsconfig and survives bundling unchanged.
 *
 * Candidates, all relative to the top of <body>:
 * - gaps: the midpoint between consecutive blocks, at the top level (body > *)
 *   and between nested blocks (paragraphs inside a blockquote or list item)
 * - inner: the top of every table row after the first, the top of every list
 *   item after the first, and the midpoint between consecutive text line boxes
 *   (Range.getClientRects)
 * - never inside img, svg (Mermaid), canvas, video, or table cells
 */
export const MEASURE_CANDIDATES_JS = `(() => {
  // not part of the layout at all
  const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"]);
  // take part in gaps between blocks, but are never cut inside
  const ATOMIC = new Set(["IMG", "SVG", "CANVAS", "VIDEO"]);
  const BLOCKISH = new Set(["P", "PRE", "BLOCKQUOTE", "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TFOOT", "TR",
    "TH", "TD", "H1", "H2", "H3", "H4", "H5", "H6", "DIV", "HR", "DL", "DT", "DD", "FIGURE", "SECTION", "DETAILS", "SUMMARY"]);
  const isAtomic = (el) => ATOMIC.has(el.tagName) || el.classList.contains("mermaid");
  const isBlock = (el) => BLOCKISH.has(el.tagName) || isAtomic(el);

  const body = document.body;
  const bodyRect = body.getBoundingClientRect();
  const base = bodyRect.top;
  const height = bodyRect.height;
  const gaps = new Set();
  const inner = new Set();
  const addGap = (y) => { if (y > 0 && y < height) gaps.add(y); };
  const add = (y) => { if (y > 0 && y < height) inner.add(y); };
  const mid = (a, b) => (a.getBoundingClientRect().bottom + b.getBoundingClientRect().top) / 2 - base;
  // true when no blockish or atomic element sits between node and el
  const directlyInside = (node, el) => {
    let p = node.parentElement;
    while (p && p !== el) {
      if (isBlock(p)) return false;
      p = p.parentElement;
    }
    return true;
  };

  // Midpoints between consecutive line boxes of el's own inline content.
  // Inline atomic elements (an image inside a paragraph) count as part of
  // their line, so that a cut never falls inside them.
  const lineBoundaries = (el) => {
    const rects = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue && n.nodeValue.trim() && directlyInside(n, el))
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const range = document.createRange();
    let node;
    while ((node = walker.nextNode())) {
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.height > 0 && r.width > 0) rects.push({ top: r.top - base, bottom: r.bottom - base });
      }
    }
    for (const a of el.querySelectorAll("img, svg, canvas, video, .mermaid")) {
      if (!directlyInside(a, el)) continue;
      const r = a.getBoundingClientRect();
      if (r.height > 0) rects.push({ top: r.top - base, bottom: r.bottom - base });
    }
    rects.sort((a, b) => a.top - b.top);
    const lines = [];
    for (const r of rects) {
      const last = lines[lines.length - 1];
      if (last && r.top < last.bottom) { last.bottom = Math.max(last.bottom, r.bottom); continue; }
      lines.push({ top: r.top, bottom: r.bottom });
    }
    for (let i = 1; i < lines.length; i++) add((lines[i - 1].bottom + lines[i].top) / 2);
  };

  const visit = (el) => {
    if (isAtomic(el)) return;
    const tag = el.tagName;
    if (tag === "TABLE") {
      const rows = el.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr");
      rows.forEach((tr, i) => { if (i > 0) add(tr.getBoundingClientRect().top - base); });
      return;
    }
    if (tag === "UL" || tag === "OL") {
      const items = Array.from(el.children).filter((c) => c.tagName === "LI");
      items.forEach((li, i) => { if (i > 0) add(li.getBoundingClientRect().top - base); visit(li); });
      return;
    }
    lineBoundaries(el);
    const kids = Array.from(el.children).filter((c) => isBlock(c) && !SKIP.has(c.tagName));
    for (let i = 1; i < kids.length; i++) addGap(mid(kids[i - 1], kids[i]));
    for (const k of kids) visit(k);
  };

  const blocks = Array.from(body.children).filter((e) => !SKIP.has(e.tagName));
  for (let i = 1; i < blocks.length; i++) addGap(mid(blocks[i - 1], blocks[i]));
  for (const b of blocks) visit(b);

  const asc = (s) => Array.from(s).sort((a, b) => a - b);
  return { height, gaps: asc(gaps), inner: asc(inner) };
})()`
