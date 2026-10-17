import { expect, it } from 'vitest'
import { parsePortInput } from '../../src/shared/ports'
import { parseListeners } from '../../src/main/services/ports'
import { validIpcInput } from '../../src/main/security/validate'

it('accepts the supported local port forms and rejects arbitrary hosts or shell text', () => {
  for (const input of ['3000', ':3000', 'localhost:3000', ' 3000 '])
    expect(parsePortInput(input)).toBe(3000)
  for (const input of ['0', '65536', '1.2', 'example.com:3000', '3000; id', ''])
    expect(parsePortInput(input)).toBeNull()
  expect(validIpcInput('ports:lookup', { port: 3000 })).toBe(true)
  expect(validIpcInput('ports:lookup', { port: 3000, extra: true })).toBe(false)
})
it('preserves wildcard and IPv6 bind addresses and ignores established connections', () => {
  const parsed = parseListeners(
    'p123\ncnode\nn127.0.0.1:3000\nn[::1]:3000\nn*:5173\nn127.0.0.1:3000->127.0.0.1:5000\n'
  )
  expect(parsed.get(123)?.map((item) => item.address)).toEqual(['127.0.0.1', '::1', '*'])
})
