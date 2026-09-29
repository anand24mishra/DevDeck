import { describe, it, expect } from 'vitest'
import { parseEtime } from '../../src/main/providers/process.darwin'
import { formatUptime } from '../../src/renderer/src/utils/format'

describe('etime and uptime parsers', () => {
  it('parses mm:ss format into seconds', () => {
    expect(parseEtime('00:45')).toBe(45)
    expect(parseEtime('12:30')).toBe(750)
  })

  it('parses hh:mm:ss format into seconds', () => {
    expect(parseEtime('01:10:05')).toBe(3600 + 600 + 5)
    expect(parseEtime('04:00:00')).toBe(14400)
  })

  it('parses dd-hh:mm:ss format into seconds', () => {
    expect(parseEtime('02-05:10:20')).toBe(2 * 86400 + 5 * 3600 + 10 * 60 + 20)
  })

  it('handles empty or invalid inputs gracefully', () => {
    expect(parseEtime('')).toBe(0)
    expect(parseEtime('   ')).toBe(0)
  })

  it('formats uptime seconds into plain human strings', () => {
    expect(formatUptime(45)).toBe('45s')
    expect(formatUptime(130)).toBe('2m')
    expect(formatUptime(3665)).toBe('1h 1m')
    expect(formatUptime(90000)).toBe('1d 1h')
  })
})
