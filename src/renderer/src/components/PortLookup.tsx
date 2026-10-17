import { useEffect, useRef, useState } from 'react'
import type { PortOwner, Proc } from '../../../shared/types'
import { parsePortInput } from '../../../shared/ports'

export function PortLookup({
  interval,
  onStop
}: {
  interval: number
  onStop: (proc: Proc) => void
}): React.JSX.Element {
  const [input, setInput] = useState('')
  const [owners, setOwners] = useState<PortOwner[]>([])
  const [status, setStatus] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const port = parsePortInput(input)
  useEffect(() => {
    const key = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        field.current?.focus()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => {
    let active = true
    let inFlight = false
    const lookup = async (): Promise<void> => {
      if (!port || inFlight || document.hidden) return
      inFlight = true
      try {
        const result = await window.api.lookupPort(port)
        if (!active) return
        setOwners(result.ok ? result.data : [])
        setStatus(
          result.ok
            ? result.data.length
              ? ''
              : `Nothing is using port ${port}.`
            : result.error.message
        )
      } catch {
        if (active) setStatus('Could not check this port. Try again.')
      } finally {
        inFlight = false
      }
    }
    const first = setTimeout(() => {
      setOwners([])
      setStatus(port ? 'Checking port…' : '')
      void lookup()
    }, 200)
    const timer = setInterval(() => {
      void lookup()
    }, interval * 1000)
    return () => {
      active = false
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [port, interval])
  return (
    <section className="port-lookup" aria-label="Free a port">
      <div className="port-field-row">
        <label htmlFor="port-lookup">Free a port</label>
        <input
          ref={field}
          id="port-lookup"
          className="search-input mono"
          inputMode="numeric"
          value={input}
          placeholder="3000"
          onChange={(event) => setInput(event.target.value)}
          aria-describedby="port-status"
        />
        {input && (
          <button className="quiet-btn" onClick={() => setInput('')}>
            Clear
          </button>
        )}
        <span className="muted">⌘⇧P</span>
      </div>
      <p id="port-status" role="status">
        {input && !port ? 'Enter a port from 1 to 65535.' : status}
      </p>
      {port &&
        owners
          .filter((owner) => owner.port === port)
          .map((owner) => (
            <div className="port-owner" key={`${owner.pid}-${owner.address}`}>
              <span>
                {owner.process?.name || owner.name} · {owner.process?.project || 'Read-only'}
              </span>
              <span className="mono">
                {owner.address}:{port}
              </span>
              {owner.process ? (
                <button className="row-stop-btn" onClick={() => onStop(owner.process!)}>
                  Stop
                </button>
              ) : (
                <span>DevDeck cannot stop this process</span>
              )}
            </div>
          ))}
    </section>
  )
}
