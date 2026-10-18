import React, { useState, useEffect, useRef } from 'react'
export function ExportPanel(): React.ReactElement {
  const [kind, setKind] = useState<'snapshot' | 'diagnostics' | null>(null),
    [format, setFormat] = useState<'json' | 'text'>('json')
  const [text, setText] = useState(''),
    [status, setStatus] = useState(''),
    [loading, setLoading] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!kind) {
      dialog.current?.close()
      return
    }
    dialog.current?.showModal()
    let active = true
    void window.api
      .exportPreview(kind, format)
      .then((r) => {
        if (!active) return
        if (r.ok) setText(r.data)
        else setStatus(r.error.message)
        setLoading(false)
      })
      .catch(() => {
        if (active) {
          setStatus('Could not prepare this preview. Try again.')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [kind, format])
  return (
    <div className="export-controls">
      <button
        className="quiet-btn"
        onClick={() => {
          setText('')
          setStatus('')
          setLoading(true)
          setKind('snapshot')
        }}
      >
        Copy snapshot…
      </button>
      <button
        className="quiet-btn"
        onClick={() => {
          setText('')
          setStatus('')
          setLoading(true)
          setKind('diagnostics')
        }}
      >
        Copy diagnostics…
      </button>
      <dialog
        ref={dialog}
        className="export-dialog"
        onCancel={() => setKind(null)}
        aria-label="Review export"
      >
        <h2>Review {kind}</h2>
        <p>Arguments are hidden. Environment and folder paths are excluded. Nothing is uploaded.</p>
        <label>
          Format{' '}
          <select
            value={format}
            onChange={(e) => {
              setText('')
              setStatus('')
              setLoading(true)
              setFormat(e.target.value as 'json' | 'text')
            }}
          >
            <option value="json">JSON</option>
            <option value="text">Text</option>
          </select>
        </label>
        <label htmlFor="export-preview">Exact clipboard preview</label>
        <textarea
          id="export-preview"
          className="profile-editor mono"
          readOnly
          value={loading ? 'Preparing preview…' : text}
        />
        <button className="quiet-btn" autoFocus onClick={() => setKind(null)}>
          Cancel
        </button>
        <button
          className="quiet-btn"
          disabled={!text || loading}
          onClick={() => {
            void navigator.clipboard.writeText(text).then(
              () => setStatus('Copied'),
              () => setStatus('Could not copy. Select the preview text and copy it manually.')
            )
          }}
        >
          Copy reviewed text
        </button>
        <p role="status">{status}</p>
      </dialog>
    </div>
  )
}
