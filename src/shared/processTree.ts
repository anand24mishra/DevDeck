import type { Proc, ProcessTreeNode } from './types'

export function descendantsChildrenFirst(processes: Proc[], pid: number): Proc[] {
  const seen = new Set<number>(),
    ordered: Proc[] = []
  const visit = (id: number): void => {
    if (seen.has(id)) return
    seen.add(id)
    for (const child of processes.filter((proc) => proc.ppid === id).sort((a, b) => a.pid - b.pid))
      visit(child.pid)
    const proc = processes.find((item) => item.pid === id)
    if (proc) ordered.push(proc)
  }
  visit(pid)
  return ordered
}
export function buildProcessTree(processes: Proc[]): ProcessTreeNode[] {
  const byPid = new Map(processes.map((proc) => [proc.pid, proc]))
  const visited = new Set<number>()
  const node = (proc: Proc): ProcessTreeNode => {
    visited.add(proc.pid)
    return {
      process: proc,
      children: processes
        .filter((child) => child.ppid === proc.pid && !visited.has(child.pid))
        .map(node)
    }
  }
  const roots = processes
    .filter((proc) => !byPid.has(proc.ppid) || proc.pid === proc.ppid)
    .map(node)
  for (const proc of processes) if (!visited.has(proc.pid)) roots.push(node(proc))
  return roots
}
