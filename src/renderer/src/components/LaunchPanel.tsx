import React, { useEffect, useState } from 'react'
import { LogLines } from './LogLines'
import { stripAnsi } from '../../../shared/logs'
export function LaunchPanel(): React.ReactElement {
  const [items, setItems] = useState<{ id: string; name: string; pid: number }[]>([])
  const [selected, setSelected] = useState('')
  const [lines, setLines] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [name, setName] = useState(''),
    [cwd, setCwd] = useState(''),
    [command, setCommand] = useState('')
  const [status, setStatus] = useState('')
  useEffect(() => {
    let active = true,
      inFlight = false
    const read = async (): Promise<void> => {
      if (document.hidden || inFlight) return
      inFlight = true
      try {
        const list = await window.api.listLaunches()
        if (active && list.ok) setItems(list.data)
        if (selected) {
          const logs = await window.api.launchLogs(selected)
          if (active) {
            if (logs.ok) setLines(logs.data)
            else setStatus(logs.error.message)
          }
        }
      } finally {
        inFlight = false
      }
    }
    void read()
    const timer = setInterval(() => {
      void read()
    }, 1000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [selected])
  const filtered = lines.filter((line) =>
    stripAnsi(line).toLowerCase().includes(query.toLowerCase())
  )
  return (
    <section aria-label="Launch and capture">
      <h3>Launch and capture output</h3>
      <p>
        Only processes started here or by a profile have captured output. Output stays in memory and
        expires when DevDeck quits.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void window.api.startLaunch({ name, cwd, command, ports: [] }).then((r) => {
            if (r.ok) {
              setSelected(r.data.id)
              setStatus(`Started ${name}`)
            } else setStatus(r.error.message)
          })
        }}
      >
        <label>
          Name{' '}
          <input required value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Project folder <input required value={cwd} onChange={(e) => setCwd(e.target.value)} />
        </label>
        <label>
          Command{' '}
          <input
            required
            type="password"
            autoComplete="off"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
        </label>
        <button className="quiet-btn" type="submit">
          Review and start
        </button>
      </form>
      <label>
        Captured process{' '}
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value)
            setLines([])
          }}
        >
          <option value="">Choose a process</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.pid})
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <>
          <label>
            Search captured logs <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button
            className="quiet-btn"
            onClick={() => {
              void navigator.clipboard.writeText(filtered.map(stripAnsi).join('\n')).then(
                () => setStatus('Copied logs'),
                () => setStatus('Could not copy logs')
              )
            }}
          >
            Copy
          </button>
          <button
            className="quiet-btn"
            onClick={() => {
              void window.api.clearLaunchLogs(selected).then(() => setLines([]))
            }}
          >
            Clear
          </button>
          <LogLines lines={filtered} />
        </>
      )}
      <p role="status">{status}</p>
    </section>
  )
}
