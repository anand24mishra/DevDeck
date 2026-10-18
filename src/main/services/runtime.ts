import fs from 'fs/promises'
import path from 'path'

async function text(root: string, file: string): Promise<string> {
  try {
    const target = path.join(root, file)
    if ((await fs.stat(target)).size > 65536) return ''
    return await fs.readFile(target, 'utf8')
  } catch {
    return ''
  }
}
export async function runtimeHints(root: string): Promise<string[]> {
  const [nvm, nodeVersion, packageText, python, virtualenv, go, rustToml, rust, java, sdkman] =
    await Promise.all(
      [
        '.nvmrc',
        '.node-version',
        'package.json',
        '.python-version',
        '.venv/pyvenv.cfg',
        'go.mod',
        'rust-toolchain.toml',
        'rust-toolchain',
        '.java-version',
        '.sdkmanrc'
      ].map((file) => text(root, file))
    )
  const hints: string[] = []
  const short = (value: string): string => value.trim().split('\n')[0].slice(0, 100)
  let node = short(nvm || nodeVersion)
  if (!node)
    try {
      const raw = JSON.parse(packageText)
      if (typeof raw.engines?.node === 'string') node = short(raw.engines.node)
    } catch {
      /* Optional metadata. */
    }
  if (node) hints.push(`Node requested: ${node}`)
  if (python) hints.push(`Python requested: ${short(python)}`)
  if (virtualenv)
    hints.push(
      `Python virtualenv: .venv${virtualenv.match(/^version\s*=\s*([\d.]+)/m)?.[1] ? ` (${virtualenv.match(/^version\s*=\s*([\d.]+)/m)![1]})` : ''}`
    )
  const goVersion = go.match(/^go\s+([\d.]+)\s*$/m)?.[1]
  if (goVersion) hints.push(`Go requested: ${goVersion}`)
  const rustVersion =
    rustToml.match(/^\s*channel\s*=\s*["']([^"']{1,100})["']/m)?.[1] || short(rust)
  if (rustVersion) hints.push(`Rust toolchain: ${rustVersion}`)
  const javaVersion = short(java) || sdkman.match(/^java=([^\n]{1,100})$/m)?.[1]
  if (javaVersion) hints.push(`Java requested: ${javaVersion}`)
  return hints
}
