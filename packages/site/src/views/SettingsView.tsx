import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Panel, SectionHeader } from '../components/Panel'

const readmeUrl = 'https://github.com/DavidBelicza/Magentic/blob/main/README.md'

type JobProgress = {
  phase?: string
  directory?: string
  directories?: string[]
  current?: number
  total?: number
  processed?: number
  percent?: number
  nodes?: number
  edges?: number
}

type IndexJob = {
  queue?: string
  name?: string
  state?: string
  timestamp?: number
  progress?: JobProgress | number | null
}

type IndexStatus = {
  inProgress: number
  locked: boolean
  items: IndexJob[]
}

type AgentStatus = {
  connected: boolean
  lastSeenAt: number | null
}

type AppSettings = {
  phpVersion: string
  projectRoot: string
  sourceSubpaths: string[]
}

type ConfigResponse = {
  settings: AppSettings
  mountPath: string
  phpVersionOptions: string[]
}

type GraphStats = {
  nodeCount: number
  relationshipCount: number
  byLabel: { label: string; count: number }[]
}

export const SettingsView: React.FC = () => {
  return (
    <section className="grid min-h-full grid-cols-1 gap-5 xl:grid-cols-2">
      <IndexingSection />
      <AgentSection />
      <ConfigSection />
      <GraphSection />
      <McpSection />
    </section>
  )
}

const IndexingSection: React.FC = () => {
  const [status, setStatus] = useState<IndexStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const wasRunning = useRef(false)

  const load = useCallback(() => {
    fetch('/api/graph/index/status')
      .then((response) => response.json())
      .then((data) => {
        const next = { inProgress: data.inProgress ?? 0, locked: data.locked ?? false, items: data.items ?? [] }
        setStatus(next)

        const running = next.inProgress > 0 || next.locked
        if (wasRunning.current && !running) {
          setMessage(null)
        }
        wasRunning.current = running
      })
      .catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 3000)
    return () => window.clearInterval(timer)
  }, [load])

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
      .finally(() => {
        setBusy(false)
        load()
      })
  }

  const running = (status?.inProgress ?? 0) > 0 || (status?.locked ?? false)

  return (
    <Panel className="p-5">
      <SectionHeader title="Indexing Pipeline" />
      <div className="mt-5">
        {status && status.items.length > 0 ? (
          <ul className="grid gap-2">
            {status.items.map((item, index) => (
              <li
                key={`${item.queue}-${item.name}-${index}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-[#e5e7eb] bg-white px-4 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#fd8504] opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#fd8504]" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#111827]">{item.queue ?? 'job'}</div>
                    <ProgressDetail progress={item.progress} fallback={item.name} />
                  </div>
                </div>
                <span className="shrink-0 rounded-md bg-[#fff3e6] px-2 py-1 text-[11px] font-bold text-[#fd8504]">
                  {formatState(item.state)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#6b7280]">
            {status?.locked ? 'A full index is locked and starting…' : 'No indexing in progress.'}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton label="Reindex" disabled={busy || running} onClick={() => run('/api/graph/index/reindex', 'reindex')} />
          <ActionButton
            label="Reset & reindex"
            disabled={busy || running}
            onClick={() => run('/api/graph/index/reset-and-reindex', 'reset and reindex')}
          />
        </div>
        {message ? <p className="mt-3 text-xs text-[#6b7280]">{message}</p> : null}
      </div>
    </Panel>
  )
}

const AgentSection: React.FC = () => {
  const [agent, setAgent] = useState<AgentStatus | null>(null)

  useEffect(() => {
    const load = () => {
      fetch('/api/status')
        .then((response) => response.json())
        .then((data) => setAgent(data.agent ?? null))
        .catch(() => setAgent(null))
    }

    load()
    const timer = window.setInterval(load, 3000)
    return () => window.clearInterval(timer)
  }, [])

  const connected = agent?.connected ?? false

  return (
    <Panel className="p-5">
      <SectionHeader title="AI Agent Activity" />
      <div className="mt-5 grid gap-3">
        <Row label="Status">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-[#00e676]' : 'bg-[#fd8504]'}`} />
            {connected ? 'Connected' : 'Idle'}
          </span>
        </Row>
        <Row label="Last interaction">{agent?.lastSeenAt ? formatRelative(agent.lastSeenAt) : 'No activity yet'}</Row>
        <Row label="At">{agent?.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString() : '—'}</Row>
      </div>
      <p className="mt-3 text-xs text-[#6b7280]">
        Connected means an agent called the MCP server within the last 120 seconds.
      </p>
    </Panel>
  )
}

const ConfigSection: React.FC = () => {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [phpVersion, setPhpVersion] = useState('8.5')
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
            {(config?.phpVersionOptions ?? ['8.5']).map((option) => (
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

const GraphSection: React.FC = () => {
  const [stats, setStats] = useState<GraphStats | null>(null)

  useEffect(() => {
    fetch('/api/graph/stats')
      .then((response) => response.json())
      .then((data) => setStats(data.ok ? data : null))
      .catch(() => setStats(null))
  }, [])

  return (
    <Panel className="p-5">
      <SectionHeader title="Graph Summary" />
      <div className="mt-5 grid gap-3">
        <Row label="Total nodes">{stats ? stats.nodeCount.toLocaleString() : '—'}</Row>
        <Row label="Total relationships">{stats ? stats.relationshipCount.toLocaleString() : '—'}</Row>
        {stats?.byLabel.slice(0, 6).map((item) => (
          <Row key={item.label} label={item.label}>
            {item.count.toLocaleString()}
          </Row>
        ))}
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
        <pre className="overflow-auto rounded-lg border border-slate-200 bg-[#183d28] p-4 text-xs leading-6 text-white">
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

const ProgressDetail: React.FC<{ progress: IndexJob['progress']; fallback?: string }> = ({ progress, fallback }) => {
  if (!progress || typeof progress !== 'object') {
    return <div className="truncate text-xs text-[#6b7280]">{fallback}</div>
  }

  const line = describeProgress(progress) ?? fallback
  const hasCounts = typeof progress.nodes === 'number' || typeof progress.edges === 'number'
  const directories = progress.directories
  const current = typeof progress.current === 'number' ? progress.current : 0

  return (
    <div className="min-w-0">
      {line ? <div className="truncate text-xs text-[#6b7280]">{line}</div> : null}
      {hasCounts ? (
        <div className="mt-0.5 text-xs text-[#111827]">
          <CountUp value={progress.nodes ?? 0} /> nodes · <CountUp value={progress.edges ?? 0} /> edges
        </div>
      ) : null}
      {Array.isArray(directories) && directories.length > 1 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {directories.map((directory, index) => {
            const status = index + 1 < current ? 'done' : index + 1 === current ? 'active' : 'waiting'
            const tone =
              status === 'done'
                ? 'bg-[#e5e7eb] text-[#6b7280]'
                : status === 'active'
                  ? 'bg-[#fff3e6] text-[#fd8504]'
                  : 'border border-[#e5e7eb] text-[#9ca3af]'

            return (
              <span key={`${directory}-${index}`} className={`rounded px-1.5 py-0.5 text-[10px] ${tone}`}>
                {directory}
              </span>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

const CountUp: React.FC<{ value: number }> = ({ value }) => {
  return <>{useCountUp(value).toLocaleString()}</>
}

function useCountUp(target: number, duration = 1500): number {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)
  displayRef.current = display

  useEffect(() => {
    const from = displayRef.current

    if (from === target) {
      return
    }

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (target - from) * eased))

      if (t < 1) {
        raf = requestAnimationFrame(tick)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return display
}

function formatState(state: string | undefined): string {
  return state === 'active' ? 'in progress' : (state ?? 'unknown')
}

function describeProgress(progress: IndexJob['progress']): string | null {
  if (!progress || typeof progress !== 'object') {
    return null
  }

  const parts: string[] = []

  if (progress.phase) {
    parts.push(progress.phase)
  }

  if (progress.directory && progress.directory !== '.') {
    parts.push(progress.directory)
  }

  if (typeof progress.current === 'number' && typeof progress.total === 'number' && progress.total > 1) {
    parts.push(`(${progress.current}/${progress.total})`)
  }

  if (typeof progress.percent === 'number' && progress.percent > 0 && progress.percent < 100) {
    parts.push(`${Math.round(progress.percent)}%`)
  }

  return parts.length > 0 ? parts.join(' · ') : null
}

function formatRelative(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000))

  if (seconds < 60) {
    return `${seconds}s ago`
  }

  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m ago`
  }

  if (seconds < 86400) {
    return `${Math.round(seconds / 3600)}h ago`
  }

  return `${Math.round(seconds / 86400)}d ago`
}
