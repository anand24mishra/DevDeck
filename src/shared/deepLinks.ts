import type { FocusTarget } from './types'
export function parseDeepLink(input: string): FocusTarget | null {
  if (input.length > 2048) return null
  try {
    const url = new URL(input)
    if (
      url.protocol !== 'devdeck:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !/^\/[^/]+$/.test(url.pathname)
    )
      return null
    const value = decodeURIComponent(url.pathname.slice(1))
    if (url.hostname === 'port' && /^[1-9]\d{0,4}$/.test(value) && Number(value) <= 65535)
      return { port: Number(value) }
    if (
      url.hostname === 'project' &&
      value.trim() &&
      value.length <= 120 &&
      ![...value].some(
        (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || c === '/' || c === '\\'
      )
    )
      return { project: value }
    return null
  } catch {
    return null
  }
}
