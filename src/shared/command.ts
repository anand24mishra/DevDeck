/** Tokenize argv without expansion or shell evaluation. */
export function parseCommandLine(
  command: string,
  strict = false
): { executable: string; args: string[] } {
  const tokens: string[] = []
  let current = '',
    quote = '',
    escaped = false,
    started = false
  for (const char of command.trim()) {
    if (escaped) {
      current += char
      escaped = false
      started = true
    } else if (char === '\\' && quote !== "'") {
      escaped = true
      started = true
    } else if (quote) {
      if (char === quote) quote = ''
      else current += char
      started = true
    } else if (char === '"' || char === "'") {
      quote = char
      started = true
    } else if (/\s/.test(char)) {
      if (started) {
        tokens.push(current)
        current = ''
        started = false
      }
    } else {
      current += char
      started = true
    }
  }
  if (strict && (quote || escaped)) throw new Error('Unfinished quoted argument')
  if (escaped) current += '\\'
  if (started) tokens.push(current)
  return { executable: tokens[0] || '', args: tokens.slice(1) }
}
