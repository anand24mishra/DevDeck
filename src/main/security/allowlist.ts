import path from 'path'

export const DEFAULT_ALLOWLIST = new Set([
  'node',
  'npm',
  'npx',
  'yarn',
  'pnpm',
  'bun',
  'deno',
  'python',
  'python3',
  'ruby',
  'go',
  'java',
  'php',
  'uvicorn',
  'gunicorn',
  'puma',
  'cargo',
  'vite',
  'next',
  'webpack',
  'esbuild'
])

export interface FilterProcessOptions {
  currentPid?: number
  parentPid?: number
  userIgnoreList?: string[]
  customAllowlist?: string[]
}

/**
 * Extracts binary/executable base name from a command line or binary path.
 * Handles paths with spaces, e.g., "/Applications/Xcode.app/.../node" or "node server.js".
 */
export function extractBinaryName(command: string): { binaryName: string; executablePath: string } {
  const trimmed = command.trim()
  if (!trimmed) {
    return { binaryName: '', executablePath: '' }
  }

  // Handle unquoted paths with spaces containing .app/Contents/
  const appMatch = trimmed.match(/^([^"']*\.app\/Contents\/[^\s]+)/)
  if (appMatch) {
    const fullPath = appMatch[1]
    return {
      binaryName: path.basename(fullPath).toLowerCase(),
      executablePath: fullPath
    }
  }

  // Handle quoted paths e.g. "path with space/node" arg
  let firstToken = ''
  if (trimmed.startsWith('"')) {
    const nextQuote = trimmed.indexOf('"', 1)
    firstToken = nextQuote !== -1 ? trimmed.slice(1, nextQuote) : trimmed.slice(1)
  } else if (trimmed.startsWith("'")) {
    const nextQuote = trimmed.indexOf("'", 1)
    firstToken = nextQuote !== -1 ? trimmed.slice(1, nextQuote) : trimmed.slice(1)
  } else {
    firstToken = trimmed.split(/\s+/)[0]
  }

  const baseName = path.basename(firstToken).toLowerCase()
  return {
    binaryName: baseName,
    executablePath: firstToken
  }
}

/**
 * Determines whether a process is allowed under the safety model.
 */
export function isProcessAllowed(
  pid: number,
  command: string,
  options: FilterProcessOptions = {}
): { allowed: boolean; reason?: string } {
  const { currentPid, userIgnoreList = [], customAllowlist = [] } = options

  // 1. PID guard: Never DevDeck itself or root/init
  if (pid <= 1) {
    return { allowed: false, reason: 'System process (pid <= 1)' }
  }
  if (currentPid && pid === currentPid) {
    return { allowed: false, reason: 'DevDeck self-process' }
  }

  const { binaryName, executablePath } = extractBinaryName(command)
  if (!binaryName) {
    return { allowed: false, reason: 'Empty command' }
  }

  // 2. User ignore list takes absolute priority
  const normalizedIgnore = userIgnoreList.map((item) => item.trim().toLowerCase())
  if (
    normalizedIgnore.includes(binaryName) ||
    normalizedIgnore.some((item) => item && command.toLowerCase().includes(item))
  ) {
    return { allowed: false, reason: 'User ignore list match' }
  }

  // 3. Skip macOS application bundles (.app/Contents/) unless specifically custom-allowlisted
  if (executablePath.includes('.app/Contents/') || command.includes('.app/Contents/')) {
    const isExplicitlyAllowed = customAllowlist.map((c) => c.toLowerCase()).includes(binaryName)
    if (!isExplicitlyAllowed) {
      return { allowed: false, reason: 'Inside .app/Contents/ bundle' }
    }
  }

  // 4. Check allowlist (defaults + custom additions)
  const isDefault = DEFAULT_ALLOWLIST.has(binaryName)
  const isCustom = customAllowlist.map((c) => c.toLowerCase()).includes(binaryName)

  if (!isDefault && !isCustom) {
    return { allowed: false, reason: `Binary '${binaryName}' not in allowlist` }
  }

  return { allowed: true }
}
