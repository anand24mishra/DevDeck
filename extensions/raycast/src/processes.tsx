import {
  Action,
  ActionPanel,
  List,
  Toast,
  showToast,
  getPreferenceValues,
  openCommandPreferences
} from '@raycast/api'
import { useState, useEffect, useCallback } from 'react'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
interface ProcessRow {
  pid: number
  name: string
  project: string
  ports: number[]
}
async function cli(args: string[]): Promise<string> {
  const { cliPath } = getPreferenceValues<{ cliPath: string }>()
  if (!path.isAbsolute(cliPath))
    throw new Error('Choose an absolute DevDeck CLI path in extension preferences.')
  return (await promisify(execFile)(cliPath, args, { timeout: 35000, maxBuffer: 4194304 })).stdout
}
export default function Command(): React.JSX.Element {
  const [items, setItems] = useState<ProcessRow[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setItems(JSON.parse(await cli(['ls', '--json'])))
      setError('')
    } catch {
      setError('Open DevDeck and check the CLI path in extension preferences.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  const stop = async (item: ProcessRow): Promise<void> => {
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: 'Confirm the stop in DevDeck'
    })
    try {
      const report = JSON.parse(await cli(['stop', `pid:${item.pid}`, '--json']))
      toast.style =
        report.refused?.length || report.stillRunning?.length
          ? Toast.Style.Failure
          : Toast.Style.Success
      toast.title = report.cancelled
        ? 'Stop cancelled'
        : `${report.stopped.length} stopped, ${report.refused.length} skipped`
      void refresh()
    } catch {
      toast.style = Toast.Style.Failure
      toast.title = 'The stop could not complete. Check DevDeck.'
    }
  }
  return (
    <List isLoading={loading} searchBarPlaceholder="Search process, project or port">
      <List.EmptyView
        title={error || 'No development processes'}
        description={
          error
            ? 'DevDeck must be running in the menu bar.'
            : 'Start a development server or refresh.'
        }
        actions={
          <ActionPanel>
            <Action title="Refresh" onAction={refresh} />
            <Action title="Extension Preferences" onAction={openCommandPreferences} />
          </ActionPanel>
        }
      />
      {items.map((item) => (
        <List.Item
          key={item.pid}
          title={item.name}
          subtitle={item.project}
          keywords={[String(item.pid), ...item.ports.map(String)]}
          accessories={[{ text: item.ports.join(', ') || String(item.pid) }]}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser
                title="Show in DevDeck"
                url={`devdeck://project/${encodeURIComponent(item.project)}`}
              />
              {item.ports
                .filter((port) => Number.isInteger(port) && port > 0 && port <= 65535)
                .map((port) => (
                  <Action.OpenInBrowser
                    key={port}
                    title={`Open Localhost:${port}`}
                    url={`http://localhost:${port}`}
                  />
                ))}
              <Action title="Stop…" style={Action.Style.Destructive} onAction={() => stop(item)} />
              <Action title="Refresh" onAction={refresh} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  )
}
