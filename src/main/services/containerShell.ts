import fs from 'fs/promises'
import { constants } from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { detectApplications } from './applications'
import { resolveDockerSocket } from './docker'
import type { Result, Settings } from '../../shared/types'

// Static program: all variable data is JSON, never source text or a shell command.
export const TERMINAL_BRIDGE = `#!/usr/bin/ruby
require 'json'
require 'fileutils'
begin
  config = JSON.parse(File.read(File.join(__dir__, 'arguments.json')))
  child = Process.spawn(config.fetch('file'), *config.fetch('args'))
  Process.wait(child)
ensure
  FileUtils.remove_entry_secure(__dir__) if File.directory?(__dir__)
end
`
export function containerShellArguments(
  socket: string,
  id: string,
  shell: 'bash' | 'sh'
): string[] {
  if (!socket.startsWith('/') || socket.includes('\0') || !/^[a-f0-9]{12,64}$/.test(id))
    throw new Error('Invalid container')
  return ['--host', `unix://${socket}`, 'exec', '-it', id, shell]
}
export async function openContainerShell(id: string, settings: Settings): Promise<Result<null>> {
  const socket = resolveDockerSocket(settings.dockerSocketPath)
  if (!socket.socketPath)
    return {
      ok: false,
      error: { code: 'DOCKER_UNAVAILABLE', message: socket.message || 'Docker is unavailable.' }
    }
  const paths = [
    '/opt/homebrew/bin/docker',
    '/usr/local/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker',
    '/Applications/OrbStack.app/Contents/MacOS/xbin/docker'
  ]
  let executable: string | undefined
  for (const candidate of paths) {
    try {
      await fs.access(candidate, constants.X_OK)
      executable = candidate
      break
    } catch {
      /* Try next fixed executable. */
    }
  }
  const terminals = detectApplications().filter((item) => item.kind === 'terminal')
  const terminal =
    terminals.find((item) => item.id === settings.preferredTerminal) ||
    terminals.find((item) => item.id === 'terminal')
  try {
    await fs.access('/usr/bin/ruby', constants.X_OK)
  } catch {
    return {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The system Ruby runtime is needed to open an interactive container shell.'
      }
    }
  }
  if (!executable || !terminal)
    return {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Install the Docker CLI and a supported terminal, then try again.'
      }
    }
  let shell: 'bash' | 'sh' = 'sh'
  try {
    await promisify(execFile)(
      executable,
      ['--host', `unix://${socket.socketPath}`, 'exec', id, 'bash', '--version'],
      { timeout: 3000, maxBuffer: 16384 }
    )
    shell = 'bash'
  } catch {
    /* Minimal images usually contain sh only. */
  }
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'devdeck-shell-'))
  try {
    await fs.chmod(directory, 0o700)
    await fs.writeFile(
      path.join(directory, 'arguments.json'),
      JSON.stringify({
        file: executable,
        args: containerShellArguments(socket.socketPath, id, shell)
      }),
      { mode: 0o600 }
    )
    const bridge = path.join(directory, 'Container.command')
    await fs.writeFile(bridge, TERMINAL_BRIDGE, { mode: 0o700 })
    const args =
      terminal.id === 'ghostty'
        ? ['-na', terminal.path, '--args', '-e', '/usr/bin/ruby', bridge]
        : ['-a', terminal.path, bridge]
    await promisify(execFile)('/usr/bin/open', args, { timeout: 5000, maxBuffer: 16384 })
    const cleanup = setTimeout(() => {
      void fs.rm(directory, { recursive: true, force: true }).catch(() => {})
    }, 600000)
    cleanup.unref()
    return { ok: true, data: null }
  } catch {
    await fs.rm(directory, { recursive: true, force: true })
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Could not open the container shell.' }
    }
  }
}
