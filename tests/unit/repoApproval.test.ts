import { it, expect, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
const harness = vi.hoisted(() => ({
  settings: { profiles: [], approvedRepoConfigs: {}, ignoreList: [], customAllowlist: [] },
  dialog: vi.fn()
}))
vi.mock('electron', () => ({ dialog: { showMessageBox: harness.dialog } }))
vi.mock('../../src/main/services/settings', () => ({
  settingsService: {
    getSettings: () => harness.settings,
    updateSettings: (patch) => Object.assign(harness.settings, patch)
  }
}))
import {
  repoConfigRequest,
  repoApprovalCurrent,
  readRepoProfile
} from '../../src/main/services/repoConfig'
it('never approves Cancel or a changed file, and invalidates approval after edits', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'devdeck-approval-')),
    root = await fs.realpath(temporary)
  const file = path.join(root, '.devdeck.json'),
    config = {
      version: 1,
      name: 'Web',
      expectedPorts: [3000],
      start: [{ name: 'Web', command: 'node web.js' }]
    }
  try {
    await fs.writeFile(file, JSON.stringify(config))
    harness.dialog.mockResolvedValueOnce({ response: 0 })
    await repoConfigRequest(root, true)
    expect(harness.settings.profiles).toEqual([])
    harness.dialog.mockImplementationOnce(async () => {
      await fs.writeFile(file, JSON.stringify({ ...config, name: 'Changed' }))
      return { response: 1 }
    })
    expect((await repoConfigRequest(root, true)).ok).toBe(false)
    expect(harness.settings.profiles).toEqual([])
    harness.dialog.mockResolvedValueOnce({ response: 1 })
    expect((await repoConfigRequest(root, true)).ok).toBe(true)
    const approved = await readRepoProfile(root)
    expect(await repoApprovalCurrent(approved)).toBe(true)
    expect(
      await repoApprovalCurrent({
        ...approved,
        members: [{ ...approved.members[0], command: 'node altered.js' }]
      })
    ).toBe(false)
    await fs.writeFile(file, JSON.stringify(config))
    expect(await repoApprovalCurrent(approved)).toBe(false)
  } finally {
    await fs.rm(temporary, { recursive: true, force: true })
  }
})
