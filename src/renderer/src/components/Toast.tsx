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

const MAX_QUEUED = 3

export const Toast: React.FC<ToastProps> = ({ toast: incoming, onDismiss }) => {
  // Queue incoming toasts so a new message never replaces one that is still showing (e.g. Undo).
  const [queue, setQueue] = useState<ToastMessage[]>([])
  const [seen, setSeen] = useState<ToastMessage | null>(null)
  if (incoming !== seen) {
    setSeen(incoming)
    if (incoming) setQueue((q) => [...q, incoming].slice(-MAX_QUEUED))
  }
  const toast = queue[0] ?? null
  const showNext = (): void => {
    if (queue.length <= 1) onDismiss()
    setQueue((q) => q.slice(1))
  }
  const dismiss = useRef(showNext)
  const root = useRef<HTMLDivElement>(null),
    previousFocus = useRef<HTMLElement | null>(null)
  const [focused, setFocused] = useState(false),
    [expiredId, setExpiredId] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    dismiss.current = showNext
  })
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
      role={toast.type === 'error' ? 'alert' : 'status'}
    >
      <span className="toast-text">{toast.text}</span>
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
          showNext()
        }}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  )
}
