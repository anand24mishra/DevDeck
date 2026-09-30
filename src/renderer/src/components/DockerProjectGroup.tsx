import React, { useState } from 'react'
import { Container } from '../../../shared/types'
import { DockerContainerRow } from './DockerContainerRow'

interface DockerProjectGroupProps {
  projectName: string
  containers: Container[]
  onAction: (id: string, action: 'start' | 'stop' | 'restart') => void
  onStopProject: (projectName: string, containers: Container[]) => void
  onViewLogs: (container: Container) => void
  actionLoadingId: string | null
}

export const DockerProjectGroup: React.FC<DockerProjectGroupProps> = ({
  projectName,
  containers,
  onAction,
  onStopProject,
  onViewLogs,
  actionLoadingId
}) => {
  const [collapsed, setCollapsed] = useState(false)

  const runningCount = containers.filter((c) => c.state === 'running').length
  const totalCount = containers.length

  return (
    <div className="project-group">
      <div className="project-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="project-header-left">
          <span className={`collapse-chevron ${collapsed ? 'collapsed' : ''}`} aria-hidden="true">
            ▼
          </span>
          <span className="project-name">{projectName}</span>
          <span className="project-badge mono">
            {runningCount}/{totalCount} running
          </span>
        </div>

        <div className="project-header-right" onClick={(e) => e.stopPropagation()}>
          {runningCount > 0 && (
            <button
              type="button"
              className="stop-project-btn"
              onClick={() => onStopProject(projectName, containers)}
              title={`Stop all running containers in ${projectName}`}
            >
              Stop stack
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="project-rows">
          {containers.map((container) => (
            <DockerContainerRow
              key={container.id}
              container={container}
              onAction={onAction}
              onViewLogs={onViewLogs}
              loading={actionLoadingId === container.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
