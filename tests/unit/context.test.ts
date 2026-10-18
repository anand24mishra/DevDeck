import { expect, it } from 'vitest'
import { parseGitHead } from '../../src/main/services/context'

it('reads branch and detached HEAD values but never returns arbitrary file contents', () => {
  expect(parseGitHead('ref: refs/heads/feature/test\n')).toBe('feature/test')
  expect(parseGitHead('a'.repeat(40))).toBe('detached aaaaaaaa')
  expect(parseGitHead('TOKEN=secret')).toBeUndefined()
  expect(parseGitHead('ref: refs/heads/a\nSECRET=value')).toBeUndefined()
})
