import { useEffect, useRef, useState } from 'react'
import type { ContainerStatsSample } from '../../../shared/types'

export function useContainerStats(
  id: string,
  running: boolean
): { element: React.RefObject<HTMLDivElement | null>; samples: ContainerStatsSample[] } {
  const element = useRef<HTMLDivElement>(null)
  const [samples, setSamples] = useState<ContainerStatsSample[]>([])
  useEffect(() => {
    if (!running) return
    let inViewport = false
    const update = (): void => {
      if (inViewport && !document.hidden) void window.api.startContainerStats([id]).catch(() => {})
      else void window.api.stopContainerStats([id]).catch(() => {})
    }
    const observer = new IntersectionObserver((entries) => {
      inViewport = entries[0]?.isIntersecting || false
      update()
    })
    if (element.current) observer.observe(element.current)
    const unsubscribe = window.api.onContainerStats((event) => {
      if (event.id === id && !document.hidden && inViewport)
        setSamples((previous) => [...previous.slice(-59), event.sample])
    })
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      unsubscribe()
      document.removeEventListener('visibilitychange', update)
      void window.api.stopContainerStats([id]).catch(() => {})
    }
  }, [id, running])
  return { element, samples }
}
