/**
 * Utility for parsing command lines into executable path and argument array.
 * Handles single quotes, double quotes, and escaped characters.
 */
export function parseCommandLine(command: string): { executable: string; args: string[] } {
  const trimmed = command.trim()
  if (!trimmed) {
    return { executable: '', args: [] }
  }

  const tokens: string[] = []
  let current = ''
  let inDouble = false
  let inSingle = false
  let escaped = false

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]
    if (escaped) {
      current += char
      escaped = false
    } else if (char === '\\') {
      escaped = true
    } else if (char === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (char === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (/\s/.test(char) && !inDouble && !inSingle) {
      if (current.length > 0) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current.length > 0) {
    tokens.push(current)
  }

  if (tokens.length === 0) {
    return { executable: '', args: [] }
  }

  return {
    executable: tokens[0],
    args: tokens.slice(1)
  }
}
