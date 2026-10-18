import React from 'react'
import type { Container } from '../../../shared/types'
import { VirtualList } from './VirtualList'
import { DockerContainerRow } from './DockerContainerRow'
type Row = { key: string; container?: Container; group?: { name: string; containers: Container[] } }
export function VirtualContainers({
  groups,
  onAction,
  onRemove,
  onProject,
  onLogs,
  loadingId
}: {
  groups: { name: string; containers: Container[] }[]
  onAction: (id: string, action: 'start' | 'stop' | 'restart') => void
  onRemove: (c: Container) => void
  onProject: (name: string, containers: Container[], action: 'start' | 'stop' | 'restart') => void
  onLogs: (c: Container) => void
  loadingId: string | null
}): React.ReactElement {
  const rows: Row[] = groups.flatMap((group) => [
    { key: `g:${group.name}`, group },
    ...group.containers.map((container) => ({ key: container.id, container }))
  ])
  return (
    <VirtualList
      items={rows}
      itemKey={(row) => row.key}
      render={(row) =>
        row.container ? (
          <DockerContainerRow
            container={row.container}
            onAction={onAction}
            onRemove={onRemove}
            onViewLogs={onLogs}
            loading={loadingId === row.container.id}
          />
        ) : (
          <div className="project-group-header">
            <h2>{row.group!.name}</h2>
            <span>{row.group!.containers.length} containers</span>
            {row.group!.containers.some((c) => c.project) &&
              (['start', 'stop', 'restart'] as const).map((action) => (
                <button
                  key={action}
                  className="quiet-btn"
                  onClick={() => onProject(row.group!.name, row.group!.containers, action)}
                >
                  {action[0].toUpperCase() + action.slice(1)} stack
                </button>
              ))}
          </div>
        )
      }
    />
  )
}
