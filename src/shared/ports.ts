export function parsePortInput(input: string): number | null {
  const match = input.trim().match(/^(?:localhost:|:)?(\d{1,5})$/i)
  const port = match ? Number(match[1]) : 0
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null
}
