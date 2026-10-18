import { expect, it } from 'vitest'
import { detectTunnel } from '../../src/main/services/tunnels'
import { isProcessAllowed } from '../../src/main/security/allowlist'

it('recognizes forwarding commands without allowing ordinary SSH or VPN operations', () => {
  expect(detectTunnel('ssh -N -L 3000:db.internal:5432 host')?.target).toBe('db.internal:5432')
  expect(detectTunnel('ssh -NL3000:db.internal:5432 host')?.kind).toBe('ssh')
  expect(detectTunnel('kubectl port-forward svc/api 3000:80')?.target).toBe('svc/api')
  expect(detectTunnel('tailscale funnel 3000')?.kind).toBe('tailscale')
  expect(isProcessAllowed(123, 'ssh host').allowed).toBe(false)
  expect(isProcessAllowed(123, 'ssh -L3000:db:80 host').allowed).toBe(true)
  expect(isProcessAllowed(123, 'tailscaled --state=test').allowed).toBe(false)
})
it('strips credentials and URL secrets from displayed tunnel targets', () => {
  const tunnel = detectTunnel(
    'cloudflared tunnel --url https://user:secret@localhost:3000/path?token=SECRET'
  )
  expect(tunnel?.target).toBe('https://localhost:3000')
  expect(JSON.stringify(tunnel)).not.toContain('secret')
})
