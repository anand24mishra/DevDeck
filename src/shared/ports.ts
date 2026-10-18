export function parsePortInput(input: string): number | null {
  const match = input.trim().match(/^(?:localhost:|:)?(\d{1,5})$/i)
  const port = match ? Number(match[1]) : 0
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null
}

export function isLocalUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = value.match(/^http:\/\/(?:localhost|127\.0\.0\.1):(\d{1,5})\/?$/)
  return !!match && Number(match[1]) >= 1 && Number(match[1]) <= 65535
}

export function isNetworkExposed(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, '').toLowerCase()
  return (
    normalized !== 'localhost' &&
    normalized !== '::1' &&
    !/^127(?:\.\d{1,3}){3}$/.test(normalized) &&
    !/^::ffff:127(?:\.\d{1,3}){3}$/.test(normalized)
  )
}

export function validReservations(value: unknown): value is { port: number; project: string }[] {
  return (
    Array.isArray(value) &&
    value.length <= 200 &&
    new Set(value.map((p) => p?.port)).size === value.length &&
    value.every(
      (p) =>
        p &&
        Object.keys(p).sort().join(',') === 'port,project' &&
        Number.isInteger(p.port) &&
        p.port > 0 &&
        p.port <= 65535 &&
        typeof p.project === 'string' &&
        p.project.trim().length > 0 &&
        p.project.length <= 120 &&
        !p.project.includes('\0')
    )
  )
}
