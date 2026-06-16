import React, { useEffect, useRef, useState } from 'react'
import { Panel, SectionHeader } from '../components/Panel'
import { IndexingStatusList } from '../components/IndexingStatusList'
import { useStatus } from '../app/StatusContext'

const readmeUrl = 'https://github.com/DavidBelicza/Magentic/blob/main/README.md'

type AppSettings = {
  phpVersion: string
  projectRoot: string
  sourceSubpaths: string[]
  watcherEnabled: boolean
}

type ConfigResponse = {
  settings: AppSettings
  mountPath: string
  phpVersionOptions: string[]
}

export const SettingsView: React.FC = () => {
  return (
    <section className="grid min-h-full grid-cols-1 gap-5 xl:grid-cols-2">
      <ConfigSection />
      <IndexingSection />
      <McpSection />
    </section>
  )
}

const IndexingSection: React.FC = () => {
  const status = useStatus()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [watcherOverride, setWatcherOverride] = useState<boolean | null>(null)
  const wasRunning = useRef(false)

  const running = (status?.indexing.inProgress ?? 0) > 0 || (status?.indexing.locked ?? false)

  useEffect(() => {
    if (wasRunning.current && !running) {
      setMessage(null)
    }
    wasRunning.current = running
  }, [running])

  const watcherEnabled = watcherOverride ?? status?.watcherEnabled ?? null

  useEffect(() => {
    if (watcherOverride !== null && status?.watcherEnabled === watcherOverride) {
      setWatcherOverride(null)
    }
  }, [status?.watcherEnabled, watcherOverride])

  const toggleWatcher = (enabled: boolean) => {
    setWatcherOverride(enabled)
    void fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watcherEnabled: enabled })
    }).catch(() => undefined)
  }

  const run = (endpoint: string, label: string) => {
    if (!window.confirm(`Start ${label}? This runs against the configured source.`)) {
      return
    }

    setBusy(true)
    setMessage(null)
    fetch(endpoint, { method: 'POST' })
      .then((response) => response.json())
      .then((data) => setMessage(data.ok ? `${label} started.` : data.error ?? `${label} failed.`))
      .catch(() => setMessage(`${label} failed.`))
      .finally(() => setBusy(false))
  }

  return (
    <Panel className="p-5">
      <SectionHeader title="Indexing Pipeline" />
      <div className="mt-5">
        <IndexingStatusList items={status?.indexing.items ?? []} locked={status?.indexing.locked ?? false} />

        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton label="Reindex" disabled={busy || running} onClick={() => run('/api/graph/index/reindex', 'reindex')} />
          <ActionButton
            label="Reset & reindex"
            disabled={busy || running}
            onClick={() => run('/api/graph/index/reset-and-reindex', 'reset and reindex')}
          />
        </div>
        {message ? <p className="mt-3 text-xs text-[#6b7280]">{message}</p> : null}

        <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5">
          <span className="text-sm text-[#4b5563]">File watcher (auto-reindex on change)</span>
          <input
            type="checkbox"
            checked={watcherEnabled ?? false}
            disabled={watcherEnabled === null}
            onChange={(event) => toggleWatcher(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[#00a85a]"
          />
        </label>
      </div>
    </Panel>
  )
}

const ConfigSection: React.FC = () => {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [phpVersion, setPhpVersion] = useState('8.4')
  const [projectRoot, setProjectRoot] = useState('')
  const [sourceSubpaths, setSourceSubpaths] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const applySettings = (settings: AppSettings) => {
    setPhpVersion(settings.phpVersion)
    setProjectRoot(settings.projectRoot)
    setSourceSubpaths(settings.sourceSubpaths.length > 0 ? settings.sourceSubpaths : [''])
  }

  useEffect(() => {
    fetch('/api/config')
      .then((response) => response.json())
      .then((data: ConfigResponse) => {
        setConfig(data)
        applySettings(data.settings)
      })
      .catch(() => setConfig(null))
  }, [])

  const updateSubpath = (index: number, value: string) => {
    setSourceSubpaths((current) => current.map((entry, position) => (position === index ? value : entry)))
  }

  const removeSubpath = (index: number) => {
    setSourceSubpaths((current) => current.filter((_, position) => position !== index))
  }

  const save = () => {
    setSaving(true)
    setMessage(null)
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phpVersion,
        projectRoot,
        sourceSubpaths: sourceSubpaths.map((entry) => entry.trim()).filter((entry) => entry !== '')
      })
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) {
          applySettings(data.settings)
          setMessage('Saved. Applies to the next indexing run.')
        } else {
          setMessage(data.error ?? 'Failed to save.')
        }
      })
      .catch(() => setMessage('Failed to save.'))
      .finally(() => setSaving(false))
  }

  return (
    <Panel className="p-5">
      <SectionHeader title="Analyzer Configuration" />
      <div className="mt-5 grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm text-[#4b5563]">PHP syntax version for the parser</span>
          <select
            value={phpVersion}
            onChange={(event) => setPhpVersion(event.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] focus:border-[#cbd5e1] focus:outline-none"
          >
            {(config?.phpVersionOptions ?? ['8.4']).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span className="text-xs text-[#9ca3af]">
            The language grammar the AST parser targets — not the PHP runtime the analyzer runs on.
          </span>
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm text-[#4b5563]">Project root (composer.lock location)</span>
          <input
            value={projectRoot}
            onChange={(event) => setProjectRoot(event.target.value)}
            placeholder="empty = mount root"
            className="h-9 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] focus:border-[#cbd5e1] focus:outline-none"
          />
          <span className="text-xs text-[#9ca3af]">Where composer.lock is read, relative to the mount.</span>
        </label>

        <div className="grid gap-1.5">
          <span className="text-sm text-[#4b5563]">Source directories to scan</span>
          <div className="grid gap-2">
            {sourceSubpaths.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={entry}
                  onChange={(event) => updateSubpath(index, event.target.value)}
                  placeholder="e.g. vendor, app/code"
                  className="h-9 flex-1 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] focus:border-[#cbd5e1] focus:outline-none"
                />
                <ActionButton label="Remove" onClick={() => removeSubpath(index)} />
              </div>
            ))}
          </div>
          <div>
            <ActionButton label="Add directory" onClick={() => setSourceSubpaths((current) => [...current, ''])} />
          </div>
          <span className="text-xs text-[#9ca3af]">
            Each is scanned in its own analyzer pass. Leave empty to scan the whole mount.
          </span>
        </div>

        <label className="grid gap-1.5">
          <span className="text-sm text-[#4b5563]">Mounted directory (read-only)</span>
          <div className="flex h-9 items-center rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 text-sm text-[#6b7280]">
            {config?.mountPath ?? '—'}
          </div>
          <span className="text-xs text-[#9ca3af]">
            The host mount is set in Docker Compose; changing it needs a service restart.
          </span>
        </label>

        <div className="flex items-center gap-3">
          <ActionButton label={saving ? 'Saving…' : 'Save'} disabled={saving} onClick={save} />
          {message ? <span className="text-xs text-[#6b7280]">{message}</span> : null}
        </div>
      </div>
    </Panel>
  )
}

const McpSection: React.FC = () => {
  return (
    <Panel className="p-5 xl:col-span-2">
      <SectionHeader title="Activate the MCP Server" />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="grid gap-3 text-sm text-[#4b5563]">
          <p>Point your agent at the Streamable HTTP endpoint below, then add the JSON to your MCP client config.</p>
          <Row label="Transport">Streamable HTTP</Row>
          <Row label="Endpoint">http://localhost:8080/mcp</Row>
          <Row label="Tools">get_status, graph_search, get_graph_schema</Row>
          <a
            href={readmeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-bold text-[#fd8504] transition hover:text-[#d97004]"
          >
            Open the README on GitHub →
          </a>
        </div>
        <pre className="overflow-auto rounded-lg border border-[#e5e7eb] bg-[#f3f4f6] p-4 text-xs leading-6 text-[#111827]">
{`{
  "mcpServers": {
    "magentic": {
      "url": "http://localhost:8080/mcp"
    }
  }
}`}
        </pre>
      </div>
    </Panel>
  )
}

const Row: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[#e5e7eb] bg-white px-4">
      <span className="text-sm text-[#4b5563]">{label}</span>
      <span className="truncate text-sm font-semibold text-[#111827]">{children}</span>
    </div>
  )
}

const ActionButton: React.FC<{ label: string; disabled?: boolean; onClick: () => void }> = ({
  label,
  disabled,
  onClick
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 cursor-pointer rounded-lg border border-[#e5e7eb] bg-white px-3 text-xs font-semibold text-[#111827] transition hover:border-[#cbd5e1] hover:bg-[#e5e7eb] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}

