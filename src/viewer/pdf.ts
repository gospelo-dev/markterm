import type { DocumentOptions } from "../render/document.js"
import { buildHtml } from "../render/template.js"

/** pdf.js release loaded from jsDelivr to draw PDFs (headless Chromium cannot show them itself). */
export const PDFJS_VERSION = "6.3.289"

/**
 * A page that draws every page of a PDF with pdf.js, one canvas per page,
 * stacked at the width of the page and at the device pixel ratio so the text
 * stays sharp when zoomed. The PDF is embedded because a page loaded with
 * setContent cannot read file:// URLs. When done, <body data-pdf> is "ready",
 * or "error" with the reason shown on the page.
 */
export function pdfPage(pdf: Uint8Array, name: string, render: Omit<DocumentOptions, "basePath">): string {
  const cdn = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/`
  // JSON is a valid JS literal; escape "<" so the data cannot end the <script>
  const literal = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c")
  const body = `<div id="pdf" role="document" aria-label=${literal(name)}></div>
<script>
  (async () => {
  const cdn = ${literal(cdn)};
  const box = document.getElementById("pdf");
  try {
    const pdfjs = await import(cdn + "pdf.min.mjs");
    // Run pdf.js's worker code in the page: it sets globalThis.pdfjsWorker,
    // which pdf.js uses instead of a Worker thread. A Worker cannot load the
    // CDN module from this page (about:blank), and getDocument would hang.
    await import(cdn + "pdf.worker.min.mjs");
    const data = Uint8Array.from(atob(${literal(Buffer.from(pdf).toString("base64"))}), (c) => c.charCodeAt(0));
    const doc = await pdfjs.getDocument({ data }).promise;
    const width = box.clientWidth;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const scale = width / page.getViewport({ scale: 1 }).width;
      const css = page.getViewport({ scale });
      const viewport = page.getViewport({ scale: scale * devicePixelRatio });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.cssText = "display:block;background:#fff;margin:0 0 16px;width:" + css.width + "px;height:" + css.height + "px";
      box.appendChild(canvas);
      await page.render({ canvas, viewport }).promise;
    }
    document.body.dataset.pdf = "ready";
  } catch (e) {
    box.textContent = "Could not display the PDF: " + e;
    document.body.dataset.pdf = "error";
  }
  })();
</script>`
  return buildHtml(body, { ...render, interactive: { baseUrl: "about:blank" } })
}
