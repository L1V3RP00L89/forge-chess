const DIRECT_GO_LIMITS = new Set([
  'depth',
  'movetime',
  'nodes',
  'mate',
  'wtime',
  'btime',
])

const INCREMENT_LIMITS = new Set([
  'winc',
  'binc',
])

function hasPositiveNumericValue(parts: string[], index: number): boolean {
  const value = Number(parts[index + 1])
  return Number.isFinite(value) && value > 0
}

export function isHeavyEngineLabCommand(command: string): boolean {
  const parts = command.trim().toLowerCase().split(/\s+/g).filter(Boolean)
  const verb = parts[0]
  if (!verb) return false

  if (verb === 'bench') return true
  if (verb === 'perft') return true

  if (verb !== 'go') return false
  const searchMovesIndex = parts.indexOf('searchmoves')
  const limitParts = searchMovesIndex >= 0 ? parts.slice(0, searchMovesIndex) : parts
  if (limitParts.includes('infinite') || limitParts.includes('ponder')) return true
  const hasClockTime = limitParts.some((part, index) => {
    return (part === 'wtime' || part === 'btime') && hasPositiveNumericValue(limitParts, index)
  })

  return !limitParts.some((part, index) => {
    if (DIRECT_GO_LIMITS.has(part)) return hasPositiveNumericValue(limitParts, index)
    if (!INCREMENT_LIMITS.has(part)) return false
    return hasPositiveNumericValue(limitParts, index) && hasClockTime
  })
}
