import React, { useEffect, useState } from 'react'
import type { ContainerInspection } from '../../../shared/types'
export function ContainerInspector({ id }: { id: string }): React.ReactElement {
  const [data, setData] = useState<ContainerInspection>()
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState<string[]>([])
  useEffect(() => {
    let active = true
    void window.api.inspectContainer(id).then((result) => {
      if (active) {
        if (result.ok) setData(result.data)
        else setError(result.error.message)
      }
    })
    return () => {
      active = false
    }
  }, [id])
  if (error) return <p role="alert">{error}</p>
  if (!data) return <p role="status">Reading container…</p>
  return (
    <section className="process-details" aria-label="Container inspection">
      <p>
        Health: {data.health} · Restarts: {data.restartCount} · Exit code: {data.exitCode} · Out of
        memory: {data.oomKilled ? 'Yes' : 'No'}
      </p>
      <p>Networks: {data.networks.join(', ') || 'None'}</p>
      <p>Mounts: {data.mounts.join('; ') || 'None'}</p>
      <details>
        <summary>Environment</summary>
        {data.environment.map((entry, index) => (
          <div key={index}>
            <code>
              {entry.key}={revealed.includes(entry.key) ? entry.value : '••••••'}
            </code>{' '}
            <button
              className="quiet-btn"
              onClick={() =>
                setRevealed((old) =>
                  old.includes(entry.key)
                    ? old.filter((key) => key !== entry.key)
                    : [...old, entry.key]
                )
              }
            >
              {revealed.includes(entry.key) ? 'Hide' : 'Reveal'} {entry.key}
            </button>
          </div>
        ))}
      </details>
    </section>
  )
}
