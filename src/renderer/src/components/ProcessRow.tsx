import { isNetworkExposed } from '../../../shared/ports'
import React, { useState } from 'react'
import { ProcessDetailsPanel } from './ProcessDetailsPanel'
import { LocalPortLink } from './LocalPortLink'
import { Proc } from '../../../shared/types'
import { formatUptime } from '../utils/format'

interface ProcessRowProps {
  proc: Proc
  onStop?: (proc: Proc) => void
}

export const ProcessRow: React.FC<ProcessRowProps> = ({ proc, onStop }) => {
  const exposed = proc.sockets?.some(
    (socket) => socket.state !== 'ESTABLISHED' && isNetworkExposed(socket.address)
  )
  const [expanded, setExpanded] = useState<boolean>(false)
  return (
    <div
      data-process-id={proc.pid}
      className={`process-row-container ${expanded ? 'is-expanded' : ''}`}
    >
      <div
        className="process-row"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Delete' && onStop && proc.manageable !== false) {
            e.preventDefault()
            onStop(proc)
            return
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const rows = [
              ...document.querySelectorAll<HTMLElement>('.app-content .process-row[role="button"]')
            ]
            const index = rows.indexOf(e.currentTarget)
            const next = rows[index + (e.key === 'ArrowDown' ? 1 : -1)]
            next?.focus()
            next?.scrollIntoView({ block: 'nearest' })
            return
          }

          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
      >
        {/* Column 1: State */}
        <div className="col col-state">
          <span className="status-indicator">
            <span className="status-dot running" aria-hidden="true" />
            <span className="status-text">
              {proc.manageable === false && proc.status !== 'zombie'
                ? 'Read-only'
                : proc.status === 'paused'
                  ? 'Paused'
                  : proc.status === 'zombie'
                    ? 'Waiting for cleanup'
                    : 'Running'}
            </span>
          </span>
        </div>

        {/* Column 2: Process Name */}
        <div className="col col-name" title={proc.name}>
          <span className="process-name">
            {proc.name}
            {proc.leftoverReason && <span title={proc.leftoverReason}> · Possibly leftover</span>}
            {proc.idleHint && <span title={proc.idleHint}> · Possibly idle</span>}
          </span>
        </div>

        {/* Column 3: Ports */}
        <div className="col col-ports">
          {proc.ports && proc.ports.length > 0 ? (
            <div className="port-tags">
              {proc.ports.map((port) =>
                proc.sockets?.some((socket) => socket.port === port && socket.protocol === 'UDP') &&
                !proc.sockets?.some(
                  (socket) => socket.port === port && socket.protocol === 'TCP'
                ) ? (
                  <span key={port} className="mono">
                    UDP :{port}
                  </span>
                ) : (
                  <LocalPortLink key={port} port={port} />
                )
              )}
            </div>
          ) : (
            <span className="port-none mono">-</span>
          )}
        </div>

        {exposed && (
          <button
            className="quiet-btn"
            onClick={(event) => {
              event.stopPropagation()
              setExpanded(true)
            }}
            aria-label={`Read network visibility guide for ${proc.name}`}
          >
            Visible on your network
          </button>
        )}
        {/* Column 4: CPU */}
        <div className="col col-cpu mono">
          <span>{proc.cpu.toFixed(1)}%</span>
        </div>

        {/* Column 5: Memory */}
        <div className="col col-mem mono">
          <span>{proc.memMB} MB</span>
        </div>

        {/* Column 6: Uptime */}
        <div className="col col-uptime mono">
          <span>{formatUptime(proc.uptimeSec)}</span>
        </div>

        {/* Column 7: Actions & Disclosure */}
        <div className="col col-action">
          {onStop && proc.manageable !== false && (
            <button
              type="button"
              className="row-stop-btn"
              title={`Stop ${proc.name} (PID ${proc.pid})`}
              onClick={(e) => {
                e.stopPropagation()
                onStop(proc)
              }}
            >
              Stop
            </button>
          )}
          <button
            className="details-toggle-btn"
            aria-label={expanded ? 'Hide process details' : 'Show process details'}
            tabIndex={0}
          >
            <svg
              className={`chevron-icon ${expanded ? 'rotated' : ''}`}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && <ProcessDetailsPanel key={`${proc.pid}:${proc.startTime}`} proc={proc} />}
    </div>
  )
}
