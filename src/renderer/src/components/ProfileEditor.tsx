import React, { useState, useRef } from 'react'
import type { StackProfile, ProfileMember } from '../../../shared/types'
import { validProfile } from '../../../shared/profiles'
type MemberDraft = {
  name: string
  kind: 'process' | 'container'
  command: string
  cwd: string
  containerId: string
  ports: string
}
const emptyMember = (): MemberDraft => ({
  name: '',
  kind: 'process',
  command: '',
  cwd: '',
  containerId: '',
  ports: ''
})
export function ProfileEditor({
  initial,
  active = true,
  onSaved,
  onCancel
}: {
  initial: StackProfile
  active?: boolean
  onSaved: () => void
  onCancel: () => void
}): React.ReactElement {
  const [name, setName] = useState(initial.name)
  const [members, setMembers] = useState<MemberDraft[]>(
    initial.members.map((m) => ({
      ...emptyMember(),
      name: m.name,
      kind: m.containerId ? 'container' : 'process',
      command: m.command || '',
      cwd: m.cwd || '',
      containerId: m.containerId || '',
      ports: m.ports.join(', ')
    }))
  )
  const [revealed, setRevealed] = useState(new Set<number>()),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const [previousActive, setPreviousActive] = useState(active)
  // Reset disclosure during the tab transition while preserving the form draft.
  if (previousActive !== active) {
    setPreviousActive(active)
    if (!active) setRevealed(new Set())
  }
  const update = (index: number, patch: Partial<MemberDraft>): void => {
    setError('')
    setMembers((old) => old.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }
  const save = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setError('')
    const parsed: ProfileMember[] = []
    for (let i = 0; i < members.length; i++) {
      const m = members[i],
        ports = m.ports.trim()
          ? m.ports
              .split(/[,\s]+/)
              .filter(Boolean)
              .map(Number)
          : []
      if (ports.some((p) => !Number.isInteger(p) || p < 1 || p > 65535)) {
        setError(`Member ${i + 1}: enter ports from 1 to 65535, separated by commas.`)
        queueMicrotask(() => errorRef.current?.focus())
        return
      }
      const issue = !m.name.trim()
        ? 'enter a member name.'
        : members.slice(0, i).some((previous) => previous.name.trim() === m.name.trim())
          ? 'choose a unique member name.'
          : m.kind === 'process' && !m.cwd.trim().startsWith('/')
            ? 'enter an absolute project folder, starting with /.'
            : m.kind === 'process' && (!m.command.trim() || m.command.length > 8192)
              ? 'enter a start command of up to 8192 characters.'
              : m.kind === 'container' && !/^[a-f0-9]{12,64}$/.test(m.containerId.trim())
                ? 'enter a container ID of 12 to 64 lowercase letters and numbers.'
                : ports.length > 50
                  ? 'use up to 50 expected ports.'
                  : ''
      if (issue) {
        setError(`Member ${i + 1}: ${issue}`)
        queueMicrotask(() => errorRef.current?.focus())
        return
      }
      parsed.push({
        name: m.name.trim(),
        ports,
        ...(m.kind === 'container'
          ? { containerId: m.containerId.trim() }
          : { command: m.command, cwd: m.cwd.trim() })
      })
    }
    const profile = { id: initial.id, name: name.trim(), members: parsed }
    if (!validProfile(profile)) {
      setError(
        'Check the profile name and member fields. Folder paths may contain up to 4096 characters.'
      )
      queueMicrotask(() => errorRef.current?.focus())
      return
    }
    setBusy(true)
    try {
      const result = await window.api.saveProfile(profile)
      if (result.ok) onSaved()
      else setError(result.error.message)
    } catch {
      setError('Could not save this profile. Check the fields and try again.')
    } finally {
      setBusy(false)
    }
  }
  if (initial.repo)
    return (
      <section className="profile-form">
        <h3>{initial.name}</h3>
        <p>
          This profile is managed by .devdeck.json. Edit that file, then import it again to review
          and approve changes.
        </p>
        <button className="quiet-btn" onClick={onCancel}>
          Done
        </button>
      </section>
    )
  return (
    <form
      className="profile-form"
      aria-label="Profile editor"
      onSubmit={(e) => {
        void save(e)
      }}
    >
      <div className="section-heading">
        <h3>{initial.name ? 'Edit profile' : 'New profile'}</h3>
        <span>Saved on this Mac</span>
      </div>
      <label>
        Profile name
        <input
          required
          autoFocus
          maxLength={120}
          name="profileName"
          autoComplete="off"
          placeholder="Storefront"
          value={name}
          onChange={(e) => {
            setError('')
            setName(e.target.value)
          }}
        />
      </label>
      <p className="field-help">
        A profile starts and stops a set of commands and containers. Commands run only after you
        review them.
      </p>
      {members.map((m, index) => (
        <fieldset className="member-fields" key={index}>
          <legend>Member {index + 1}</legend>
          <div className="form-grid">
            <label>
              Member name
              <input
                required
                autoComplete="off"
                maxLength={120}
                aria-label={`Member ${index + 1} name`}
                placeholder="Web server"
                value={m.name}
                onChange={(e) => update(index, { name: e.target.value })}
              />
            </label>
            <label>
              Type
              <select
                value={m.kind}
                aria-label={`Member ${index + 1} type`}
                onChange={(e) => update(index, { kind: e.target.value as MemberDraft['kind'] })}
              >
                <option value="process">Process</option>
                <option value="container">Docker container</option>
              </select>
            </label>
            {m.kind === 'process' ? (
              <>
                <label className="form-wide">
                  Project folder
                  <input
                    required
                    autoComplete="off"
                    spellCheck={false}
                    list="devdeck-project-folders"
                    aria-label={`Member ${index + 1} project folder`}
                    placeholder="/Users/you/code/storefront"
                    value={m.cwd}
                    onChange={(e) => update(index, { cwd: e.target.value })}
                  />
                </label>
                <label className="form-wide">
                  Start command
                  <div className="field-with-action">
                    <input
                      required
                      autoComplete="off"
                      spellCheck={false}
                      type={revealed.has(index) ? 'text' : 'password'}
                      aria-label={`Member ${index + 1} start command`}
                      placeholder="npm run dev"
                      value={m.command}
                      onChange={(e) => update(index, { command: e.target.value })}
                    />
                    <button
                      type="button"
                      className="quiet-btn"
                      aria-pressed={revealed.has(index)}
                      onClick={() =>
                        setRevealed((old) => {
                          const next = new Set(old)
                          if (next.has(index)) next.delete(index)
                          else next.add(index)
                          return next
                        })
                      }
                    >
                      {revealed.has(index) ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                </label>
              </>
            ) : (
              <label className="form-wide">
                Container ID
                <input
                  required
                  autoComplete="off"
                  spellCheck={false}
                  pattern="[a-f0-9]{12,64}"
                  list="devdeck-container-ids"
                  aria-label={`Member ${index + 1} container ID`}
                  placeholder="Copy the ID from Docker details"
                  value={m.containerId}
                  onChange={(e) => update(index, { containerId: e.target.value })}
                />
              </label>
            )}
            <label>
              Expected ports <span className="field-help">Optional</span>
              <input
                autoComplete="off"
                inputMode="numeric"
                aria-label={`Member ${index + 1} expected ports`}
                placeholder="3000, 5173"
                value={m.ports}
                onChange={(e) => update(index, { ports: e.target.value })}
              />
            </label>
          </div>
          <button
            type="button"
            className="quiet-btn"
            disabled={members.length === 1 || busy}
            onClick={() => {
              setMembers((old) => old.filter((_, i) => i !== index))
              setRevealed(new Set())
            }}
          >
            Remove member
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="quiet-btn"
        disabled={members.length >= 50 || busy}
        onClick={() => setMembers((old) => [...old, emptyMember()])}
      >
        Add member
      </button>
      <p ref={errorRef} tabIndex={-1} role="alert" className="inline-error">
        {error}
      </p>
      <div className="form-actions">
        <button type="button" className="quiet-btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="state-btn" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}
