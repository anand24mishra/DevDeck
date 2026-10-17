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
