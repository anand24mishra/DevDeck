import { useEffect, useState } from 'react'
import type { DockerDesktopApp } from '../../../shared/types'

export function DockerErrorState({
  message,
  code,
  onRetry
}: {
  message: string
  code: string | null
  onRetry: () => void
}): React.JSX.Element {
  const [apps, setApps] = useState<DockerDesktopApp[]>([])
  const [status, setStatus] = useState('')
  useEffect(() => {
    let active = true
    void window.api
      .getDockerApps()
      .then((result) => {
        if (active && result.ok) setApps(result.data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return (
    <section className="state-container error-state" role="alert">
      <h2>
        {code === 'INVALID_INPUT'
          ? 'Check your Docker connection'
          : code === 'DENIED'
            ? 'Docker access is restricted'
            : 'Docker is unavailable'}
      </h2>
      <p>{message}</p>
      <button className="state-btn" onClick={onRetry}>
        Check again
      </button>
      {apps.map((app) => (
        <button
          key={app.id}
          className="quiet-btn"
          onClick={() => {
            void window.api
              .launchDockerApp(app.id)
              .then((result) => {
                if (!result.ok) setStatus(result.error.message)
              })
              .catch(() => setStatus('Could not open this provider. Start it from Applications.'))
          }}
        >
          Start {app.name}
        </button>
      ))}
      {status && <p role="status">{status}</p>}
    </section>
  )
}
