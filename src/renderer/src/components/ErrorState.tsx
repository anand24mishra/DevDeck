import React from 'react'

interface ErrorStateProps {
  message: string
  onRetry: () => void
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div className="state-container error-state" role="alert">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--danger)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="state-icon"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="state-title">Couldn&rsquo;t list processes</p>
      <p className="state-description mono">{message}</p>
      <button className="state-btn" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}
