import React, { useEffect, useRef, useState } from 'react'

export interface ToastMessage {
  id: string
  text: string
  type?: 'success' | 'warn' | 'error'
  expiresAt?: number
  action?: { label: string; run: () => Promise<void> }
}

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const dismiss = useRef(onDismiss)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    dismiss.current = onDismiss
  }, [onDismiss])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(
      () => {
        dismiss.current()
      },
      toast.expiresAt ? Math.max(0, toast.expiresAt - Date.now()) : 4000
    )
    return () => clearTimeout(timer)
  }, [toast])

  if (!toast) return null

  return (
    <div className={`toast-container toast-${toast.type || 'success'}`} role="status">
      <span className="toast-text mono">{toast.text}</span>
      {toast.action && (
        <button
          className="quiet-btn"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void toast.action!.run().finally(() => setBusy(false))
          }}
        >
          {busy ? 'Restarting…' : toast.action.label}
        </button>
      )}
      <button className="toast-close-btn" onClick={onDismiss} aria-label="Close notification">
        ×
      </button>
    </div>
  )
}
