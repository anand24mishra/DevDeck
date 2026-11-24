import React, { useEffect, useState } from 'react'
import type { ReservedPortStatus } from '../../../shared/types'
export function ReservedPorts(): React.ReactElement | null {
  const [ports, setPorts] = useState<ReservedPortStatus[]>([])
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState<number | null>(null)
  const read = (): void => {
    void window.api.reservedPortStatus().then((r) => {
      if (r.ok) setPorts(r.data)
      else setError(r.error.message)
    })
  }
  useEffect(() => {
    read()
    const timer = setInterval(() => {
      if (!document.hidden) read()
    }, 3000)
    window.addEventListener('devdeck:reserved-changed', read)
    return () => {
      clearInterval(timer)
      window.removeEventListener('devdeck:reserved-changed', read)
    }
  }, [])
  if (!ports.length && !error) return null
  return (
    <section className="port-lookup" aria-label="Reserved ports">
      {ports.map((p) => (
        <span key={p.port}>
          <button
            className="quiet-btn"
            aria-label={
              confirming === p.port
                ? `Confirm: stop reserving port ${p.port}`
                : `Unreserve port ${p.port}`
            }
            onClick={() => {
              if (confirming !== p.port) {
                setConfirming(p.port)
                return
              }
              setConfirming(null)
              void window.api.unreservePort(p.port).then(read)
            }}
            onBlur={() => setConfirming((c) => (c === p.port ? null : c))}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" />
            </svg>
            {confirming === p.port && <span> Stop reserving?</span>}
          </button>
          <span className="mono">{p.port}</span>{' '}
          {p.owners.length ? `${p.conflict ? 'Conflict: ' : ''}${p.owners.join(', ')}` : 'is free'}{' '}
          · {p.project}{' '}
        </span>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
