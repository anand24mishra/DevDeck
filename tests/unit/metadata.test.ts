import { it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { readMetadata, hasProjectMarker } from '../../src/main/services/metadata'
import { runtimeHints } from '../../src/main/services/runtime'
it('rejects outside symlinks, special files and invalid version text', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devdeck-metadata-'))
  try {
    fs.mkdirSync(path.join(root, 'project'))
    const project = path.join(root, 'project')
    fs.writeFileSync(path.join(root, 'private'), 'TOKEN=synthetic-secret')
    fs.symlinkSync(path.join(root, 'private'), path.join(project, '.nvmrc'))
    expect(await runtimeHints(project)).toEqual([])
    expect(readMetadata(project, '.nvmrc')).toBe('')
    if (process.platform !== 'win32') {
      execFileSync('/usr/bin/mkfifo', [path.join(project, 'package.json')])
      expect(readMetadata(project, 'package.json')).toBe('')
    }
    fs.writeFileSync(path.join(project, 'go.mod'), 'go 1.24')
    expect(hasProjectMarker(project)).toBe(true)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
