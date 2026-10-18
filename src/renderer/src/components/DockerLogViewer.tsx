import { useDialogFocus } from '../hooks/useDialogFocus'
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Container, DockerLogMessage } from '../../../shared/types'

interface DockerLogViewerProps {
  container: Container
  onClose: () => void
}

const MAX_LINES = 2000

// Strip ANSI escape codes for clean text search/copy
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
}

export const DockerLogViewer: React.FC<DockerLogViewerProps> = ({ container, onClose }) => {
  const [lines, setLines] = useState<string[]>([])
  const [filterText, setFilterText] = useState('')
  const [isPaused, setIsPaused] = useState(false)
  const [wrapLines, setWrapLines] = useState(false)
  const [streamError, setStreamError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef, true, onClose)
  const [copied, setCopied] = useState(false)

  const logContainerRef = useRef<HTMLDivElement>(null)
  const filterInputRef = useRef<HTMLInputElement>(null)

  // Start log streaming on mount, stop on unmount
  useEffect(() => {
    if (!window.api?.startContainerLogs) return

    void window.api
      .startContainerLogs(container.id)
      .then((result) => {
        if (!result.ok) setStreamError(result.error.message)
      })
      .catch(() => setStreamError('Could not read logs. Check Docker and reopen this viewer.'))

    const unsubscribe = window.api.onDockerLog?.((msg: DockerLogMessage) => {
      if (msg.id !== container.id) return

      const rawChunks = msg.text.split('\n')
      setLines((prev) => {
        const next = [...prev, ...rawChunks]
        if (next.length > MAX_LINES) {
          return next.slice(next.length - MAX_LINES)
        }
        return next
      })
    })

    return () => {
      unsubscribe?.()
      window.api?.stopContainerLogs?.(container.id)
    }
  }, [container.id])

  // Auto-scroll to bottom when new logs arrive, unless paused
  useEffect(() => {
    if (!isPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [lines, isPaused])

  // Filter lines
  const filteredLines = useMemo(() => {
    if (!filterText.trim()) return lines
    const term = filterText.toLowerCase()
    return lines.filter((line) => stripAnsi(line).toLowerCase().includes(term))
  }, [lines, filterText])

  const handleCopy = useCallback(async () => {
    const textToCopy = filteredLines.map(stripAnsi).join('\n')
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setStreamError('Could not copy logs. Select the output and copy it manually.')
    }
  }, [filteredLines])

  const handleClear = useCallback(() => {
    setLines([])
  }, [])

  return (
    <div
      className="log-viewer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Logs for ${container.name}`}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="log-viewer-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="log-viewer-header">
          <div className="log-header-left">
            <span className={`status-dot dot-${container.state}`} aria-hidden="true" />
            <span className="log-container-name">{container.name}</span>
            <span className="log-container-id mono">{container.id}</span>
            <span className="log-line-count mono">
              {filteredLines.length} {filteredLines.length === 1 ? 'line' : 'lines'}
            </span>
          </div>

          <div className="log-header-right">
            <button
              type="button"
              className="btn-modal-close"
              onClick={onClose}
              title="Close log viewer (Esc)"
              data-dialog-initial
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {streamError && (
          <p role="alert" className="inline-error">
            {streamError}
          </p>
        )}
        {/* Toolbar */}
        <div className="log-viewer-toolbar">
          <div className="log-search-wrapper">
            <input
              ref={filterInputRef}
              type="text"
              className="log-search-input"
              placeholder="Filter logs..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              aria-label="Filter logs"
            />
            {filterText && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setFilterText('')}
                aria-label="Clear filter"
              >
                ×
              </button>
            )}
          </div>

          <div className="log-toolbar-actions">
            <button
              type="button"
              className={`log-btn ${isPaused ? 'active' : ''}`}
              aria-pressed={isPaused}
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
            >
              {isPaused ? 'Follow output' : 'Pause scrolling'}
            </button>

            <button
              type="button"
              className={`log-btn ${wrapLines ? 'active' : ''}`}
              aria-pressed={wrapLines}
              onClick={() => setWrapLines(!wrapLines)}
              title="Toggle line wrapping"
            >
              Wrap
            </button>

            <button
              type="button"
              className="log-btn"
              onClick={handleCopy}
              title="Copy visible logs to clipboard"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>

            <button
              type="button"
              className="log-btn"
              onClick={handleClear}
              title="Clear visible logs"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Log content body */}
        <div
          ref={logContainerRef}
          className={`log-content-area mono ${wrapLines ? 'wrap-lines' : 'no-wrap'}`}
        >
          {filteredLines.length === 0 ? (
            <div className="log-empty-state">
              {lines.length === 0
                ? 'Waiting for container logs...'
                : 'No logs match the current filter.'}
            </div>
          ) : (
            filteredLines.map((line, idx) => (
              <div key={idx} className="log-line">
                <span className="log-line-num">{idx + 1}</span>
                <span className="log-line-text">{stripAnsi(line)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
