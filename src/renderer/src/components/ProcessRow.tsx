import React, { useState } from 'react'
import { Proc } from '../../../shared/types'
import { formatUptime } from '../utils/format'

interface ProcessRowProps {
  proc: Proc
  onStop?: (proc: Proc) => void
}

export const ProcessRow: React.FC<ProcessRowProps> = ({ proc, onStop }) => {
  const [expanded, setExpanded] = useState<boolean>(false)
  const [commandRevealed, setCommandRevealed] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)

  const handleCopyCommand = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(proc.command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard write failed
    }
  }

  return (
    <div className={`process-row-container ${expanded ? 'is-expanded' : ''}`}>
      <div
        className="process-row"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
      >
        {/* Column 1: State */}
        <div className="col col-state">
          <span className="status-indicator">
            <span className="status-dot running" aria-hidden="true" />
            <span className="status-text">Running</span>
          </span>
        </div>

        {/* Column 2: Process Name */}
        <div className="col col-name" title={proc.name}>
          <span className="process-name">{proc.name}</span>
        </div>

        {/* Column 3: Ports */}
        <div className="col col-ports">
          {proc.ports && proc.ports.length > 0 ? (
            <div className="port-tags">
              {proc.ports.map((port) => (
                <span key={port} className="port-pill mono">
                  :{port}
                </span>
              ))}
            </div>
          ) : (
            <span className="port-none mono">-</span>
          )}
        </div>

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
          {onStop && (
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
            tabIndex={-1}
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

      {/* Expanded Details Panel */}
      {expanded && (
        <div className="details-panel" role="region" aria-label="Process Details">
          <div className="details-grid mono">
            <div className="detail-item">
              <span className="detail-label">PID</span>
              <span className="detail-value">{proc.pid}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">PPID</span>
              <span className="detail-value">{proc.ppid}</span>
            </div>
            {proc.cwd && (
              <div className="detail-item detail-item-wide">
                <span className="detail-label">PATH</span>
                <span className="detail-value" title={proc.cwd}>
                  {proc.cwd}
                </span>
              </div>
            )}
          </div>

          <div className="detail-command-section">
            <div className="command-header">
              <span className="detail-label mono">COMMAND</span>
              <div className="command-actions">
                <button
                  type="button"
                  className="quiet-btn mono"
                  onClick={() => setCommandRevealed(!commandRevealed)}
                >
                  {commandRevealed ? 'Mask' : 'Reveal'}
                </button>
                <button type="button" className="quiet-btn mono" onClick={handleCopyCommand}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="command-box mono">
              {commandRevealed ? (
                <code>{proc.command}</code>
              ) : (
                <span className="masked-command">••••••••••••••••••••••••••••••••••••••••</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
