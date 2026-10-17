import { useEffect, useState } from 'react'
import type { EnvironmentEntry } from '../../../shared/types'

export function EnvironmentViewer({
  pid,
  startTime
}: {
  pid: number
  startTime: string
}): React.JSX.Element {
  const [entries, setEntries] = useState<EnvironmentEntry[] | null>(null)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState('')
  useEffect(() => {
    let active = true
    void window.api
      .getProcessEnvironment(pid, startTime)
      .then((result) => {
        if (!active) return
        if (result.ok) setEntries(result.data)
        else setError(result.error.message)
      })
      .catch(() => {
        if (active) setError('Could not read environment values. Close and reopen to try again.')
      })
    return () => {
      active = false
    }
  }, [pid, startTime])
  return (
    <section aria-label="Process environment">
      <p>Read-only. Values are hidden and kept only while this panel is open.</p>
      {error ? (
        <p role="alert">{error}</p>
      ) : entries === null ? (
        <p role="status">Reading environment…</p>
      ) : entries.length === 0 ? (
        <p>No readable environment values.</p>
      ) : (
        entries.map((entry) => {
          const visible = revealed.has(entry.key),
            value = visible ? entry.value : '••••••••'
          return (
            <div className="detail-item detail-item-wide" key={entry.key}>
              <span className="mono">
                {entry.key}
                {entry.sensitive ? ' · Sensitive' : ''}
              </span>
              <code>{value}</code>
              <button
                className="quiet-btn"
                aria-label={`${visible ? 'Mask' : 'Reveal'} ${entry.key}`}
                onClick={() =>
                  setRevealed((old) => {
                    const next = new Set(old)
                    if (visible) next.delete(entry.key)
                    else next.add(entry.key)
                    return next
                  })
                }
              >
                {visible ? 'Mask' : 'Reveal'}
              </button>
              <button
                className="quiet-btn"
                aria-label={`Copy ${entry.key}`}
                onClick={() => {
                  void navigator.clipboard
                    .writeText(value)
                    .then(() => setStatus(`Copied ${entry.key}${visible ? '' : ' (masked)'}`))
                    .catch(() => setStatus('Could not copy'))
                }}
              >
                Copy
              </button>
            </div>
          )
        })
      )}
      {status && <p role="status">{status}</p>}
    </section>
  )
}
