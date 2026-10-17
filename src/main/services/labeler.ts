import fs from 'fs'
import path from 'path'
import rules from './labels.json'

const compiled = rules.map((rule) => ({ ...rule, expression: new RegExp(rule.pattern, 'i') }))
const cache = new Map<string, { at: number; scripts: Record<string, string> }>()
function projectScripts(root: string): Record<string, string> {
  const cached = cache.get(root)
  if (cached && Date.now() - cached.at < 10_000) return cached.scripts
  let scripts: Record<string, string> = {}
  try {
    const file = path.join(root, 'package.json')
    if (fs.statSync(file).size <= 65_536) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (raw.scripts && typeof raw.scripts === 'object') scripts = raw.scripts
    }
  } catch {
    /* Project metadata is optional. */
  }
  if (cache.size > 500) cache.clear()
  cache.set(root, { at: Date.now(), scripts })
  return scripts
}
export function labelCommand(
  executable: string,
  command: string,
  scripts: Record<string, string> = {}
): string {
  const direct = compiled.find((rule) => rule.expression.test(command))
  if (direct) return direct.label
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(executable)) {
    const script = command.match(/\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([\w:-]+)/)?.[1]
    const expanded = script && scripts[script]
    if (typeof expanded === 'string')
      return compiled.find((rule) => rule.expression.test(expanded))?.label || executable
  }
  return executable
}
export function labelProcess(executable: string, command: string, root: string | null): string {
  return labelCommand(executable, command, root ? projectScripts(root) : {})
}
