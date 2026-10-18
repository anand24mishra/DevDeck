import React, { useRef, useState, useLayoutEffect, useCallback } from 'react'
/** Variable-height rows share the app scroll viewport; expanded details stay measured. */
export function VirtualList<T>({
  items,
  itemKey,
  render
}: {
  items: T[]
  itemKey: (item: T) => string
  render: (item: T) => React.ReactNode
}): React.ReactElement {
  const root = useRef<HTMLDivElement>(null)
  const [heights, setHeights] = useState(() => new Map<string, number>()),
    [viewport, setViewport] = useState({ top: 0, height: 600 })
  const keys = items.map(itemKey)
  const offsets = [0]
  for (const key of keys) offsets.push(offsets.at(-1)! + (heights.get(key) || 48))
  useLayoutEffect(() => {
    const element = root.current!,
      scroll = element.closest<HTMLElement>('.app-content')!
    let frame = 0
    const update = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() =>
        setViewport({
          top: Math.max(
            0,
            scroll.getBoundingClientRect().top - element.getBoundingClientRect().top
          ),
          height: scroll.clientHeight
        })
      )
    }
    const observer = new ResizeObserver(update)
    observer.observe(scroll)
    scroll.addEventListener('scroll', update, { passive: true })
    update()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      scroll.removeEventListener('scroll', update)
    }
  }, [])
  const measure = useCallback((key: string, height: number) => {
    setHeights((previous) => {
      if (height <= 0 || Math.abs((previous.get(key) || 48) - height) <= 1) return previous
      const next = previous.size > 5000 ? new Map<string, number>() : new Map(previous)
      next.set(key, height)
      return next
    })
  }, [])
  let low = 0,
    high = items.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (offsets[mid + 1] < viewport.top) low = mid + 1
    else high = mid
  }
  const start = Math.max(0, low - 6)
  let end = low
  while (end < items.length && offsets[end] < viewport.top + viewport.height) end++
  end = Math.min(items.length, end + 6)
  return (
    <div
      ref={root}
      className="virtual-list"
      role="list"
      aria-label={`${items.length} rows, windowed`}
      style={{ height: offsets.at(-1) }}
    >
      {items.slice(start, end).map((item, index) => {
        const at = start + index
        return (
          <MeasuredRow
            key={keys[at]}
            rowKey={keys[at]}
            top={offsets[at]}
            position={at + 1}
            count={items.length}
            measure={measure}
          >
            {render(item)}
          </MeasuredRow>
        )
      })}
    </div>
  )
}
function MeasuredRow({
  rowKey,
  top,
  position,
  count,
  measure,
  children
}: {
  rowKey: string
  top: number
  position: number
  count: number
  measure: (key: string, height: number) => void
  children: React.ReactNode
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() =>
      measure(rowKey, ref.current!.getBoundingClientRect().height)
    )
    observer.observe(ref.current!)
    return () => observer.disconnect()
  }, [measure, rowKey])
  return (
    <div
      ref={ref}
      className="virtual-row"
      role="listitem"
      aria-posinset={position}
      aria-setsize={count}
      style={{ transform: `translateY(${top}px)` }}
    >
      {children}
    </div>
  )
}
