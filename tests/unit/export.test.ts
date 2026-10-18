import { it, expect } from 'vitest'
import { exportPreview } from '../../src/shared/export'
import type { Proc, Container } from '../../src/shared/types'
it('whitelists export fields and never serializes command, env, cwd or mounts', () => {
  const proc = {
    pid: 12,
    name: 'node',
    project: 'web',
    ports: [3000],
    cpu: 1,
    memMB: 20,
    command: 'node --token=synthetic-secret',
    cwd: '/private/path',
    environment: { TOKEN: 'synthetic-secret' }
  } as unknown as Proc
  const container = {
    id: 'abcdef123456',
    name: 'db',
    state: 'running',
    ports: [],
    environment: ['SECRET=synthetic-secret'],
    mounts: ['/private/path']
  } as unknown as Container
  const diagnostics = {
    appVersion: '1',
    electronVersion: '39',
    macOS: '25',
    architecture: 'arm64',
    dockerProvider: 'Colima',
    processCount: 1,
    containerCount: 1
  }
  for (const kind of ['snapshot', 'diagnostics'] as const)
    for (const format of ['json', 'text'] as const) {
      const text = exportPreview(kind, format, [proc], [container], diagnostics)
      expect(text).not.toContain('synthetic-secret')
      expect(text).not.toContain('/private/path')
      if (kind === 'snapshot' && format === 'json')
        expect(JSON.parse(text).processes[0].command).toBe('[hidden]')
    }
})
