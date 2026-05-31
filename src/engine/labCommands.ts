const DIRECT_GO_LIMITS = new Set([
  'depth',
  'movetime',
  'nodes',
  'mate',
  'movestogo',
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
  if (parts.includes('infinite') || parts.includes('ponder')) return true
  const hasClockTime = parts.some((part, index) => {
    return (part === 'wtime' || part === 'btime') && hasPositiveNumericValue(parts, index)
  })

  return !parts.some((part, index) => {
    if (DIRECT_GO_LIMITS.has(part)) return hasPositiveNumericValue(parts, index)
    if (!INCREMENT_LIMITS.has(part)) return false
    return hasPositiveNumericValue(parts, index) && hasClockTime
  })
}
