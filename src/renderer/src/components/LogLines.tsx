import React, { useRef, useState, useLayoutEffect } from 'react'
import { ansiSegments } from '../../../shared/logs'
export function LogLines({ lines }: { lines: string[] }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  const [metrics, setMetrics] = useState({ height: 320, row: 21 })
  useLayoutEffect(() => {
    const el = ref.current!
    const update = (): void =>
      setMetrics({
        height: el.clientHeight,
        row: parseFloat(getComputedStyle(el).lineHeight) || 21
      })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const start = Math.max(0, Math.floor(top / metrics.row) - 5),
    end = Math.min(lines.length, start + Math.ceil(metrics.height / metrics.row) + 10)
  return (
    <div
      ref={ref}
      className="captured-logs mono"
      role="region"
      aria-label="Captured log output"
      tabIndex={0}
      onScroll={(e) => setTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: lines.length * metrics.row, position: 'relative' }}>
        <div style={{ position: 'absolute', top: start * metrics.row, minWidth: '100%' }}>
          {lines.slice(start, end).map((line, index) => (
            <div key={start + index} style={{ height: metrics.row, whiteSpace: 'pre' }}>
              {ansiSegments(line).map((part, i) => (
                <span key={i} style={{ color: part.color }}>
                  {part.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
