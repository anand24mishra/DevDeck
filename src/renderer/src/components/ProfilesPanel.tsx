import { LaunchPanel } from './LaunchPanel'
import { ProfileEditor } from './ProfileEditor'
import { ConfirmDialog } from './ConfirmDialog'
import React, { useEffect, useState } from 'react'
import type { ProfileStatus, MemberReport, StackProfile, Container } from '../../../shared/types'
export function ProfilesPanel({
  active = true,
  projectFolders = [],
  containers = []
}: {
  active?: boolean
  projectFolders?: string[]
  containers?: Container[]
}): React.ReactElement {
  const [profiles, setProfiles] = useState<ProfileStatus[]>([]),
    [error, setError] = useState(''),
    [loadError, setLoadError] = useState(''),
    [editing, setEditing] = useState<StackProfile | null>(null)
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null),
    [reports, setReports] = useState<Record<string, MemberReport[]>>({}),
    [deleting, setDeleting] = useState<StackProfile | null>(null),
    [launchOpen, setLaunchOpen] = useState(false),
    [deleteBusy, setDeleteBusy] = useState(false)
  const read = (): void => {
    void window.api
      .listProfiles()
      .then((r) => {
        if (r.ok) {
          setProfiles(r.data)
          setLoadError('')
        } else setLoadError(r.error.message)
      })
      .catch(() => setLoadError('Could not load profiles. Try again.'))
  }
  useEffect(() => {
    if (!active) return
    read()
    let inFlight = false
    const timer = setInterval(() => {
      if (!document.hidden && !inFlight) {
        inFlight = true
        void window.api
          .listProfiles()
          .then((r) => {
            if (r.ok) {
              setProfiles(r.data)
              setLoadError('')
            } else setLoadError(r.error.message)
          })
          .catch(() => setLoadError('Could not refresh profiles. Try again.'))
          .finally(() => {
            inFlight = false
          })
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [active])
  const act = async (id: string, action: 'start' | 'stop' | 'restart'): Promise<void> => {
    setError('')
    setBusy({ id, action })
    setReports((old) => ({ ...old, [id]: [] }))
    try {
      const result = await window.api.profileAction(id, action)
      if (result.ok) setReports((old) => ({ ...old, [id]: result.data }))
      else setError(result.error.message)
      read()
    } catch {
      setError('The profile action could not complete. Check the member results and try again.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="profiles-panel" aria-label="Saved stack profiles">
      <datalist id="devdeck-project-folders">
        {projectFolders.map((folder) => (
          <option value={folder} key={folder} />
        ))}
      </datalist>
      <datalist id="devdeck-container-ids">
        {containers.map((c) => (
          <option value={c.id} key={c.id}>
            {c.name} · {c.image}
          </option>
        ))}
      </datalist>
      <div className="section-heading">
        <div>
          <h2>Profiles</h2>
          <p>Start a saved stack with its commands and containers.</p>
        </div>
        <button
          className="state-btn"
          disabled={editing !== null}
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              name: '',
              members: [{ name: '', command: '', cwd: '', ports: [] }]
            })
          }
        >
          New profile
        </button>
      </div>
      {(error || loadError) && (
        <p role="alert" className="inline-error">
          {error || loadError}{' '}
          <button className="quiet-btn" onClick={read}>
            Try again
          </button>
        </p>
      )}
      {editing && (
        <ProfileEditor
          key={editing.id}
          initial={editing}
          active={active}
          onSaved={() => {
            setEditing(null)
            read()
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {!profiles.length && !editing && (
        <div className="profiles-empty">
          <h3>No saved profiles yet</h3>
          <p>
            Create a profile here, or choose “Save as profile” from a running project’s actions.
          </p>
        </div>
      )}
      {profiles.map(({ profile, members }) => {
        const running = members.filter((m) => m.running).length
        return (
          <section className="saved-profile" key={profile.id}>
            <div className="section-heading">
              <div>
                <h3>{profile.name}</h3>
                <span className="field-help">
                  {running} of {members.length} running
                </span>
              </div>
              <div className="form-actions">
                {(['start', 'stop', 'restart'] as const).map((action) => (
                  <button
                    key={action}
                    className={action === 'stop' ? 'quiet-btn danger-text' : 'quiet-btn'}
                    disabled={
                      !!busy || (action === 'start' ? running === members.length : running === 0)
                    }
                    onClick={() => {
                      void act(profile.id, action)
                    }}
                  >
                    {busy?.id === profile.id && busy.action === action
                      ? 'Working…'
                      : action[0].toUpperCase() + action.slice(1)}
                  </button>
                ))}
                <button className="quiet-btn" disabled={!!busy} onClick={() => setEditing(profile)}>
                  Edit
                </button>
                <details className="actions-disclosure">
                  <summary>More</summary>
                  <button
                    className="quiet-btn danger-text"
                    disabled={!!busy}
                    onClick={() => setDeleting(profile)}
                  >
                    Delete saved profile
                  </button>
                </details>
              </div>
            </div>
            <ul className="profile-members">
              {members.map((member) => (
                <li key={member.name}>
                  <span>{member.name}</span>
                  <span className={`member-status ${member.running ? 'is-running' : ''}`}>
                    <span className="status-dot" aria-hidden="true" />
                    {member.running ? 'Running' : 'Stopped'}
                  </span>
                </li>
              ))}
            </ul>
            <div role="status">
              {reports[profile.id]?.map((report, i) => (
                <p key={i} className={report.ok ? '' : 'inline-error'}>
                  {report.name}: {report.message}
                  {report.pid ? ` (PID ${report.pid})` : ''}
                </p>
              ))}
            </div>
          </section>
        )
      })}
      <details className="launch-disclosure" onToggle={(e) => setLaunchOpen(e.currentTarget.open)}>
        <summary>Start a process and capture output</summary>
        {launchOpen && <LaunchPanel active={active} />}
      </details>
      <ConfirmDialog
        isOpen={!!deleting}
        title={`Delete saved profile “${deleting?.name || ''}”?`}
        description="This removes the saved configuration. Running processes and containers keep running."
        confirmLabel="Delete profile"
        isBusy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting && !deleteBusy) {
            setDeleteBusy(true)
            void window.api
              .deleteProfile(deleting.id)
              .then((r) => {
                if (r.ok) {
                  setDeleting(null)
                  read()
                } else {
                  setDeleting(null)
                  setError(r.error.message)
                }
              })
              .catch(() => {
                setDeleting(null)
                setError('Could not delete the saved profile. Try again.')
              })
              .finally(() => setDeleteBusy(false))
          }
        }}
      />
    </section>
  )
}
