import { EnvironmentViewer } from './EnvironmentViewer'
import { useEffect, useState } from 'react'
import type { Proc, ProcessDetails } from '../../../shared/types'
import { isNetworkExposed } from '../../../shared/ports'

function CopyField({ name, value }: { name: string; value: string }): React.JSX.Element {
  const [status, setStatus] = useState('')
  return (
    <div className="detail-item detail-item-wide">
      <span className="detail-label">{name}</span>
      <span className="detail-value mono">{value}</span>
      <button
        className="quiet-btn"
        aria-label={`Copy ${name}`}
        onClick={() => {
          void navigator.clipboard
            .writeText(value)
            .then(() => setStatus('Copied'))
            .catch(() => setStatus('Could not copy'))
        }}
      >
        Copy
      </button>
      {status && <span role="status">{status}</span>}
    </div>
  )
}
export function ProcessDetailsPanel({ proc }: { proc: Proc }): React.JSX.Element {
  const [details, setDetails] = useState<ProcessDetails | null>(null)
  const [actionStatus, setActionStatus] = useState('')
  const [error, setError] = useState('')
  const [showEnvironment, setShowEnvironment] = useState(false)
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    if (proc.manageable === false) return
    let active = true
    void window.api
      .getProcessDetails(proc.pid, proc.startTime)
      .then((result) => {
        if (!active) return
        if (result.ok) setDetails(result.data)
        else setError(result.error.message)
      })
      .catch(() => {
        if (active) setError('Could not read details. Close and reopen this panel to try again.')
      })
    return () => {
      active = false
    }
  }, [proc.pid, proc.startTime, proc.manageable])
  if (proc.manageable === false)
    return (
      <section className="details-panel" aria-label="Read-only process details">
        <p>{proc.readOnlyReason || 'DevDeck cannot manage this process.'}</p>
        <p>
          Only its visible listening addresses are shown. Arguments and environment are not
          collected.
        </p>
      </section>
    )
  if (error)
    return (
      <div className="details-panel" role="alert">
        {error}
      </div>
    )
  if (!details)
    return (
      <div className="details-panel" role="status">
        Checking process details…
      </div>
    )
  const current = details.process
  const sockets = [
    ...new Map(
      (current.sockets || []).map((socket) => [
        `${socket.address}:${socket.port}:${socket.protocol}:${socket.state}`,
        socket
      ])
    ).values()
  ]
  return (
    <section className="details-panel" aria-label="Process details">
      <div className="process-tools">
        {(['pause', 'resume', 'reload', 'group'] as const).map((action) => (
          <button
            className="quiet-btn"
            key={action}
            onClick={() => {
              void window.api
                .signalProcess(action, {
                  pid: current.pid,
                  startTime: current.startTime,
                  command: current.command
                })
                .then((result) =>
                  setActionStatus(
                    result.ok
                      ? result.data.cancelled
                        ? 'Cancelled'
                        : `${result.data.signaled?.length || result.data.stopped.length} updated; ${result.data.refused.length} skipped; ${result.data.stillRunning.length} still running`
                      : result.error.message
                  )
                )
                .catch(() => setActionStatus('Could not apply this action. Refresh and try again.'))
            }}
          >
            {action === 'group' ? 'Stop process group' : action[0].toUpperCase() + action.slice(1)}
          </button>
        ))}
      </div>
      {actionStatus && <p role="status">{actionStatus}</p>}
      {current.idleHint && <p>{current.idleHint}. This is a hint, never an automatic stop.</p>}
      {sockets.some((socket) => socket.state === 'LISTEN' && isNetworkExposed(socket.address)) && (
        <section aria-label="Network visibility guide">
          <p>
            This server accepts connections beyond this Mac. Bind to 127.0.0.1 or ::1 if only local
            access is needed. Your firewall also affects reachability.
          </p>
        </section>
      )}
      {(details.runtime || []).map((runtime) => (
        <p className="mono" key={runtime}>
          {runtime}
        </p>
      ))}
      {current.tunnel && (
        <p>
          Tunnel: {current.tunnel.kind}
          {current.tunnel.target ? ` → ${current.tunnel.target}` : ''}
        </p>
      )}
      <div className="details-grid">
        <CopyField name="Process ID" value={String(current.pid)} />
        <CopyField name="User" value={details.user} />
        <CopyField name="Started" value={current.startTime} />
        <CopyField name="Parent" value={`${current.ppid} · ${details.parentName}`} />
        <CopyField name="Working directory" value={current.cwd || 'Unavailable'} />
        <CopyField name="Open files" value={String(current.openFilesCount || 0)} />
        <CopyField name="Active connections" value={String(current.establishedConnections || 0)} />
        {sockets.map((socket) => (
          <CopyField
            key={`${socket.address}:${socket.port}:${socket.protocol}:${socket.state}`}
            name={`${socket.protocol} ${socket.family} ${socket.state}`}
            value={`${socket.address}:${socket.port}`}
          />
        ))}
        <CopyField name="Command" value={revealed ? current.command : '••••••••'} />
      </div>
      <button className="quiet-btn" aria-pressed={revealed} onClick={() => setRevealed(!revealed)}>
        {revealed ? 'Mask command' : 'Reveal command'}
      </button>
      {details.canViewEnvironment && (
        <button className="quiet-btn" onClick={() => setShowEnvironment(!showEnvironment)}>
          {showEnvironment ? 'Close environment' : 'Show environment'}
        </button>
      )}
      {showEnvironment && details.canViewEnvironment && (
        <EnvironmentViewer pid={current.pid} startTime={current.startTime} />
      )}
    </section>
  )
}
