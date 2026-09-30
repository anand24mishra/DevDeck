import React from 'react'
import { Proc } from '../../../shared/types'
import { ProcessRow } from './ProcessRow'

interface ProjectGroupProps {
  projectName: string
  projectPath: string | null
  processes: Proc[]
  onStopProcess?: (proc: Proc) => void
  onStopProject?: (project: string, procs: Proc[]) => void
}

export const ProjectGroup: React.FC<ProjectGroupProps> = ({
  projectName,
  projectPath,
  processes,
  onStopProcess,
  onStopProject
}) => {
  return (
    <section className="project-group" aria-label={`Project ${projectName}`}>
      <div className="project-group-header">
        <div className="project-title-area">
          <svg
            className="folder-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <h2 className="project-name">{projectName}</h2>
          {projectPath && (
            <span className="project-path mono" title={projectPath}>
              {projectPath.replace(/^\/Users\/[^/]+/, '~')}
            </span>
          )}
        </div>

        <div className="project-meta">
          <span className="process-count-badge mono">
            {processes.length} {processes.length === 1 ? 'proc' : 'procs'}
          </span>
          {onStopProject && processes.length > 0 && (
            <button
              type="button"
              className="project-stop-btn"
              onClick={() => onStopProject(projectName, processes)}
            >
              Stop project
            </button>
          )}
        </div>
      </div>

      <div className="table-column-headers mono" aria-hidden="true">
        <div className="col col-state">STATE</div>
        <div className="col col-name">PROCESS</div>
        <div className="col col-ports">PORT</div>
        <div className="col col-cpu">CPU</div>
        <div className="col col-mem">MEMORY</div>
        <div className="col col-uptime">UPTIME</div>
        <div className="col col-action">DETAILS</div>
      </div>

      <div className="process-rows-list">
        {processes.map((proc) => (
          <ProcessRow key={proc.pid} proc={proc} onStop={onStopProcess} />
        ))}
      </div>
    </section>
  )
}
