import fs from 'fs'
import path from 'path'
/** Only regular, bounded, non-symlink metadata inside the canonical project. */
export function readMetadata(root: string, relative: string, max = 65536): string {
  let descriptor: number | undefined
  try {
    const canonical = fs.realpathSync(root),
      file = path.resolve(canonical, relative)
    if (!file.startsWith(canonical + path.sep) || fs.realpathSync(file) !== file) return ''
    descriptor = fs.openSync(
      file,
      fs.constants.O_RDONLY | fs.constants.O_NONBLOCK | fs.constants.O_NOFOLLOW
    )
    const stat = fs.fstatSync(descriptor)
    if (!stat.isFile() || stat.size > max) return ''
    const buffer = Buffer.alloc(max + 1),
      bytes = fs.readSync(descriptor, buffer, 0, buffer.length, 0)
    return bytes > max ? '' : buffer.subarray(0, bytes).toString('utf8')
  } catch {
    return ''
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor)
  }
}
export const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'go.mod',
  'Cargo.toml',
  'pyproject.toml',
  '.devdeck.json'
]
export function hasProjectMarker(root: string): boolean {
  return PROJECT_MARKERS.some((marker) => fs.existsSync(path.join(root, marker)))
}
