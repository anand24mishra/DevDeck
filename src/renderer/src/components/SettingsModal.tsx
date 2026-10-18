import { useDialogFocus } from '../hooks/useDialogFocus'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Settings, InstalledApplication, DEFAULT_NOTIFICATIONS } from '../../../shared/types'

interface SettingsModalProps {
  isOpen: boolean
  settings: Settings
  onClose: () => void
  onReplayOnboarding: () => void
  onUpdate: (partial: Partial<Settings>) => Promise<void>
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onUpdate,
  onReplayOnboarding
}) => {
  const [newIgnoreItem, setNewIgnoreItem] = useState('')
  const [newAllowItem, setNewAllowItem] = useState('')
  const [applications, setApplications] = useState<InstalledApplication[]>([])
  useEffect(() => {
    if (isOpen)
      void window.api
        .getInstalledApps()
        .then((result) => {
          if (result.ok) setApplications(result.data)
        })
        .catch(() => {})
  }, [isOpen])
  const [category, setCategory] = useState('General')
  const [saveError, setSaveError] = useState('')
  const [saveIndicator, setSaveIndicator] = useState(false)

  const ignoreInputRef = useRef<HTMLInputElement>(null)
  const allowInputRef = useRef<HTMLInputElement>(null)

  const triggerSave = useCallback(
    async (partial: Partial<Settings>) => {
      try {
        await onUpdate(partial)
        setSaveError('')
        setSaveIndicator(true)
        setTimeout(() => setSaveIndicator(false), 1200)
        return true
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Could not save settings.')
        return false
      }
    },
    [onUpdate]
  )

  const handleAddIgnore = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const val = newIgnoreItem.trim().toLowerCase()
    if (!val || settings.ignoreList.includes(val)) return
    if (await triggerSave({ ignoreList: [...settings.ignoreList, val] })) setNewIgnoreItem('')
  }

  const handleRemoveIgnore = (item: string): void => {
    triggerSave({ ignoreList: settings.ignoreList.filter((x) => x !== item) })
  }

  const handleAddAllow = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const val = newAllowItem.trim().toLowerCase()
    if (!val || settings.customAllowlist.includes(val)) return
    if (await triggerSave({ customAllowlist: [...settings.customAllowlist, val] }))
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

  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef, isOpen, onClose)

  if (!isOpen) return null

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="modal-card settings-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-title">
            <h2 id="settings-title">Settings</h2>
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
          {saveError && <p role="alert">{saveError}</p>}
          <nav className="settings-categories" aria-label="Settings sections">
            {['General', 'Processes', 'Notifications', 'Docker'].map((item) => (
              <button
                key={item}
                className="quiet-btn"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </nav>
          <section className="settings-section" hidden={category !== 'General'}>
            <h3 className="section-title">General</h3>{' '}
            <div className="setting-row">
              <label htmlFor="global-hotkey">Global shortcut</label>
              <span id="hotkey-help" className="setting-description">
                Press a shortcut with Control, Option or Command. Tab moves on.
              </span>
              <input
                id="global-hotkey"
                className="settings-input mono"
                readOnly
                value={settings.hotkey || ''}
                placeholder="Disabled"
                aria-describedby="hotkey-help"
                onKeyDown={(event) => {
                  if (event.key === 'Tab' || event.key === 'Escape') return
                  event.preventDefault()
                  event.stopPropagation()
                  const modifiers = [
                    event.ctrlKey && 'Control',
                    event.metaKey && 'Command',
                    event.altKey && 'Alt',
                    event.shiftKey && 'Shift'
                  ].filter(Boolean)
                  const key = event.code.replace(/^(Key|Digit)/, '')
                  if (modifiers.length && /^(?:[A-Z0-9]|F\d{1,2}|Space|Escape)$/.test(key))
                    void triggerSave({ hotkey: [...modifiers, key].join('+') })
                }}
              />
              <button
                className="quiet-btn"
                onClick={() =>
                  void triggerSave({ hotkey: settings.hotkey ? null : 'Control+Alt+D' })
                }
              >
                {settings.hotkey ? 'Disable' : 'Enable'}
              </button>
            </div>
            {(['editor', 'terminal'] as const).map((kind) => (
              <div className="setting-row" key={kind}>
                <label htmlFor={`preferred-${kind}`}>Preferred {kind}</label>
                <select
                  id={`preferred-${kind}`}
                  className="settings-select"
                  value={
                    (kind === 'editor' ? settings.preferredEditor : settings.preferredTerminal) ||
                    'auto'
                  }
                  onChange={(event) =>
                    void triggerSave(
                      kind === 'editor'
                        ? { preferredEditor: event.target.value }
                        : { preferredTerminal: event.target.value }
                    )
                  }
                >
                  <option value="auto">Automatic</option>
                  {applications
                    .filter((app) => app.kind === kind)
                    .map((app) => (
                      <option value={app.id} key={app.id}>
                        {app.name}
                      </option>
                    ))}
                </select>
              </div>
            ))}
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
            <button className="quiet-btn" onClick={onReplayOnboarding}>
              Show the welcome guide
            </button>
          </section>
          <section className="settings-section" hidden={category !== 'Processes'}>
            <h3 className="section-title">Processes and safety</h3>
            <label className="setting-row">
              <span>Show processes DevDeck cannot stop</span>
              <input
                type="checkbox"
                checked={!!settings.showUnmanageable}
                onChange={(event) => void triggerSave({ showUnmanageable: event.target.checked })}
              />
            </label>
            <label className="setting-row">
              <span>Enable environment viewer (values hidden by default)</span>
              <input
                type="checkbox"
                checked={!!settings.showEnvViewer}
                onChange={(event) => void triggerSave({ showEnvViewer: event.target.checked })}
              />
            </label>

            <label className="setting-row">
              <span>Show possibly idle process hints</span>
              <input
                type="checkbox"
                checked={settings.hintsEnabled !== false}
                onChange={(event) => void triggerSave({ hintsEnabled: event.target.checked })}
              />
            </label>
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
          <section className="settings-section" hidden={category !== 'Notifications'}>
            <h3 className="section-title">Notifications</h3>{' '}
            <fieldset>
              <legend>Silent notifications</legend>
              {(['serverStopped', 'memory', 'actionResults', 'networkExposure'] as const).map(
                (key) => (
                  <label className="setting-row" key={key}>
                    <span>
                      {key === 'serverStopped'
                        ? 'A watched server stopped unexpectedly'
                        : key === 'memory'
                          ? 'A process crosses the memory warning'
                          : key === 'networkExposure'
                            ? 'A new port is visible on the network'
                            : 'Stop actions finish'}
                    </span>
                    <input
                      type="checkbox"
                      checked={(settings.notifications || DEFAULT_NOTIFICATIONS)[key]}
                      onChange={(event) =>
                        void triggerSave({
                          notifications: {
                            ...(settings.notifications || DEFAULT_NOTIFICATIONS),
                            [key]: event.target.checked
                          }
                        })
                      }
                    />
                  </label>
                )
              )}
            </fieldset>
            <div className="setting-row">
              <label htmlFor="memory-threshold">Memory warning (MB)</label>
              <input
                id="memory-threshold"
                className="settings-input mono"
                type="number"
                min={64}
                max={1048576}
                defaultValue={settings.memoryThresholdMb || 4096}
                onBlur={(event) => {
                  const value = Number(event.target.value)
                  if (Number.isInteger(value) && value >= 64 && value <= 1048576)
                    void triggerSave({ memoryThresholdMb: value })
                  else {
                    setSaveError('Enter a whole memory limit from 64 to 1,048,576 MB.')
                    event.currentTarget.value = String(settings.memoryThresholdMb || 4096)
                  }
                }}
              />
            </div>
          </section>

          {/* Section 2: Process Ignore List */}
          <section className="settings-section" hidden={category !== 'Processes'}>
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
          <section className="settings-section" hidden={category !== 'Processes'}>
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
          <section className="settings-section" hidden={category !== 'Docker'}>
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
