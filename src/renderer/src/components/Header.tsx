import { ExportPanel } from './ExportPanel'
import React, { useEffect, useRef } from 'react'
import { Settings } from '../../../shared/types'

interface HeaderProps {
  activeTab: 'processes' | 'docker' | 'profiles'
  onTabChange: (tab: 'processes' | 'docker' | 'profiles') => void
  searchQuery: string
  onSearchChange: (query: string) => void
  totalCount: number
  projectCount: number
  dockerRunningCount: number
  dockerTotalCount: number
  recentlyStoppedCount?: number
  onOpenRecentlyStopped?: () => void
  settings: Settings
  onIntervalChange: (interval: 2 | 3 | 5 | 10) => void
  onRefresh?: () => void
  onStopAll?: () => void
  onOpenSettings?: () => void
  loading: boolean
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  totalCount,
  projectCount,
  dockerRunningCount,
  dockerTotalCount,
  recentlyStoppedCount,
  onOpenRecentlyStopped,
  settings,
  onIntervalChange,
  onRefresh,
  onStopAll,
  onOpenSettings,
  loading
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Global shortcut '/' to focus search, 'Escape' to clear/blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (
        e.key === '/' &&
        !(
          e.target instanceof HTMLElement &&
          (e.target.matches('input,textarea,select') || e.target.isContentEditable)
        )
      ) {
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

        <div className="header-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'processes' ? 'active' : ''}`}
            onClick={() => onTabChange('processes')}
          >
            Processes
            <span className="tab-badge mono">{totalCount}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'docker' ? 'active' : ''}`}
            onClick={() => onTabChange('docker')}
          >
            Docker
            <span className="tab-badge mono">{dockerRunningCount}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'profiles' ? 'active' : ''}`}
            onClick={() => onTabChange('profiles')}
          >
            Profiles
          </button>
        </div>

        <div className="process-stats mono">
          {activeTab === 'processes' ? (
            <>
              <span>
                {totalCount} {totalCount === 1 ? 'process' : 'processes'}
              </span>
              <span className="stats-divider">/</span>
              <span>
                {projectCount} {projectCount === 1 ? 'project' : 'projects'}
              </span>
            </>
          ) : activeTab === 'profiles' ? (
            <span>Saved stacks</span>
          ) : (
            <>
              <span>{dockerRunningCount} running</span>
              <span className="stats-divider">/</span>
              <span>
                {dockerTotalCount} {dockerTotalCount === 1 ? 'container' : 'containers'}
              </span>
            </>
          )}
        </div>
      </div>

      {activeTab !== 'profiles' && (
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
              placeholder={
                activeTab === 'docker' ? 'Filter containers, ports…' : 'Filter processes, ports…'
              }
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label={activeTab === 'docker' ? 'Filter containers' : 'Filter processes'}
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
      )}

      <div className="header-right">
        {onStopAll && (
          <button
            type="button"
            className="stop-all-btn"
            onClick={onStopAll}
            title="Stop all running dev processes"
          >
            Stop all
          </button>
        )}

        {activeTab !== 'profiles' && (
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
        )}

        {onRefresh && (
          <button
            className={`refresh-btn ${loading ? 'loading' : ''}`}
            onClick={onRefresh}
            aria-label={activeTab === 'docker' ? 'Refresh container list' : 'Refresh process list'}
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
        )}

        <ExportPanel />
        {onOpenRecentlyStopped && (
          <button
            type="button"
            className="btn btn-quiet btn-history"
            onClick={onOpenRecentlyStopped}
            title="View recently stopped dev processes"
            aria-label="Recently stopped processes"
          >
            History
            {recentlyStoppedCount !== undefined && recentlyStoppedCount > 0 && (
              <span className="badge-pill mono">{recentlyStoppedCount}</span>
            )}
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            className="settings-btn"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>
    </header>
  )
}
