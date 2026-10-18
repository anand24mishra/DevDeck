import { it, expect } from 'vitest'
import { parseCommandLine } from '../../src/main/utils/command'
it('preserves empty arguments and treats shell characters as literal argv', () => {
  expect(parseCommandLine('node script.js "" "a b" \'$(touch example)\'', true)).toEqual({
    executable: 'node',
    args: ['script.js', '', 'a b', '$(touch example)']
  })
  expect(() => parseCommandLine('node "unfinished', true)).toThrow()
})
