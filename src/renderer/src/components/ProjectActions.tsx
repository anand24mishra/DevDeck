import { useEffect, useState } from 'react'
import type { InstalledApplication } from '../../../shared/types'

export function ProjectActions({ path }: { path: string }): React.JSX.Element {
  const [apps, setApps] = useState<InstalledApplication[]>([])
  const [status, setStatus] = useState('')
  useEffect(() => {
    let active = true
    void window.api
      .getInstalledApps()
      .then((result) => {
        if (active && result.ok) setApps(result.data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  const open = async (action: 'editor' | 'finder' | 'terminal'): Promise<void> => {
    try {
      const result = await (action === 'editor'
        ? window.api.openProjectInEditor(path)
        : action === 'finder'
          ? window.api.showProjectInFinder(path)
          : window.api.openProjectInTerminal(path))
      setStatus(result.ok ? '' : result.error.message)
    } catch {
      setStatus('Could not open this project. Try again.')
    }
  }
  return (
    <span className="project-actions">
      {(['editor', 'finder', 'terminal'] as const).map((action) => {
        const available = action === 'finder' || apps.some((app) => app.kind === action)
        const label = action === 'finder' ? 'Show in Finder' : `Open in ${action}`
        return (
          <button
            key={action}
            className="quiet-btn"
            disabled={!available}
            title={available ? label : `No ${action} found. Install one or choose it in Settings.`}
            onClick={() => {
              void open(action)
            }}
          >
            {label}
          </button>
        )
      })}
      {status && <span role="status">{status}</span>}
    </span>
  )
}
