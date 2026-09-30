import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { SettingsService, DEFAULT_SETTINGS } from '../../src/main/services/settings'

describe('SettingsService', () => {
  let tempDir: string
  let testFilePath: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devdeck-settings-test-'))
    testFilePath = path.join(tempDir, 'settings.json')
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error
    }
  })

  it('initializes with default settings when file does not exist', () => {
    const service = new SettingsService(testFilePath)
    const settings = service.getSettings()

    expect(settings.refreshIntervalSec).toBe(DEFAULT_SETTINGS.refreshIntervalSec)
    expect(settings.ignoreList).toEqual([])
    expect(settings.customAllowlist).toEqual([])
    expect(settings.theme).toBe('system')
    expect(settings.openAtLogin).toBe(false)
  })

  it('recovers gracefully from corrupt JSON file and returns defaults', () => {
    fs.writeFileSync(testFilePath, '{ invalid json string !!!', 'utf-8')

    const service = new SettingsService(testFilePath)
    const settings = service.getSettings()

    expect(settings.refreshIntervalSec).toBe(3)
    expect(settings.ignoreList).toEqual([])
  })

  it('validates and clamps invalid fields upon loading or updating', () => {
    const invalidData = {
      refreshIntervalSec: 999, // invalid
      ignoreList: ['valid-name', 123, '  ', null], // only clean strings
      customAllowlist: ['custom-node'],
      theme: 'neon-disco', // invalid theme
      openAtLogin: 'yes' // not a boolean
    }
    fs.writeFileSync(testFilePath, JSON.stringify(invalidData), 'utf-8')

    const service = new SettingsService(testFilePath)
    const settings = service.getSettings()

    expect(settings.refreshIntervalSec).toBe(3) // fallback
    expect(settings.ignoreList).toEqual(['valid-name'])
    expect(settings.customAllowlist).toEqual(['custom-node'])
    expect(settings.theme).toBe('system')
    expect(settings.openAtLogin).toBe(false)
  })

  it('updates settings and persists changes to disk', () => {
    const service = new SettingsService(testFilePath)
    const updated = service.updateSettings({
      refreshIntervalSec: 5,
      ignoreList: ['worker.js'],
      theme: 'dark',
      openAtLogin: true,
      dockerSocketPath: '/custom/docker.sock'
    })

    expect(updated.refreshIntervalSec).toBe(5)
    expect(updated.ignoreList).toEqual(['worker.js'])
    expect(updated.theme).toBe('dark')
    expect(updated.openAtLogin).toBe(true)
    expect(updated.dockerSocketPath).toBe('/custom/docker.sock')

    // Verify written file
    const fileContent = JSON.parse(fs.readFileSync(testFilePath, 'utf-8'))
    expect(fileContent.refreshIntervalSec).toBe(5)
    expect(fileContent.theme).toBe('dark')
  })
})
