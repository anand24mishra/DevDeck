import type { Proc, ProcessTreeNode } from '../../../shared/types'
import { buildProcessTree, descendantsChildrenFirst } from '../../../shared/processTree'
import { ProcessRow } from './ProcessRow'

type Props = {
  processes: Proc[]
  allProcesses: Proc[]
  onStop: (proc: Proc) => void
  onStopTree: (root: Proc, targets: Proc[]) => void
}
function Branch({
  node,
  allProcesses,
  onStop,
  onStopTree
}: Omit<Props, 'processes'> & { node: ProcessTreeNode }): React.JSX.Element {
  return (
    <details open className="process-tree">
      <summary>
        {node.process.name} · {node.process.project} · {node.children.length} direct children
      </summary>
      <ProcessRow proc={node.process} onStop={onStop} />
      <button
        className="quiet-btn"
        onClick={() =>
          onStopTree(node.process, descendantsChildrenFirst(allProcesses, node.process.pid))
        }
      >
        Stop tree
      </button>
      <div className="tree-children">
        {node.children.map((child) => (
          <Branch
            key={`${child.process.pid}:${child.process.startTime}`}
            node={child}
            allProcesses={allProcesses}
            onStop={onStop}
            onStopTree={onStopTree}
          />
        ))}
      </div>
    </details>
  )
}
export function ProcessTreeView({ processes, ...props }: Props): React.JSX.Element {
  return (
    <section aria-label="Process tree">
      {buildProcessTree(processes).map((node) => (
        <Branch key={`${node.process.pid}:${node.process.startTime}`} node={node} {...props} />
      ))}
    </section>
  )
}
