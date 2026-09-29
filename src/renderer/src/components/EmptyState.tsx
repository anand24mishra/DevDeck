import React from 'react'

interface EmptyStateProps {
  searchQuery?: string
  onClearSearch?: () => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({ searchQuery, onClearSearch }) => {
  if (searchQuery) {
    return (
      <div className="state-container empty-search-state">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="state-icon"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <p className="state-title">No processes matching &ldquo;{searchQuery}&rdquo;</p>
        <p className="state-description">Check for typos in process name, port, or project name.</p>
        {onClearSearch && (
          <button className="state-btn" onClick={onClearSearch}>
            Clear search
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="state-container empty-system-state">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="state-icon"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
      <p className="state-title">Nothing running for your projects</p>
      <p className="state-description">
        Start a dev server (e.g. Node, Vite, Python, Go) or background service, and it will appear
        here automatically.
      </p>
    </div>
  )
}
