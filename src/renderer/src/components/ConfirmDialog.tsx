import React, { useEffect, useRef } from 'react'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  description?: string
  targetList?: string[]
  confirmLabel?: string
  isBusy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  targetList = [],
  confirmLabel = 'Stop',
  isBusy = false,
  onConfirm,
  onCancel
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    // Focus Cancel button by default on open (safe by default)
    cancelBtnRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  // Format up to 8 targets, e.g., "node, vite, python3 and 2 more"
  const formattedTargets = (): string | null => {
    if (targetList.length === 0) return null
    const maxVisible = 8
    const visible = targetList.slice(0, maxVisible)
    const overflow = targetList.length - maxVisible
    if (overflow > 0) {
      return `${visible.join(', ')} and ${overflow} more`
    }
    return visible.join(', ')
  }

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="dialog-title" className="modal-title">
            {title}
          </h2>
        </div>

        <div className="modal-body">
          {description && <p className="modal-description">{description}</p>}
          {targetList.length > 0 && (
            <div className="modal-targets mono">
              <span className="targets-label">Targets:</span> {formattedTargets()}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="dialog-btn dialog-cancel-btn"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className="dialog-btn dialog-danger-btn"
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? 'Stopping...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
