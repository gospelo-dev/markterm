export type Multiplexer = "tmux" | "screen" | null

export function detectMultiplexer(): Multiplexer {
  if (process.env.TMUX) return "tmux"
  if (process.env.STY) return "screen"
  return null
}
