import React, { useEffect, useRef } from 'react'
import { Settings } from '../../../shared/types'

interface HeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  totalCount: number
  projectCount: number
  settings: Settings
  onIntervalChange: (interval: 2 | 3 | 5 | 10) => void
  onRefresh: () => void
  onStopAll?: () => void
  loading: boolean
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  totalCount,
  projectCount,
  settings,
  onIntervalChange,
  onRefresh,
  onStopAll,
  loading
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Global shortcut '/' to focus search, 'Escape' to clear/blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        onSearchChange('')
        searchInputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSearchChange])

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="brand">
          <span className="brand-name">DevDeck</span>
          <span className="brand-badge">macOS</span>
        </div>

        <div className="process-stats mono">
          <span>
            {totalCount} {totalCount === 1 ? 'process' : 'processes'}
          </span>
          <span className="stats-divider">/</span>
          <span>
            {projectCount} {projectCount === 1 ? 'project' : 'projects'}
          </span>
        </div>
      </div>

      <div className="header-center">
        <div className="search-wrapper">
          <svg
            className="search-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Filter processes, ports, projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Filter processes"
          />
          {searchQuery ? (
            <button
              className="clear-search-btn"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              ×
            </button>
          ) : (
            <kbd className="search-shortcut" title="Press / to search">
              /
            </kbd>
          )}
        </div>
      </div>

      <div className="header-right">
        {onStopAll && totalCount > 0 && (
          <button
            type="button"
            className="stop-all-btn"
            onClick={onStopAll}
            title="Stop all running dev processes"
          >
            Stop all
          </button>
        )}

        <div className="refresh-control">
          <label htmlFor="refresh-select" className="refresh-label">
            Poll:
          </label>
          <select
            id="refresh-select"
            className="refresh-select mono"
            value={settings.refreshIntervalSec}
            onChange={(e) => onIntervalChange(Number(e.target.value) as 2 | 3 | 5 | 10)}
            aria-label="Auto-refresh interval"
          >
            <option value={2}>2s</option>
            <option value={3}>3s</option>
            <option value={5}>5s</option>
            <option value={10}>10s</option>
          </select>
        </div>

        <button
          className={`refresh-btn ${loading ? 'loading' : ''}`}
          onClick={onRefresh}
          aria-label="Refresh process list"
          title="Refresh now"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
        </button>
      </div>
    </header>
  )
}
