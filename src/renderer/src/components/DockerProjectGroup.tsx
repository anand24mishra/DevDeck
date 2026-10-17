import React, { useState } from 'react'
import { Container } from '../../../shared/types'
import { DockerContainerRow } from './DockerContainerRow'

interface DockerProjectGroupProps {
  projectName: string
  containers: Container[]
  onAction: (id: string, action: 'start' | 'stop' | 'restart') => void
  onRemove: (container: Container) => void
  onStartProject: (name: string, containers: Container[]) => void
  onRestartProject: (name: string, containers: Container[]) => void
  onStopProject: (projectName: string, containers: Container[]) => void
  onViewLogs: (container: Container) => void
  actionLoadingId: string | null
}

export const DockerProjectGroup: React.FC<DockerProjectGroupProps> = ({
  projectName,
  containers,
  onAction,
  onStopProject,
  onStartProject,
  onRestartProject,
  onRemove,
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
          {containers.some((item) => item.project) && (
            <>
              <button className="quiet-btn" onClick={() => onStartProject(projectName, containers)}>
                Start stack
              </button>
              <button
                className="quiet-btn"
                onClick={() => onRestartProject(projectName, containers)}
              >
                Restart stack
              </button>
            </>
          )}
          {runningCount > 0 && containers.some((item) => item.project) && (
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
              onRemove={onRemove}
              loading={actionLoadingId === container.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
