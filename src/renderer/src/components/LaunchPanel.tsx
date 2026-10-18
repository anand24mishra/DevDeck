import React, { useEffect, useState } from 'react'
import { LogLines } from './LogLines'
import { stripAnsi } from '../../../shared/logs'
export function LaunchPanel({ active = true }: { active?: boolean }): React.ReactElement {
  const [items, setItems] = useState<{ id: string; name: string; pid: number }[]>([]),
    [selected, setSelected] = useState(''),
    [lines, setLines] = useState<string[]>([]),
    [query, setQuery] = useState('')
  const [name, setName] = useState(''),
    [cwd, setCwd] = useState(''),
    [command, setCommand] = useState(''),
    [revealed, setRevealed] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(''),
    [error, setError] = useState('')
  const [previousActive, setPreviousActive] = useState(active)
  // Conceal commands on tab changes without discarding an unfinished launch form.
  if (previousActive !== active) {
    setPreviousActive(active)
    if (!active) setRevealed(false)
  }
  useEffect(() => {
    if (!active) return
    let alive = true,
      inFlight = false
    const read = async (): Promise<void> => {
      if (document.hidden || inFlight) return
      inFlight = true
      try {
        const list = await window.api.listLaunches()
        if (alive && list.ok) setItems(list.data)
        if (selected) {
          const logs = await window.api.launchLogs(selected)
          if (alive) {
            if (logs.ok) setLines(logs.data)
            else setError(logs.error.message)
          }
        }
      } catch {
        if (alive) setError('Could not read captured output. Reopen this section to try again.')
      } finally {
        inFlight = false
      }
    }
    void read()
    const timer = setInterval(() => {
      void read()
    }, 1000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [selected, active])
  const filtered = lines.filter((line) =>
    stripAnsi(line).toLowerCase().includes(query.toLowerCase())
  )
  return (
    <section aria-label="Launch and capture" className="launch-panel">
      <p>
        Capture output from a process started here or by a profile. Output stays in memory. Keep
        DevDeck running in the menu bar while using capture.
      </p>
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          if (busy) return
          setBusy(true)
          setError('')
          setStatus('')
          void window.api
            .startLaunch({ name, cwd, command, ports: [] })
            .then((r) => {
              if (r.ok) {
                setSelected(r.data.id)
                setStatus(`Started ${name}`)
              } else setError(r.error.message)
            })
            .catch(() => setError('Could not launch this process. Check the command and folder.'))
            .finally(() => setBusy(false))
        }}
      >
        <label>
          Name
          <input
            required
            autoComplete="off"
            placeholder="Web server"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Absolute project folder
          <input
            required
            autoComplete="off"
            spellCheck={false}
            list="devdeck-project-folders"
            placeholder="/Users/you/code/storefront"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
          />
        </label>
        <label className="form-wide">
          Command
          <div className="field-with-action">
            <input
              required
              aria-label="Start command"
              type={revealed ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="npm run dev"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
            <button
              type="button"
              className="quiet-btn"
              aria-pressed={revealed}
              onClick={() => setRevealed(!revealed)}
            >
              {revealed ? 'Hide' : 'Reveal'}
            </button>
          </div>
        </label>
        <p className="field-help form-wide">
          Use a command and its arguments. Pipes, redirects and shell substitutions are not
          expanded.
        </p>
        <div className="form-wide">
          <button className="state-btn" type="submit" disabled={busy}>
            {busy ? 'Reviewing…' : 'Review and start'}
          </button>
        </div>
      </form>
      <hr />
      <label>
        Captured process
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value)
            setLines([])
            setError('')
          }}
        >
          <option value="">Choose a process</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} (PID {item.pid})
            </option>
          ))}
        </select>
      </label>
      {!items.length && !selected && (
        <p className="field-help">
          No captured output yet. Start a process above or from a saved profile.
        </p>
      )}
      {selected && (
        <>
          <div className="log-controls">
            <label>
              Search captured logs
              <input autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button
              className="quiet-btn"
              onClick={() => {
                void navigator.clipboard.writeText(filtered.map(stripAnsi).join('\n')).then(
                  () => setStatus('Copied logs'),
                  () => setError('Could not copy logs.')
                )
              }}
            >
              Copy
            </button>
            <button
              className="quiet-btn"
              onClick={() => {
                void window.api.clearLaunchLogs(selected).then((r) => {
                  if (r.ok) setLines([])
                  else setError(r.error.message)
                })
              }}
            >
              Clear
            </button>
          </div>
          {!filtered.length ? (
            <p role="status">
              {query
                ? 'No log lines match your search.'
                : 'Waiting for this process to write output…'}
            </p>
          ) : (
            <LogLines lines={filtered} />
          )}
        </>
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <p role="status">{status}</p>
    </section>
  )
}
