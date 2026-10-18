import React, { useState } from 'react'
import type { Proc, ProcessTreeNode } from '../../../shared/types'
import { buildProcessTree, descendantsChildrenFirst } from '../../../shared/processTree'
import { VirtualList } from './VirtualList'
import { ProcessRow } from './ProcessRow'
import { ProjectHeading } from './ProjectGroup'
type Row = {
  key: string
  proc?: Proc
  depth?: number
  children?: number
  group?: { name: string; path: string | null; processes: Proc[] }
}
export function VirtualProcesses({
  groups,
  processes,
  allProcesses,
  tree,
  onStop,
  onStopProject,
  onStopTree
}: {
  groups: { name: string; path: string | null; processes: Proc[] }[]
  processes: Proc[]
  allProcesses: Proc[]
  tree: boolean
  onStop: (proc: Proc) => void
  onStopProject: (project: string, procs: Proc[]) => void
  onStopTree: (root: Proc, targets: Proc[]) => void
}): React.ReactElement {
  const [collapsed, setCollapsed] = useState(new Set<number>())
  const rows: Row[] = []
  if (tree) {
    const visit = (node: ProcessTreeNode, depth: number): void => {
      rows.push({
        key: `p:${node.process.pid}:${node.process.startTime}`,
        proc: node.process,
        depth,
        children: node.children.length
      })
      if (!collapsed.has(node.process.pid))
        node.children.forEach((child) => visit(child, depth + 1))
    }
    buildProcessTree(processes).forEach((node) => visit(node, 0))
  } else
    for (const group of groups) {
      rows.push({ key: `g:${group.name}`, group })
      for (const proc of group.processes)
        rows.push({ key: `p:${proc.pid}:${proc.startTime}`, proc })
    }
  return (
    <VirtualList
      items={rows}
      itemKey={(row) => row.key}
      render={(row) =>
        row.group ? (
          <ProjectHeading
            projectName={row.group.name}
            projectPath={row.group.path}
            processes={row.group.processes}
            onStopProject={row.group.name === 'Tunnels' ? undefined : onStopProject}
          />
        ) : (
          <div
            style={{ paddingInlineStart: `calc(var(--space-4) * ${Math.min(row.depth || 0, 12)})` }}
          >
            {tree && (
              <span className="mono">
                Depth {row.depth} · {row.proc!.project}{' '}
                {Boolean(row.children) && (
                  <button
                    className="quiet-btn"
                    aria-expanded={!collapsed.has(row.proc!.pid)}
                    onClick={() =>
                      setCollapsed((old) => {
                        const next = new Set(old)
                        if (next.has(row.proc!.pid)) next.delete(row.proc!.pid)
                        else next.add(row.proc!.pid)
                        return next
                      })
                    }
                  >
                    {collapsed.has(row.proc!.pid) ? 'Show children' : 'Hide children'}
                  </button>
                )}
              </span>
            )}
            <ProcessRow proc={row.proc!} onStop={onStop} />
            {tree && row.proc!.manageable !== false && (
              <button
                className="quiet-btn"
                onClick={() =>
                  onStopTree(row.proc!, descendantsChildrenFirst(allProcesses, row.proc!.pid))
                }
              >
                Stop tree
              </button>
            )}
          </div>
        )
      }
    />
  )
}
