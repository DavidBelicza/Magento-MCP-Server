import React, { useEffect, useRef, useState } from 'react'
import type { IndexGroupStatus, IndexJob } from '../app/StatusContext'

export type IndexCatalogEntry = { queue: string; label: string }

export const graphIndexCatalog: IndexCatalogEntry[] = [
  { queue: 'index-packages', label: 'Composer packages' },
  { queue: 'index-source', label: 'PHP AST' },
  { queue: 'index-xml', label: 'XML (DI, observers, cron, REST API)' },
  { queue: 'index-links', label: 'Interconnections' }
]

export const vectorIndexCatalog: IndexCatalogEntry[] = [{ queue: 'index-vector', label: 'Store config' }]

export const IndexGroup: React.FC<{
  title: string
  catalog: IndexCatalogEntry[]
  status: IndexGroupStatus
  actions?: React.ReactNode
}> = ({ title, catalog, status, actions }) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</span>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <ul className="grid gap-2">
        {catalog.map((entry) => (
          <IndexRow key={entry.queue} entry={entry} status={status} />
        ))}
      </ul>
    </div>
  )
}

const IndexRow: React.FC<{ entry: IndexCatalogEntry; status: IndexGroupStatus }> = ({ entry, status }) => {
  const job = status.items.find((item) => item.queue === entry.queue)
  const state = resolveRowState(job, status)
  const active = state === 'active'
  const done = state === 'done'

  const badgeTone = done
    ? 'bg-gray-200 text-gray-600'
    : active
      ? 'bg-accent-soft text-accent-hover'
      : 'bg-brand-soft text-brand'

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <StatusDot state={state} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">{entry.label}</div>
          {job ? <ProgressDetail progress={job.progress} fallback={job.name} active={active} /> : null}
        </div>
      </div>
      <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${badgeTone}`}>
        {done ? 'Done' : active ? 'in progress' : 'waiting'}
      </span>
    </li>
  )
}

function resolveRowState(job: IndexJob | undefined, status: IndexGroupStatus): 'active' | 'waiting' | 'done' {
  if (job) {
    return job.state === 'active' ? 'active' : 'waiting'
  }

  if (status.locked && status.items.length === 0) {
    return 'waiting'
  }

  return 'done'
}

const StatusDot: React.FC<{ state: string }> = ({ state }) => {
  if (state === 'done') {
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gray-700" />
  }

  const dotColor = state === 'active' ? 'bg-accent' : 'bg-brand'

  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotColor}`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`} />
    </span>
  )
}

const ProgressDetail: React.FC<{ progress: IndexJob['progress']; fallback?: string; active?: boolean }> = ({
  progress,
  fallback,
  active
}) => {
  if (!progress || typeof progress !== 'object') {
    return <div className="truncate text-xs text-gray-500">{fallback}</div>
  }

  const line = describeProgress(progress) ?? fallback
  const hasCounts = typeof progress.nodes === 'number' || typeof progress.edges === 'number'
  const steps = progress.steps ?? progress.directories
  const current = typeof progress.current === 'number' ? progress.current : 0

  return (
    <div className="min-w-0">
      {line ? <div className="truncate text-xs text-gray-500">{line}</div> : null}
      {hasCounts ? (
        <div className="mt-0.5 text-xs text-gray-900">
          <CountUp value={progress.nodes ?? 0} /> nodes · <CountUp value={progress.edges ?? 0} /> edges
        </div>
      ) : null}
      {Array.isArray(steps) && steps.length > 1 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {steps.map((step, index) => {
            const status = index + 1 < current ? 'done' : index + 1 === current ? 'active' : 'waiting'
            const activeTone = active ? 'bg-accent-soft text-accent-hover' : 'bg-brand-soft text-brand'
            const tone =
              status === 'done'
                ? 'bg-gray-200 text-gray-500'
                : status === 'active'
                  ? activeTone
                  : 'border border-gray-200 text-gray-400'

            return (
              <span key={`${step}-${index}`} className={`rounded px-1.5 py-0.5 text-[10px] ${tone}`}>
                {step}
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
