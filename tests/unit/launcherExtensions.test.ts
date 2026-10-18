import { it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
it('Alfred search passes argument arrays and unsafe action URLs are refused', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devdeck-extension-')),
    cli = path.join(root, 'fake cli')
  try {
    fs.writeFileSync(
      cli,
      '#!/usr/bin/env node\nconsole.log(JSON.stringify([{pid:123,name:"node",project:"web",ports:[3000]},{pid:456,name:"ruby",project:"api",ports:[]}]))',
      { mode: 0o700 }
    )
    const response = JSON.parse(
      execFileSync(process.execPath, ['extensions/alfred/list.cjs', 'web'], {
        env: { ...process.env, DEVDECK_CLI: cli },
        encoding: 'utf8'
      })
    )
    expect(response.items).toHaveLength(1)
    expect(response.items[0].mods.alt.arg).toBe('stop:123')
    expect(response.items[0].arg).toBe('devdeck://project/web')
    expect(() =>
      execFileSync(process.execPath, ['extensions/alfred/action.cjs', 'file:///tmp/anything'], {
        stdio: 'pipe'
      })
    ).toThrow()
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
