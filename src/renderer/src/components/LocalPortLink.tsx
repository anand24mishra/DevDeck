import { useState } from 'react'

export function LocalPortLink({ port }: { port: number }): React.JSX.Element {
  const url = `http://localhost:${port}`
  const [status, setStatus] = useState('')
  return (
    <span className="local-port-link mono" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        title={`Open ${url}`}
        aria-label={`Open localhost:${port}`}
        onClick={() => {
          void window.api
            .openLocalUrl(url)
            .then((result) => setStatus(result.ok ? '' : result.error.message))
            .catch(() => setStatus('Could not open this address. Try again.'))
        }}
      >
        localhost:{port}
      </button>
      <button
        type="button"
        className="copy-url"
        aria-label={`Copy URL for port ${port}`}
        onClick={() => {
          void navigator.clipboard
            .writeText(url)
            .then(() => setStatus('Copied URL'))
            .catch(() => setStatus('Could not copy this address.'))
        }}
      >
        Copy
      </button>
      {status && <span role="status">{status}</span>}
    </span>
  )
}
