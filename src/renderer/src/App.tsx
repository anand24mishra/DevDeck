import React, { useState, useMemo } from 'react'
import { Proc } from '../../shared/types'
import { useProcesses } from './hooks/useProcesses'
import { Header } from './components/Header'
import { ProjectGroup } from './components/ProjectGroup'
import { EmptyState } from './components/EmptyState'
import { LoadingState } from './components/LoadingState'
import { ErrorState } from './components/ErrorState'

interface GroupedProject {
  name: string
  path: string | null
  processes: Proc[]
}

const App: React.FC = () => {
  const { procs, settings, loading, error, refresh, changeInterval } = useProcesses()

  const [searchQuery, setSearchQuery] = useState<string>('')

  // Filter processes based on search query (name, port, project)
  const filteredProcesses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return procs

    return procs.filter((proc) => {
      const matchName = proc.name.toLowerCase().includes(q)
      const matchProject = proc.project.toLowerCase().includes(q)
      const matchPorts = proc.ports.some((port) => port.toString().includes(q))
      return matchName || matchProject || matchPorts
    })
  }, [procs, searchQuery])

  // Group processes by project
  const groupedProjects = useMemo(() => {
    const map = new Map<string, GroupedProject>()

    for (const proc of filteredProcesses) {
      const key = proc.project || 'Other'
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          path: proc.projectPath,
          processes: []
        })
      }
      map.get(key)!.processes.push(proc)
    }

    return Array.from(map.values())
  }, [filteredProcesses])

  const totalProjects = useMemo(() => {
    const unique = new Set(procs.map((p) => p.project))
    return unique.size
  }, [procs])

  return (
    <div className="app-container">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalCount={procs.length}
        projectCount={totalProjects}
        settings={settings}
        onIntervalChange={changeInterval}
        onRefresh={refresh}
        loading={loading}
      />

      <main className="app-content" tabIndex={-1}>
        {loading && procs.length === 0 ? (
          <LoadingState />
        ) : error && procs.length === 0 ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : procs.length === 0 ? (
          <EmptyState />
        ) : filteredProcesses.length === 0 ? (
          <EmptyState searchQuery={searchQuery} onClearSearch={() => setSearchQuery('')} />
        ) : (
          <div className="project-groups-list">
            {groupedProjects.map((group) => (
              <ProjectGroup
                key={group.name}
                projectName={group.name}
                projectPath={group.path}
                processes={group.processes}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
