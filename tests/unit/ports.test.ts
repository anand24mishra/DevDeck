import { expect, it } from 'vitest'
import { parsePortInput, isLocalUrl } from '../../src/shared/ports'
import { parseListeners, explainPortOwner, parseOpenFiles } from '../../src/main/services/ports'
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

it('opens only explicit local HTTP URLs', () => {
  expect(isLocalUrl('http://localhost:3000')).toBe(true)
  expect(isLocalUrl('http://127.0.0.1:80/')).toBe(true)
  for (const value of [
    'https://localhost:3000',
    'http://localhost.evil:3000',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://user:pass@localhost:3000',
    'http://localhost:3000/path',
    'http://localhost:0'
  ]) {
    expect(isLocalUrl(value)).toBe(false)
    expect(validIpcInput('url:open', { url: value })).toBe(false)
  }
})

it('distinguishes project, other project, tunnels, containers and protected owners', () => {
  const process = {
    pid: 123,
    name: 'node',
    command: 'node server.js',
    project: 'web'
  } as import('../../src/shared/types').Proc
  const owner = { pid: 123, name: 'node', port: 3000, address: '127.0.0.1', process }
  expect(explainPortOwner(owner, [], 'web').kind).toBe('project')
  expect(explainPortOwner(owner, [], 'api').kind).toBe('other-project')
  expect(
    explainPortOwner({ ...owner, process: { ...process, command: 'ssh -L 3000:host:80 host' } }, [])
      .kind
  ).toBe('ssh')
  expect(
    explainPortOwner(
      { ...owner, process: { ...process, command: 'kubectl port-forward pod 3000:80' } },
      []
    ).kind
  ).toBe('kubectl')
  expect(explainPortOwner({ ...owner, process: null }, []).suggestedAction).toBe('none')
  const container = {
    id: 'abc123abc123',
    name: 'web',
    image: 'web:latest',
    state: 'running',
    ports: [3000]
  } as import('../../src/shared/types').Container
  expect(explainPortOwner(owner, [container]).containerId).toBe(container.id)
})

it('batches working directories, listeners and established connection counts by file descriptor', () => {
  const files = parseOpenFiles(
    'p123\ncnode\nu501\nfcwd\ntDIR\nn/Users/test/project\nf10u\ntIPv6\nPTCP\nn[::1]:3000\nTST=LISTEN\nf11u\ntIPv4\nPTCP\nn127.0.0.1:3000->127.0.0.1:54321\nTST=ESTABLISHED\n'
  )
  expect(files.cwds.get(123)).toBe('/Users/test/project')
  expect(files.listeners.get(123)?.[0].address).toBe('::1')
  expect(files.connections.get(123)).toBe(1)
  expect(files.files.get(123)).toBe(2)
})
