import { it, expect, vi } from 'vitest'
vi.mock('electron', () => ({ Notification: { isSupported: () => false } }))
import { validReservations } from '../../src/shared/ports'
import { NotificationService } from '../../src/main/services/notifications'
import type { Proc, Settings } from '../../src/shared/types'
it('validates unique port reservations and notifies only on a new owner conflict', () => {
  const reservations = [{ port: 3000, project: 'web' }]
  expect(validReservations(reservations)).toBe(true)
  expect(validReservations([...reservations, ...reservations])).toBe(false)
  const send = vi.fn()
  const service = new NotificationService(send)
  const settings = { reservedPorts: reservations, notifications: {} } as Settings
  const owner = {
    pid: 5,
    startTime: 'a',
    name: 'node',
    project: 'api',
    ports: [3000],
    memMB: 0
  } as Proc
  service.observe([owner], settings)
  service.observe([owner], settings)
  expect(send).toHaveBeenCalledTimes(1)
  service.observe([], settings)
  service.observe([owner], settings)
  expect(send).toHaveBeenCalledTimes(2)
})
