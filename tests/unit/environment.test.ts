import { expect, it } from 'vitest'
import { parseEnvironmentOutput, readEnvironment } from '../../src/main/services/environment'

it('classifies secret keys and preserves bounded values without storing them', async () => {
  const entries = parseEnvironmentOutput(
    'node server.js API_KEY=secret PATH=/usr/bin GREETING=hello world',
    'node server.js'
  )
  expect(entries[0]).toEqual({ key: 'API_KEY', value: 'secret', sensitive: true })
  expect(entries[2].value).toBe('hello world')
  const identity = { pid: 123, startTime: 'now', command: 'node server.js' }
  const revalidate = async () => ({ ok: [identity], refused: [] })
  let value = 'first'
  const read = async () => `node server.js TOKEN=${value}`
  expect((await readEnvironment(123, 'now', revalidate, read)).ok).toBe(true)
  value = 'second'
  const result = await readEnvironment(123, 'now', revalidate, read)
  expect(result.ok && result.data[0].value).toBe('second')
})
it('returns no environment after identity substitution during collection', async () => {
  let calls = 0
  const result = await readEnvironment(
    123,
    'old',
    async () => ({
      ok: [{ pid: 123, startTime: calls++ ? 'new' : 'old', command: 'node server.js' }],
      refused: []
    }),
    async () => 'node server.js TOKEN=SECRET'
  )
  expect(result.ok).toBe(false)
  expect(JSON.stringify(result)).not.toContain('SECRET')
})
