import React, { useState, useEffect } from 'react'
import type { ResourceSample } from '../../../shared/types'
export function ProjectHistory({ project }: { project: string }): React.ReactElement {
  const [open, setOpen] = useState(false),
    [samples, setSamples] = useState<ResourceSample[]>([])
  const [cpu, setCpu] = useState(''),
    [memory, setMemory] = useState(''),
    [status, setStatus] = useState('')
  useEffect(() => {
    if (!open) return
    let active = true
    void window.api.getSettings().then((r) => {
      if (active && r.ok) {
        const limits = r.data.resourceThresholds?.[project]
        setCpu(limits?.cpu ? String(limits.cpu) : '')
        setMemory(limits?.memMB ? String(limits.memMB) : '')
      }
    })
    const read = (): void => {
      if (!document.hidden)
        void window.api.projectHistory(project).then((r) => {
          if (active) {
            if (r.ok) setSamples(r.data)
            else setStatus(r.error.message)
          }
        })
    }
    read()
    const timer = setInterval(read, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [open, project])
  const points = samples.filter((_, i) => i % Math.max(1, Math.ceil(samples.length / 120)) === 0)
  const maximum = Math.max(1, ...points.map((p) => p.memMB))
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Resource history and alerts</summary>
      {open && (
        <>
          <p>Up to one hour, sampled while DevDeck is visible. Memory only.</p>
          <p className="field-help">Memory history</p>
          {!samples.length && (
            <p role="status">History starts collecting while this window is visible.</p>
          )}
          <svg
            viewBox="0 0 120 30"
            className="history-chart"
            role="img"
            aria-label={`Memory history for ${project}`}
          >
            <polyline
              fill="none"
              stroke="var(--accent)"
              points={points.map((p, i) => `${i},${29 - (p.memMB / maximum) * 28}`).join(' ')}
            />
          </svg>
          <p>
            {samples.length} samples · Latest {samples.at(-1)?.cpu.toFixed(1) || '0'}% CPU /{' '}
            {samples.at(-1)?.memMB.toFixed(0) || '0'} MB
          </p>
          <label>
            CPU alert (%){' '}
            <input
              type="number"
              min="1"
              max="100000"
              value={cpu}
              onChange={(e) => setCpu(e.target.value)}
            />
          </label>
          <label>
            Memory alert (MB){' '}
            <input
              type="number"
              min="1"
              max="1048576"
              value={memory}
              onChange={(e) => setMemory(e.target.value)}
            />
          </label>
          <button
            className="quiet-btn"
            onClick={() => {
              void window.api.getSettings().then(async (r) => {
                if (!r.ok) {
                  setStatus(r.error.message)
                  return
                }
                const limits = {
                  ...(cpu ? { cpu: Number(cpu) } : {}),
                  ...(memory ? { memMB: Number(memory) } : {})
                }
                const saved = await window.api.updateSettings({
                  resourceThresholds: { ...r.data.resourceThresholds, [project]: limits }
                })
                setStatus(saved.ok ? 'Alerts saved' : saved.error.message)
              })
            }}
          >
            Save alerts
          </button>
          <p role="status">{status}</p>
        </>
      )}
    </details>
  )
}
