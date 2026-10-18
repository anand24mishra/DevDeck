export function redactLog(text: string): string {
  const plain = stripAnsi(text)
  const hidden = plain
    .replace(
      /(["']?[\w-]*(?:password|passwd|secret|token|api[_-]?key|access[_-]?key)[\w-]*["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi,
      '$1"[hidden]"'
    )
    .replace(/(["']?authorization["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\n,;}]+)/gi, '$1[hidden]')
    .replace(/((?:Bearer|Basic)\s+)[\w.+/=-]+/gi, '$1[hidden]')
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1[hidden]@')
  return hidden === plain ? text : hidden
}
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|$))/g, '')
}
export function ansiSegments(text: string): { text: string; color?: string }[] {
  // eslint-disable-next-line no-control-regex
  const pattern = /\x1b\[([0-9;]*)m/g
  const segments: { text: string; color?: string }[] = []
  const colors: Record<number, string> = {
    30: 'var(--muted)',
    31: 'var(--danger)',
    32: 'var(--accent)',
    33: 'var(--warn)',
    34: 'var(--accent)',
    35: 'var(--accent)',
    36: 'var(--accent)',
    37: 'var(--text)'
  }
  let from = 0,
    color: string | undefined,
    match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    segments.push({ text: stripAnsi(text.slice(from, match.index)), color })
    for (const code of (match[1] || '0').split(';').map(Number)) {
      if (code === 0 || code === 39) color = undefined
      else if (colors[code]) color = colors[code]
    }
    from = pattern.lastIndex
  }
  segments.push({ text: stripAnsi(text.slice(from)), color })
  return segments
}
export class LogRing {
  lines: string[] = []
  partial = ''
  private bytes = 0
  append(text: string): void {
    const parts = (this.partial + text).slice(-2097152).split('\n')
    this.partial = (parts.pop() || '').slice(-16384)
    for (const line of parts) {
      const clipped = line.slice(0, 16384)
      this.lines.push(clipped)
      this.bytes += clipped.length * 2
    }
    while (this.lines.length > 5000 || this.bytes > 2097152) {
      this.bytes -= (this.lines.shift()?.length || 0) * 2
    }
  }
  clear(): void {
    this.lines = []
    this.partial = ''
    this.bytes = 0
  }
  get size(): number {
    return this.bytes + this.partial.length * 2
  }
  read(): string[] {
    return [...this.lines, ...(this.partial ? [this.partial] : [])].map(redactLog)
  }
}
