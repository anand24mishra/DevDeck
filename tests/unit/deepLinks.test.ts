import { it, expect } from 'vitest'
import { parseDeepLink } from '../../src/shared/deepLinks'
it('permits focus targets only and rejects actions or hidden payloads', () => {
  expect(parseDeepLink('devdeck://port/3000')).toEqual({ port: 3000 })
  expect(parseDeepLink('devdeck://project/my%20app')).toEqual({ project: 'my app' })
  for (const input of [
    'devdeck://stop/3000',
    'devdeck://port/0',
    'devdeck://port/65536',
    'devdeck://port/3000?stop=true',
    'devdeck://user@project/web',
    'devdeck://project/%00',
    'devdeck://project/a/b',
    'https://port/3000'
  ])
    expect(parseDeepLink(input)).toBeNull()
})
