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
  const root = useRef<HTMLDivElement>(null),
    previousFocus = useRef<HTMLElement | null>(null)
  const [focused, setFocused] = useState(false),
    [expiredId, setExpiredId] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    dismiss.current = onDismiss
  }, [onDismiss])
  useEffect(() => {
    if (!toast) return
    if (!root.current?.contains(document.activeElement))
      previousFocus.current = document.activeElement as HTMLElement
    const timer = setTimeout(
      () => {
        setExpiredId(toast.id)
        if (!busy && !focused) dismiss.current()
      },
      toast.expiresAt ? Math.max(0, toast.expiresAt - Date.now()) : 4000
    )
    return () => clearTimeout(timer)
  }, [toast, busy, focused])

  if (!toast) return null

  return (
    <div
      ref={root}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false)
      }}
      className={`toast-container toast-${toast.type || 'success'}`}
      role="status"
    >
      <span className="toast-text mono">{toast.text}</span>
      {toast.action && (
        <button
          className="quiet-btn"
          disabled={busy}
          aria-disabled={expiredId === toast.id}
          onClick={() => {
            if (expiredId === toast.id) return
            setBusy(true)
            void toast.action!.run().finally(() => setBusy(false))
          }}
        >
          {busy ? 'Restarting…' : expiredId === toast.id ? 'Undo expired' : toast.action.label}
        </button>
      )}
      <button
        className="toast-close-btn"
        onClick={() => {
          if (root.current?.contains(document.activeElement)) {
            if (previousFocus.current?.isConnected) previousFocus.current.focus()
            else document.querySelector<HTMLElement>('main')?.focus()
          }
          onDismiss()
        }}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  )
}
