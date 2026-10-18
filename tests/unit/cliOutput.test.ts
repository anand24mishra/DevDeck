import { it, expect } from 'vitest'
import { createRequire } from 'module'
const { cleanTerminal } = createRequire(import.meta.url)('../../cli/devdeck.cjs')
it('never emits terminal clipboard or cursor controls from logs and names', () => {
  expect(cleanTerminal('\x1b]52;c;payload\x07hello\x1b[2J\x1b[31mred\x1b[0m')).toBe('hellored')
  expect(cleanTerminal('normal\ttext\nnext')).toBe('normal\ttext\nnext')
})
