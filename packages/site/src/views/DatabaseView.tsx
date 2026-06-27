import React, { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { Panel, SectionHeader } from '../components/Panel'
import { IndexGroup, graphIndexCatalog, vectorIndexCatalog } from '../components/IndexingStatusList'
import { useStatus } from '../app/StatusContext'

const emptyGroup = { inProgress: 0, locked: false, items: [] }

type GraphStats = {
  nodeCount: number
  relationshipCount: number
  byLabel: { label: string; count: number }[]
}

export const DatabaseView: React.FC = () => {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <AgentSection />
      <WatcherSection />
      <IndexingPanel />
      <GraphSection />
    </section>
  )
}

const AgentSection: React.FC = () => {
  const status = useStatus()
  const agent = status?.agent ?? null
  const connected = agent?.connected ?? false

  return (
    <Panel className="p-5">
      <SectionHeader title="AI Agent Activity" />
      <div className="mt-5 grid gap-3">
        <Row label="Status">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-accent' : 'bg-brand'}`} />
            {connected ? 'Connected' : 'Idle'}
          </span>
        </Row>
        <Row label="Last interaction">{agent?.lastSeenAt ? formatRelative(agent.lastSeenAt) : 'No activity yet'}</Row>
        <Row label="At">{agent?.lastSeenAt ? new Date(agent.lastSeenAt).toLocaleString() : '—'}</Row>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Connected means an agent called the MCP server within the last 120 seconds.
      </p>
    </Panel>
  )
}

const WatcherSection: React.FC = () => {
  const status = useStatus()

  const { label, tone } = (() => {
    if (!status) {
      return { label: 'Unknown', tone: 'bg-gray-400' }
    }
    if (!status.watcherEnabled) {
      return { label: 'Disabled', tone: 'bg-gray-400' }
    }
    if (status.indexing.locked) {
      return { label: 'Paused (full reindex)', tone: 'bg-brand' }
    }
    return { label: 'Enabled', tone: 'bg-accent' }
  })()

  return (
    <Panel className="p-5">
      <SectionHeader title="File Watcher" />
      <div className="mt-5 grid gap-3">
        <Row label="Status">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${tone}`} />
            {label}
          </span>
        </Row>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Auto-reindexes changed files. Pauses while a full reindex runs. Toggle it on the Settings page.
      </p>
    </Panel>
  )
}

const IndexingPanel: React.FC = () => {
  const status = useStatus()

  return (
    <Panel className="p-5">
      <SectionHeader title="Indexing Pipeline" />
      <div className="mt-5 grid gap-3">
        <IndexGroup title="Graph" catalog={graphIndexCatalog} status={status?.indexing ?? emptyGroup} />
        <IndexGroup title="Vector" catalog={vectorIndexCatalog} status={status?.vector ?? emptyGroup} />
      </div>
    </Panel>
  )
}

const GraphSection: React.FC = () => {
  const [stats, setStats] = useState<GraphStats | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    apiFetch('/api/graph/stats')
      .then((response) => response.json())
      .then((data) => setStats(data.ok ? data : null))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader title="Graph Summary" />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="h-8 shrink-0 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900 transition hover:border-slate-300 hover:bg-gray-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
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

const Row: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="truncate text-sm font-semibold text-gray-900">{children}</span>
    </div>
  )
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
