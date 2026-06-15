import React, { useEffect, useState } from 'react'
import { Panel, SectionHeader } from '../components/Panel'

type AgentStatus = {
  connected: boolean
  lastSeenAt: number | null
}

type GraphStats = {
  nodeCount: number
  relationshipCount: number
  byLabel: { label: string; count: number }[]
}

export const DatabaseView: React.FC = () => {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <AgentSection />
      <GraphSection />
    </section>
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

const Row: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[#e5e7eb] bg-white px-4">
      <span className="text-sm text-[#4b5563]">{label}</span>
      <span className="truncate text-sm font-semibold text-[#111827]">{children}</span>
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
