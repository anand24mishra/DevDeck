import { ProjectHistory } from './ProjectHistory'
import { processTotals } from '../utils/processes'
import React, { useEffect, useState } from 'react'
import { Proc, ProjectContext } from '../../../shared/types'
import { ProjectActions } from './ProjectActions'
import { ProcessRow } from './ProcessRow'

interface ProjectGroupProps {
  projectName: string
  projectPath: string | null
  processes: Proc[]
  onStopProcess?: (proc: Proc) => void
  onStopProject?: (project: string, procs: Proc[]) => void
}

export const ProjectHeading: React.FC<ProjectGroupProps> = ({
  projectName,
  projectPath,
  processes,
  onStopProject
}) => {
  const [profileStatus, setProfileStatus] = useState('')
  const [context, setContext] = useState<ProjectContext>({})
  useEffect(() => {
    let active = true
    const read = (): void => {
      if (projectPath && !document.hidden)
        void window.api
          .getProjectContext(projectPath)
          .then((result) => {
            if (active && result.ok) setContext(result.data)
          })
          .catch(() => {})
    }
    read()
    const timer = setInterval(read, 10_000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [projectPath])
  const totals = processTotals(processes)
  return (
    <>
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
          {context.branch && (
            <span className="mono">
              {context.branch}
              {context.dirty ? ' · Modified' : ''}
            </span>
          )}
          {projectPath && (
            <span className="project-path mono" title={projectPath}>
              {projectPath.replace(/^\/Users\/[^/]+/, '~')}
            </span>
          )}
        </div>

        <div className="project-meta">
          <span className="mono">
            {totals.memMB} MB · {totals.cpu.toFixed(1)}% CPU
          </span>
          <span className="process-count-badge mono">
            {processes.length} {processes.length === 1 ? 'process' : 'processes'}
          </span>
          {projectPath && (
            <details className="actions-disclosure">
              <summary>Project actions</summary>
              <div className="action-options">
                <ProjectActions path={projectPath} />
                <button
                  className="quiet-btn"
                  onClick={() => {
                    void window.api
                      .profileFromProject(projectPath)
                      .then((r) =>
                        setProfileStatus(
                          r.ok
                            ? 'Profile review finished. Find saved stacks in Profiles.'
                            : r.error.message
                        )
                      )
                  }}
                >
                  Save as profile
                </button>
                <button
                  className="quiet-btn"
                  onClick={() => {
                    void window.api
                      .importRepoConfig(projectPath)
                      .then((r) =>
                        setProfileStatus(
                          r.ok
                            ? 'Repository review finished. Find approved stacks in Profiles.'
                            : r.error.message
                        )
                      )
                  }}
                >
                  Import .devdeck.json
                </button>
              </div>
            </details>
          )}
          {profileStatus && <span role="status">{profileStatus}</span>}
          {onStopProject && processes.some((proc) => proc.manageable !== false) && (
            <button
              type="button"
              className="project-stop-btn"
              onClick={() =>
                onStopProject(
                  projectName,
                  processes.filter((proc) => proc.manageable !== false)
                )
              }
            >
              Stop project
            </button>
          )}
        </div>
      </div>

      <ProjectHistory project={projectName} />
      <div className="table-column-headers mono" aria-hidden="true">
        <div className="col col-state">STATE</div>
        <div className="col col-name">PROCESS</div>
        <div className="col col-ports">PORT</div>
        <div className="col col-cpu">CPU</div>
        <div className="col col-mem">MEMORY</div>
        <div className="col col-uptime">UPTIME</div>
        <div className="col col-action">DETAILS</div>
      </div>
    </>
  )
}
export const ProjectGroup: React.FC<ProjectGroupProps> = (props) => (
  <section className="project-group" aria-label={`Project ${props.projectName}`}>
    <ProjectHeading {...props} />
    <div className="process-rows-list">
      {props.processes.map((proc) => (
        <ProcessRow
          key={`${proc.pid}:${proc.startTime}`}
          proc={proc}
          onStop={props.onStopProcess}
        />
      ))}
    </div>
  </section>
)
