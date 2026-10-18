import React, { useEffect, useState } from 'react'
import type { ReservedPortStatus } from '../../../shared/types'
export function ReservedPorts(): React.ReactElement | null {
  const [ports, setPorts] = useState<ReservedPortStatus[]>([])
  const [error, setError] = useState('')
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
    return () => clearInterval(timer)
  }, [])
  if (!ports.length && !error) return null
  return (
    <section className="port-lookup" aria-label="Reserved ports">
      {ports.map((p) => (
        <span key={p.port}>
          <button
            className="quiet-btn"
            aria-label={`Unreserve port ${p.port}`}
            onClick={() => {
              void window.api.unreservePort(p.port).then(read)
            }}
          >
            ★
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
