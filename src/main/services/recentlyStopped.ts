import { app, safeStorage as electronSafeStorage } from 'electron'
import fs from 'fs'
import path from 'path'
import { spawn as defaultSpawn, ChildProcess } from 'child_process'
import { Proc, RecentlyStoppedItem, Result } from '../../shared/types'
import { isProcessAllowed, FilterProcessOptions } from '../security/allowlist'
import { parseCommandLine } from '../utils/command'

export type SpawnFunction = (
  command: string,
  args: string[],
  options: { cwd?: string; detached?: boolean; stdio?: string; env?: NodeJS.ProcessEnv }
) => ChildProcess

export interface RecentlyStoppedDeps {
  filePath?: string
  spawn?: SpawnFunction
  safeStorage?: {
    isEncryptionAvailable: () => boolean
    encryptString: (plain: string) => Buffer
    decryptString: (encrypted: Buffer) => string
  }
}

export class RecentlyStoppedService {
  private items: RecentlyStoppedItem[] = []
  private filePath: string
  private spawnFn: SpawnFunction
  private storage?: {
    isEncryptionAvailable: () => boolean
    encryptString: (plain: string) => Buffer
    decryptString: (encrypted: Buffer) => string
  }
  private listeners: (() => void)[] = []

  constructor(deps: RecentlyStoppedDeps = {}) {
    if (deps.filePath) {
      this.filePath = deps.filePath
    } else {
      try {
        this.filePath = path.join(app.getPath('userData'), 'recently_stopped.enc')
      } catch {
        this.filePath = path.join(process.cwd(), '.recently_stopped.enc')
      }
    }

    this.spawnFn = deps.spawn || (defaultSpawn as SpawnFunction)
    this.storage = deps.safeStorage || electronSafeStorage
  }

  public getItems(): RecentlyStoppedItem[] {
    return [...this.items]
  }

  public getItem(id: string): RecentlyStoppedItem | undefined {
    return this.items.find((item) => item.id === id)
  }

  public loadIfPersisted(enabled: boolean): void {
    if (!enabled) return
    try {
      if (fs.existsSync(this.filePath)) {
        const encrypted = fs.readFileSync(this.filePath)
        if (this.storage && this.storage.isEncryptionAvailable()) {
          const decrypted = this.storage.decryptString(encrypted)
          const parsed = JSON.parse(decrypted)
          if (Array.isArray(parsed)) {
            this.items = parsed.slice(0, 20)
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load persisted recently stopped processes:', err)
    }
  }

  public saveIfPersisted(enabled: boolean): void {
    if (!enabled) {
      try {
        if (fs.existsSync(this.filePath)) {
          fs.unlinkSync(this.filePath)
        }
      } catch {
        // ignore
      }
      return
    }

    try {
      if (this.storage && this.storage.isEncryptionAvailable()) {
        const json = JSON.stringify(this.items)
        const encrypted = this.storage.encryptString(json)
        fs.writeFileSync(this.filePath, encrypted)
      }
    } catch (err) {
      console.warn('Failed to save persisted recently stopped processes:', err)
    }
  }

  public recordStopped(procs: Proc[], persistEnabled: boolean): void {
    if (!procs || procs.length === 0) return

    const now = Date.now()
    const envKeys = Object.keys(process.env).sort()

    for (const proc of procs) {
      const { args } = parseCommandLine(proc.command)
      const newItem: RecentlyStoppedItem = {
        id: `${proc.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: proc.name,
        command: proc.command,
        args,
        cwd: proc.cwd,
        project: proc.project,
        stoppedAt: now,
        envKeys
      }

      // Prepend and filter duplicate entries with same command and cwd
      this.items = [
        newItem,
        ...this.items.filter(
          (item) => !(item.command === newItem.command && item.cwd === newItem.cwd)
        )
      ].slice(0, 20)
    }

    this.saveIfPersisted(persistEnabled)
    this.notifyListeners()
  }

  public clear(persistEnabled: boolean): void {
    this.items = []
    this.saveIfPersisted(persistEnabled)
    this.notifyListeners()
  }

  public async restart(
    id: string,
    filterOptions: FilterProcessOptions = {}
  ): Promise<Result<{ pid?: number }>> {
    const item = this.getItem(id)
    if (!item) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Item not found in recently stopped' }
      }
    }

    // Safety allowlist check: Never restart anything refused by the allowlist
    const check = isProcessAllowed(99999, item.command, filterOptions)
    if (!check.allowed) {
      return {
        ok: false,
        error: { code: 'DENIED', message: check.reason || 'Process disallowed by safety policy' }
      }
    }

    const { executable, args } = parseCommandLine(item.command)
    if (!executable) {
      return { ok: false, error: { code: 'INVALID_INPUT', message: 'Invalid command' } }
    }

    // Validate working directory safety and existence
    let targetCwd: string | undefined = process.env.HOME || undefined
    if (item.cwd) {
      const trimmedCwd = item.cwd.trim()
      if (!fs.existsSync(trimmedCwd)) {
        return {
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: `Working directory does not exist: ${trimmedCwd}`
          }
        }
      }
      try {
        const stat = fs.statSync(trimmedCwd)
        if (!stat.isDirectory()) {
          return {
            ok: false,
            error: {
              code: 'INVALID_INPUT',
              message: `Working directory is not a directory: ${trimmedCwd}`
            }
          }
        }
      } catch {
        return {
          ok: false,
          error: { code: 'DENIED', message: `Cannot access working directory: ${trimmedCwd}` }
        }
      }

      // Restrict system directory execution
      if (['/System', '/usr', '/bin', '/sbin'].some((p) => trimmedCwd.startsWith(p))) {
        return {
          ok: false,
          error: {
            code: 'DENIED',
            message: `Execution restricted in system directory: ${trimmedCwd}`
          }
        }
      }
      targetCwd = trimmedCwd
    }

    return new Promise((resolve) => {
      let settled = false

      try {
        const child = this.spawnFn(executable, args, {
          cwd: targetCwd,
          detached: true,
          stdio: 'ignore',
          env: process.env
        })

        child.on('error', (err: Error) => {
          if (!settled) {
            settled = true
            resolve({
              ok: false,
              error: { code: 'INTERNAL', message: `Spawn failed: ${err.message}` }
            })
          }
        })

        child.on('exit', (code) => {
          if (!settled && code !== null && code !== 0) {
            settled = true
            resolve({
              ok: false,
              error: { code: 'INTERNAL', message: `Process exited immediately with code ${code}` }
            })
          }
        })

        setTimeout(() => {
          if (!settled) {
            settled = true
            if (typeof child.unref === 'function') {
              child.unref()
            }
            resolve({ ok: true, data: { pid: child.pid } })
          }
        }, 100)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to spawn process'
        resolve({ ok: false, error: { code: 'INTERNAL', message } })
      }
    })
  }

  public onChanged(listener: () => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (err) {
        console.error('Error in recentlyStopped listener:', err)
      }
    }
  }
}

export const recentlyStoppedService = new RecentlyStoppedService()
