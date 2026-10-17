import { expect, it } from 'vitest'
import { applicationInvocation, verifyProjectPath } from '../../src/main/services/applications'
import fs from 'fs'
import os from 'os'
import path from 'path'

it('preserves spaces and shell syntax as literal path arguments', () => {
  const root = '/Users/test/a project; $(touch evil) "quoted"'
  expect(
    applicationInvocation(
      { id: 'vscode', name: 'Code', path: '/Applications/Visual Studio Code.app', kind: 'editor' },
      root
    ).args
  ).toEqual(['-a', '/Applications/Visual Studio Code.app', root])
  const warp = applicationInvocation(
    { id: 'warp', name: 'Warp', path: '/Applications/Warp.app', kind: 'terminal' },
    root
  )
  expect(new URL(warp.args[2]).searchParams.get('path')).toBe(root)
})
it('opens only an active real project root, rejecting substituted and missing folders', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devdeck-project-'))
  try {
    expect(verifyProjectPath(root, [root])).toBeNull()
    fs.writeFileSync(path.join(root, 'package.json'), '{}')
    expect(verifyProjectPath(root, [root])).toBe(fs.realpathSync(root))
    expect(verifyProjectPath(root, [])).toBeNull()
    expect(verifyProjectPath('/System', [root])).toBeNull()
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
