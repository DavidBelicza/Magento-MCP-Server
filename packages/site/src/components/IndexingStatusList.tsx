import React, { useEffect, useRef, useState } from 'react'
import type { IndexJob } from '../app/StatusContext'

export const IndexingStatusList: React.FC<{
  items: IndexJob[]
  locked: boolean
}> = ({ items, locked }) => {
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {locked ? 'A full index is locked and starting…' : 'No indexing in progress.'}
      </p>
    )
  }

  const sorted = [...items].sort((a, b) => Number(b.state === 'active') - Number(a.state === 'active'))

  return (
    <ul className="grid gap-2">
      {sorted.map((item, index) => {
        const active = item.state === 'active'
        const dotColor = active ? 'bg-accent' : 'bg-brand'
        const badgeTone = active ? 'bg-accent-soft text-accent-hover' : 'bg-brand-soft text-brand'

        return (
          <li
            key={`${item.queue}-${item.name}-${index}`}
            className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotColor}`} />
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900">{item.queue ?? 'job'}</div>
                <ProgressDetail progress={item.progress} fallback={item.name} active={active} />
              </div>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${badgeTone}`}>
              {formatState(item.state)}
            </span>
          </li>
        )
      })}
    </ul>
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
  const directories = progress.directories
  const current = typeof progress.current === 'number' ? progress.current : 0

  return (
    <div className="min-w-0">
      {line ? <div className="truncate text-xs text-gray-500">{line}</div> : null}
      {hasCounts ? (
        <div className="mt-0.5 text-xs text-gray-900">
          <CountUp value={progress.nodes ?? 0} /> nodes · <CountUp value={progress.edges ?? 0} /> edges
        </div>
      ) : null}
      {Array.isArray(directories) && directories.length > 1 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {directories.map((directory, index) => {
            const status = index + 1 < current ? 'done' : index + 1 === current ? 'active' : 'waiting'
            const activeTone = active ? 'bg-accent-soft text-accent-hover' : 'bg-brand-soft text-brand'
            const tone =
              status === 'done'
                ? 'bg-gray-200 text-gray-500'
                : status === 'active'
                  ? activeTone
                  : 'border border-gray-200 text-gray-400'

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

function formatState(state: string | undefined): string {
  return state === 'active' ? 'in progress' : (state ?? 'unknown')
}
