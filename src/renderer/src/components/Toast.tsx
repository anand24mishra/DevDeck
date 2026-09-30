import React, { useEffect } from 'react'

export interface ToastMessage {
  id: string
  text: string
  type?: 'success' | 'warn' | 'error'
}

interface ToastProps {
  toast: ToastMessage | null
  onDismiss: () => void
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      onDismiss()
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div className={`toast-container toast-${toast.type || 'success'}`} role="status">
      <span className="toast-text mono">{toast.text}</span>
      <button className="toast-close-btn" onClick={onDismiss} aria-label="Close notification">
        ×
      </button>
    </div>
  )
}
