import path from 'path'
import { isLocalUrl } from '../../shared/ports'
import { EDITOR_IDS, TERMINAL_IDS } from '../services/applications'
import { validIdentities } from '../services/kill'

export function isExpectedPage(actual: string | undefined, expected: string): boolean {
  return actual !== undefined && actual === expected
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function keys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).sort().join(',') === expected.sort().join(',')
}
function validSettings(value: Record<string, unknown>): boolean {
  return Object.entries(value).every(([key, field]) => {
    switch (key) {
      case 'refreshIntervalSec':
        return [2, 3, 5, 10].includes(field as number)
      case 'preferredEditor':
        return EDITOR_IDS.includes(field as string)
      case 'preferredTerminal':
        return TERMINAL_IDS.includes(field as string)
      case 'theme':
        return ['system', 'light', 'dark'].includes(field as string)
      case 'openAtLogin':
      case 'persistRecentlyStopped':
        return typeof field === 'boolean'
      case 'ignoreList':
      case 'customAllowlist':
        return (
          Array.isArray(field) &&
          field.length <= 200 &&
          field.every(
            (entry) =>
              typeof entry === 'string' &&
              entry.trim().length > 0 &&
              entry.length <= 1024 &&
              !entry.includes('\0')
          )
        )
      case 'dockerSocketPath':
        return (
          field === undefined ||
          (typeof field === 'string' &&
            field.length <= 4096 &&
            !field.includes('\0') &&
            (!field.trim() || path.isAbsolute(field)))
        )
      default:
        return false
    }
  })
}

export function validIpcInput(channel: string, value: unknown): boolean {
  if (
    [
      'project:apps',
      'procs:list',
      'settings:get',
      'recent:list',
      'recent:clear',
      'docker:list',
      'docker:stopAll'
    ].includes(channel)
  ) {
    return value === undefined
  }
  if (!object(value)) return false
  if (['project:openEditor', 'project:openFinder', 'project:openTerminal'].includes(channel))
    return (
      keys(value, ['path']) &&
      typeof value.path === 'string' &&
      value.path.length <= 4096 &&
      path.isAbsolute(value.path) &&
      !value.path.includes('\0')
    )
  if (channel === 'url:open') return keys(value, ['url']) && isLocalUrl(value.url)
  if (channel === 'ports:lookup')
    return (
      keys(value, ['port']) &&
      Number.isInteger(value.port) &&
      Number(value.port) >= 1 &&
      Number(value.port) <= 65535
    )
  if (channel === 'settings:set') return validSettings(value)
  if (['procs:stop', 'procs:stopAll', 'procs:stopProject'].includes(channel)) {
    const expected = channel === 'procs:stopProject' ? ['project', 'targets'] : ['targets']
    return (
      keys(value, expected) &&
      validIdentities(value.targets) &&
      (channel !== 'procs:stopProject' ||
        (typeof value.project === 'string' &&
          value.project.trim().length > 0 &&
          value.project.length <= 4096))
    )
  }
  if (channel === 'recent:restart')
    return (
      keys(value, ['id']) &&
      typeof value.id === 'string' &&
      value.id.length > 0 &&
      value.id.length <= 256
    )
  if (['docker:action', 'docker:logs:start', 'docker:logs:stop'].includes(channel)) {
    return (
      keys(value, channel === 'docker:action' ? ['id', 'action'] : ['id']) &&
      typeof value.id === 'string' &&
      /^[a-f0-9]{12,64}$/.test(value.id) &&
      (channel !== 'docker:action' || ['start', 'stop', 'restart'].includes(value.action as string))
    )
  }
  return false
}
