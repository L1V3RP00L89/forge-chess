const FINITE_GO_LIMITS = new Set([
  'depth',
  'movetime',
  'nodes',
  'mate',
  'wtime',
  'btime',
  'winc',
  'binc',
  'movestogo',
])

export function isHeavyEngineLabCommand(command: string): boolean {
  const parts = command.trim().toLowerCase().split(/\s+/g).filter(Boolean)
  const verb = parts[0]
  if (!verb) return false

  if (verb === 'bench') return true
  if (verb === 'perft') return true

  if (verb !== 'go') return false
  if (parts.includes('infinite') || parts.includes('ponder')) return true

  return !parts.some(part => FINITE_GO_LIMITS.has(part))
}
