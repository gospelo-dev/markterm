export { renderMarkdown, renderMarkdownHighlighted, type HighlightOptions } from "./render/markdown.js"
export { buildHtml, type TemplateOptions } from "./render/template.js"
export {
  markdownToImage,
  markdownToImageBands,
  measureCutCandidates,
  dispose,
  type ScreenshotOptions,
  type BandOptions,
  type ImageBands,
} from "./render/screenshot.js"
export { chooseCuts, type CutCandidates, type MeasuredCandidates } from "./render/bands.js"
export {
  detectProtocol,
  detectMultiplexer,
  displayInline,
  maxBandHeightFor,
  KITTY_MAX_IMAGE_DIMENSION,
  ITERM2_MAX_IMAGE_DIMENSION,
  ITERM2_MAX_ROWS,
  iterm2MaxBandHeight,
  type Protocol,
  type Multiplexer,
} from "./protocol/index.js"
export { getTerminalSize, estimateViewportWidth, type TerminalSize } from "./terminal.js"
export { extractLinks, formatLinkList, formatFilePath, type MarkdownLink } from "./links.js"
export { queryTerminalColors, type TerminalColors } from "./colorquery.js"
export {
  deriveTheme,
  fallbackTheme,
  getTheme,
  THEME_NAMES,
  normalizeHex,
  isDark,
  type ThemeColors,
} from "./render/themes.js"
