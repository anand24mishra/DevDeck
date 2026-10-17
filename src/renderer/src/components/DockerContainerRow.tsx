import React from 'react'
import { LocalPortLink } from './LocalPortLink'
import { Container } from '../../../shared/types'

interface DockerContainerRowProps {
  container: Container
  onAction: (id: string, action: 'start' | 'stop' | 'restart') => void
  onRemove: (container: Container) => void
  onViewLogs: (container: Container) => void
  loading: boolean
}

export const DockerContainerRow: React.FC<DockerContainerRowProps> = ({
  container,
  onAction,
  onViewLogs,
  onRemove,
  loading
}) => {
  const isRunning = container.state === 'running'

  return (
    <div className={`process-row container-row state-${container.state}`}>
      {/* State indicator: dot + word */}
      <div className="col-status">
        <span className={`status-dot dot-${container.state}`} aria-hidden="true" />
        <span className="status-label">{container.state}</span>
      </div>

      {/* Container Identity: Name, ID, Image */}
      <div className="col-name">
        <span className="process-name" title={container.name}>
          {container.name}
        </span>
        <span
          className="container-meta mono"
          title={`ID: ${container.id} • Image: ${container.image}`}
        >
          <span className="container-id">{container.id}</span>
          <span className="meta-sep">/</span>
          <span className="container-image">{container.image}</span>
        </span>
      </div>

      {/* Listening / Mapped Ports */}
      <div className="col-ports mono">
        {container.ports.length > 0 ? (
          <div className="ports-list">
            {container.ports.map((port) => (
              <LocalPortLink key={port} port={port} />
            ))}
          </div>
        ) : (
          <span className="no-ports">—</span>
        )}
      </div>

      {/* Uptime / Status */}
      <div className="col-uptime mono" title={container.status}>
        {container.status}
      </div>

      {/* Action buttons */}
      <div className="col-actions">
        <button
          className="btn-action"
          onClick={() => {
            void navigator.clipboard.writeText(container.id).catch(() => {})
          }}
        >
          Copy ID
        </button>
        <button
          className="btn-action btn-danger"
          disabled={loading}
          onClick={() => onRemove(container)}
        >
          Remove
        </button>
        <button
          type="button"
          className="btn-action btn-logs"
          onClick={() => onViewLogs(container)}
          title="View live container logs"
        >
          Logs
        </button>

        {isRunning ? (
          <>
            <button
              type="button"
              className="btn-action btn-restart"
              onClick={() => onAction(container.id, 'restart')}
              disabled={loading}
              title="Restart container"
            >
              Restart
            </button>
            <button
              type="button"
              className="btn-action btn-danger"
              onClick={() => onAction(container.id, 'stop')}
              disabled={loading}
              title="Stop container"
            >
              Stop
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn-action btn-start"
            onClick={() => onAction(container.id, 'start')}
            disabled={loading}
            title="Start container"
          >
            Start
          </button>
        )}
      </div>
    </div>
  )
}
