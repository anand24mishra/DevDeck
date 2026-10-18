import React, { useEffect, useState } from 'react'
import type { ProfileStatus, MemberReport, StackProfile } from '../../../shared/types'
export function ProfilesPanel(): React.ReactElement {
  const [profiles, setProfiles] = useState<ProfileStatus[]>([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reports, setReports] = useState<MemberReport[]>([])
  const read = (): void => {
    void window.api.listProfiles().then((result) => {
      if (result.ok) setProfiles(result.data)
      else setError(result.error.message)
    })
  }
  useEffect(() => {
    read()
    const timer = setInterval(() => {
      if (!document.hidden) read()
    }, 5000)
    return () => clearInterval(timer)
  }, [])
  const act = async (id: string, action: 'start' | 'stop' | 'restart'): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.api.profileAction(id, action)
      if (result.ok) setReports(result.data)
      else setError(result.error.message)
      read()
    } finally {
      setBusy(false)
    }
  }
  const save = async (): Promise<void> => {
    try {
      const profile = JSON.parse(editing!) as StackProfile
      const result = await window.api.saveProfile(profile)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setEditing(null)
      setError('')
      read()
    } catch {
      setError('Enter valid profile JSON. Each command needs a name, project cwd and ports array.')
    }
  }
  return (
    <section className="profiles-panel">
      <div className="project-group-header">
        <h2>Profiles</h2>
        <button
          className="quiet-btn"
          onClick={() =>
            setEditing(
              JSON.stringify(
                {
                  id: crypto.randomUUID(),
                  name: 'New stack',
                  members: [
                    {
                      name: 'Web',
                      command: 'npm run dev',
                      cwd: '/Users/you/project',
                      ports: [3000]
                    }
                  ]
                },
                null,
                2
              )
            )
          }
        >
          New profile
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!profiles.length && <p>Save a project as a profile, or add commands and containers here.</p>}
      {profiles.map(({ profile, members }) => (
        <section className="project-group" key={profile.id}>
          <div className="project-group-header">
            <h3>{profile.name}</h3>
            {(['start', 'stop', 'restart'] as const).map((action) => (
              <button
                key={action}
                className="quiet-btn"
                disabled={busy}
                onClick={() => {
                  void act(profile.id, action)
                }}
              >
                {action[0].toUpperCase() + action.slice(1)}
              </button>
            ))}
            <button
              className="quiet-btn"
              onClick={() => setEditing(JSON.stringify(profile, null, 2))}
            >
              Edit
            </button>
            <button
              className="quiet-btn"
              onClick={() => {
                void window.api.deleteProfile(profile.id).then(read)
              }}
            >
              Delete profile
            </button>
          </div>
          {members.map((member) => (
            <p key={member.name}>
              {member.name} · {member.running ? 'Running' : 'Stopped'}
            </p>
          ))}
        </section>
      ))}
      {editing !== null && (
        <section aria-label="Profile editor">
          <label htmlFor="profile-json">
            Profile JSON · saved locally, commands run only after confirmation
          </label>
          <textarea
            id="profile-json"
            className="profile-editor mono"
            spellCheck={false}
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
          />
          <p>
            Process members: name, command, cwd, ports. Container members: name, containerId, ports.
          </p>
          <button
            className="quiet-btn"
            onClick={() => {
              void save()
            }}
          >
            Save profile
          </button>
          <button className="quiet-btn" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </section>
      )}
      <div role="status">
        {reports.map((report, index) => (
          <p key={index}>
            {report.name}: {report.message}
            {report.pid ? ` (${report.pid})` : ''}
          </p>
        ))}
      </div>
    </section>
  )
}
