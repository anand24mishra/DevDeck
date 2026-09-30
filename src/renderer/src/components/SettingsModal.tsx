import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Settings } from '../../../shared/types'

interface SettingsModalProps {
  isOpen: boolean
  settings: Settings
  onClose: () => void
  onUpdate: (partial: Partial<Settings>) => Promise<void>
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onUpdate
}) => {
  const [newIgnoreItem, setNewIgnoreItem] = useState('')
  const [newAllowItem, setNewAllowItem] = useState('')
  const [saveIndicator, setSaveIndicator] = useState(false)

  const ignoreInputRef = useRef<HTMLInputElement>(null)
  const allowInputRef = useRef<HTMLInputElement>(null)

  // Esc key closes modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const triggerSave = useCallback(
    async (partial: Partial<Settings>) => {
      await onUpdate(partial)
      setSaveIndicator(true)
      setTimeout(() => setSaveIndicator(false), 1200)
    },
    [onUpdate]
  )

  const handleAddIgnore = (e: React.FormEvent): void => {
    e.preventDefault()
    const val = newIgnoreItem.trim().toLowerCase()
    if (!val || settings.ignoreList.includes(val)) return
    triggerSave({ ignoreList: [...settings.ignoreList, val] })
    setNewIgnoreItem('')
  }

  const handleRemoveIgnore = (item: string): void => {
    triggerSave({ ignoreList: settings.ignoreList.filter((x) => x !== item) })
  }

  const handleAddAllow = (e: React.FormEvent): void => {
    e.preventDefault()
    const val = newAllowItem.trim().toLowerCase()
    if (!val || settings.customAllowlist.includes(val)) return
    triggerSave({ customAllowlist: [...settings.customAllowlist, val] })
    setNewAllowItem('')
  }

  const handleRemoveAllow = (item: string): void => {
    triggerSave({ customAllowlist: settings.customAllowlist.filter((x) => x !== item) })
  }

  const handleDockerSocketBlur = (rawVal: string): void => {
    const trimmed = rawVal.trim()
    const val = trimmed.length > 0 ? trimmed : undefined
    if (val !== settings.dockerSocketPath) {
      triggerSave({ dockerSocketPath: val })
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-title">
            <h2>Settings</h2>
            {saveIndicator && <span className="settings-saved-badge">Saved</span>}
          </div>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            title="Close settings (Esc)"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrolling page with 4 short sections */}
        <div className="settings-content">
          {/* Section 1: General */}
          <section className="settings-section">
            <h3 className="section-title">General</h3>

            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Refresh Interval</span>
                <span className="setting-desc">
                  How often DevDeck queries processes and containers
                </span>
              </div>
              <div className="setting-control">
                <select
                  className="settings-select mono"
                  value={settings.refreshIntervalSec}
                  onChange={(e) =>
                    triggerSave({ refreshIntervalSec: Number(e.target.value) as 2 | 3 | 5 | 10 })
                  }
                  aria-label="Refresh interval"
                >
                  <option value={2}>2 seconds</option>
                  <option value={3}>3 seconds (default)</option>
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                </select>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Theme</span>
                <span className="setting-desc">Interface appearance</span>
              </div>
              <div className="setting-control">
                <select
                  className="settings-select"
                  value={settings.theme || 'system'}
                  onChange={(e) =>
                    triggerSave({ theme: e.target.value as 'system' | 'light' | 'dark' })
                  }
                  aria-label="Interface theme"
                >
                  <option value="system">System match</option>
                  <option value="dark">Dark mode</option>
                  <option value="light">Light mode</option>
                </select>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Launch at Login</span>
                <span className="setting-desc">
                  Automatically start DevDeck when you log into macOS
                </span>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.openAtLogin || false}
                    onChange={(e) => triggerSave({ openAtLogin: e.target.checked })}
                    aria-label="Launch at login"
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Remember Stopped Processes</span>
                <span className="setting-desc">
                  Persist recently stopped dev processes across app restarts. Commands are encrypted
                  on disk using macOS Keychain storage.
                </span>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.persistRecentlyStopped || false}
                    onChange={(e) => triggerSave({ persistRecentlyStopped: e.target.checked })}
                    aria-label="Remember stopped processes across restarts"
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </section>

          {/* Section 2: Process Ignore List */}
          <section className="settings-section">
            <h3 className="section-title">Process Ignore List</h3>
            <p className="section-desc">
              Processes matching these executable names or command substrings are hidden from view.
            </p>

            <div className="tags-container">
              {settings.ignoreList.length === 0 ? (
                <span className="tags-empty">No ignored processes.</span>
              ) : (
                settings.ignoreList.map((item) => (
                  <span key={item} className="tag-chip">
                    <span className="tag-text mono">{item}</span>
                    <button
                      type="button"
                      className="tag-remove-btn"
                      onClick={() => handleRemoveIgnore(item)}
                      aria-label={`Remove ${item} from ignore list`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            <form onSubmit={handleAddIgnore} className="tag-add-form">
              <input
                ref={ignoreInputRef}
                type="text"
                className="tag-add-input mono"
                placeholder="e.g. background-worker, telemetry..."
                value={newIgnoreItem}
                onChange={(e) => setNewIgnoreItem(e.target.value)}
                aria-label="Add process to ignore list"
              />
              <button type="submit" className="tag-add-btn" disabled={!newIgnoreItem.trim()}>
                Add
              </button>
            </form>
          </section>

          {/* Section 3: Extra Allowlist */}
          <section className="settings-section">
            <h3 className="section-title">Custom Allowlist</h3>
            <p className="section-desc">
              Allow these additional binaries beyond standard dev tools (node, python, go, vite,
              cargo, etc.).
            </p>

            <div className="tags-container">
              {settings.customAllowlist.length === 0 ? (
                <span className="tags-empty">No custom allowlisted binaries.</span>
              ) : (
                settings.customAllowlist.map((item) => (
                  <span key={item} className="tag-chip">
                    <span className="tag-text mono">{item}</span>
                    <button
                      type="button"
                      className="tag-remove-btn"
                      onClick={() => handleRemoveAllow(item)}
                      aria-label={`Remove ${item} from allowlist`}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            <form onSubmit={handleAddAllow} className="tag-add-form">
              <input
                ref={allowInputRef}
                type="text"
                className="tag-add-input mono"
                placeholder="e.g. elixir, mix, php-fpm..."
                value={newAllowItem}
                onChange={(e) => setNewAllowItem(e.target.value)}
                aria-label="Add binary to custom allowlist"
              />
              <button type="submit" className="tag-add-btn" disabled={!newAllowItem.trim()}>
                Add
              </button>
            </form>
          </section>

          {/* Section 4: Docker Socket */}
          <section className="settings-section">
            <h3 className="section-title">Docker</h3>
            <p className="section-desc">
              DevDeck auto-discovers Docker Desktop, OrbStack, and Colima sockets. Override here if
              using a custom socket path.
            </p>

            <div className="setting-row-column">
              <input
                type="text"
                key={settings.dockerSocketPath || 'default'}
                className="settings-text-input mono"
                placeholder="Leave empty for auto-discovery (~/.docker/run/docker.sock)"
                defaultValue={settings.dockerSocketPath || ''}
                onBlur={(e) => handleDockerSocketBlur(e.target.value)}
                aria-label="Custom Docker socket path"
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button type="button" className="btn-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
