import { expect, it } from 'vitest'
import { NotificationService } from '../../src/main/services/notifications'
import { DEFAULT_NOTIFICATIONS, type Proc, type Settings } from '../../src/shared/types'

it('deduplicates threshold crossings, suppresses expected stops, and never includes commands', () => {
  const notices: { title: string; body: string }[] = []
  const service = new NotificationService((notice) => notices.push(notice))
  const settings = {
    memoryThresholdMb: 100,
    notifications: { ...DEFAULT_NOTIFICATIONS, memory: true, serverStopped: true }
  } as Settings
  const proc = {
    pid: 123,
    startTime: 'now',
    name: 'Vite',
    project: 'web',
    ports: [3000],
    memMB: 101,
    command: 'node --token SECRET'
  } as Proc
  service.observe([proc], settings)
  service.observe([proc], settings)
  expect(notices).toHaveLength(1)
  service.expectStops([proc])
  service.observe([], settings)
  expect(notices).toHaveLength(1)
  const next = { ...proc, pid: 124, memMB: 1 }
  service.observe([next], settings)
  service.observe([], settings)
  expect(notices).toHaveLength(2)
  expect(JSON.stringify(notices)).not.toContain('SECRET')
})
