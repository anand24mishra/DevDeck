import fs from 'fs'
import os from 'os'
import path from 'path'

export interface ProjectInfo {
  name: string
  root: string | null
}

const projectCache = new Map<string, ProjectInfo>()

/**
 * Resolves project name and root by walking up from the process's working directory
 * towards the nearest .git directory or package.json, stopping before exiting $HOME.
 */
export function resolveProjectFromCwd(cwd: string | null): ProjectInfo {
  if (!cwd) {
    return { name: 'Other', root: null }
  }

  const normalizedCwd = path.resolve(cwd)
  if (projectCache.has(normalizedCwd)) {
    return projectCache.get(normalizedCwd)!
  }

  const homeDir = os.homedir()
  let currentDir = normalizedCwd

  while (currentDir && currentDir !== path.dirname(currentDir)) {
    // Check for project root markers
    const hasGit = fs.existsSync(path.join(currentDir, '.git'))
    const hasPackageJson = fs.existsSync(path.join(currentDir, 'package.json'))

    if (hasGit || hasPackageJson) {
      const info: ProjectInfo = {
        name: path.basename(currentDir),
        root: currentDir
      }
      projectCache.set(normalizedCwd, info)
      return info
    }

    // Do not walk above user's home directory
    if (currentDir === homeDir) {
      break
    }

    currentDir = path.dirname(currentDir)
  }

  // Fallback: use directory basename or 'Other'
  const fallbackName = path.basename(normalizedCwd) || 'Other'
  const fallbackInfo: ProjectInfo = {
    name: fallbackName,
    root: normalizedCwd
  }
  projectCache.set(normalizedCwd, fallbackInfo)
  return fallbackInfo
}
