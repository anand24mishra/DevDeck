import { it, expect } from 'vitest'
import { LogRing, redactLog, ansiSegments, stripAnsi } from '../../src/shared/logs'
it('bounds memory, retains fragmented lines, clears partials and masks recognized secrets', () => {
  const ring = new LogRing()
  ring.append('a')
  ring.append('b\n')
  expect(ring.read()).toEqual(['ab'])
  ring.append(Array.from({ length: 6000 }, (_, i) => `${i}\n`).join(''))
  expect(ring.lines).toHaveLength(5000)
  ring.append('partial')
  ring.clear()
  expect(ring.read()).toEqual([])
  expect(
    redactLog('token=abc password="a space" Bearer xyz https://user:pass@localhost')
  ).not.toMatch(/abc|a space|xyz|user:pass/)
  expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red')
  expect(ansiSegments('\x1b[31mred')[1].color).toBe('var(--danger)')
})
it('masks JSON values and full Basic authorization without exposing credentials', () => {
  expect(redactLog('{"token":"example-secret","password":"has spaces"}')).not.toMatch(
    /example-secret|has spaces/
  )
  expect(redactLog('Authorization: Basic dXNlcjpwYXNz')).not.toContain('dXNlcjpwYXNz')
})
