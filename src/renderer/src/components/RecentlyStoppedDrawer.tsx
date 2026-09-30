import React, { useState, useEffect, useCallback } from 'react'
import { RecentlyStoppedItem } from '../../../shared/types'

interface RecentlyStoppedDrawerProps {
  isOpen: boolean
  items: RecentlyStoppedItem[]
  loading: boolean
  restartingId: string | null
  onClose: () => void
  onRestart: (id: string) => Promise<void>
  onClear: () => Promise<void>
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  return `${diffHours}h ago`
}

export const RecentlyStoppedDrawer: React.FC<RecentlyStoppedDrawerProps> = ({
  isOpen,
  items,
  loading,
  restartingId,
  onClose,
  onRestart,
  onClear
}) => {
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const toggleReveal = useCallback((id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-content drawer-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recently-stopped-title"
      >
        <div className="modal-header">
          <div>
            <div className="header-title-row">
              <h2 id="recently-stopped-title" className="modal-title">
                Recently Stopped
              </h2>
              <span className="badge">{items.length}</span>
            </div>
            <p className="modal-description">
              Bring stopped processes back in one click. Arguments are masked by default to protect
              secrets.
            </p>
          </div>
          <div className="header-actions">
            {items.length > 0 && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={onClear}
                title="Clear recently stopped processes"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="btn btn-quiet btn-close"
              onClick={onClose}
              aria-label="Close recently stopped drawer"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="drawer-body">
          {loading ? (
            <div className="drawer-empty-state">
              <span className="text-muted">Loading stopped processes...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="drawer-empty-state">
              <p className="empty-title">No stopped processes</p>
              <p className="empty-desc text-muted">
                Processes you stop during this session will appear here for easy restarting.
              </p>
            </div>
          ) : (
            <div className="recently-stopped-list">
              {items.map((item) => {
                const isRevealed = revealedIds.has(item.id)
                const isRestarting = restartingId === item.id

                return (
                  <div key={item.id} className="recently-stopped-item">
                    <div className="stopped-item-main">
                      <div className="stopped-item-header">
                        <span className="stopped-proc-name">{item.name}</span>
                        <span className="stopped-project-tag">{item.project}</span>
                        <span className="stopped-time text-muted">
                          {formatRelativeTime(item.stoppedAt)}
                        </span>
                      </div>

                      <div className="stopped-command-box">
                        <span className="stopped-cmd-mono">{item.command.split(/\s+/)[0]}</span>
                        {item.args && item.args.length > 0 && (
                          <span className="stopped-args-box">
                            {isRevealed ? (
                              <span className="stopped-args-revealed"> {item.args.join(' ')}</span>
                            ) : (
                              <span className="stopped-args-masked"> ••••••••</span>
                            )}
                            <button
                              type="button"
                              className="btn-link-reveal"
                              onClick={() => toggleReveal(item.id)}
                            >
                              {isRevealed ? 'Hide' : 'Reveal'}
                            </button>
                          </span>
                        )}
                      </div>

                      {item.cwd && (
                        <div className="stopped-cwd text-muted">
                          in <span className="cwd-path">{item.cwd}</span>
                        </div>
                      )}
                    </div>

                    <div className="stopped-item-action">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isRestarting}
                        onClick={() => onRestart(item.id)}
                      >
                        {isRestarting ? 'Starting...' : 'Restart'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
