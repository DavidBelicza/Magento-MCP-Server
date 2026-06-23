import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { Link } from 'react-router-dom'

type QueryHistoryItem = {
  id: string
  createdAt: string
  description: string
  nodeCount: number
  relationshipCount: number
  rowCount: number
}

type QueryHistoryResponse =
  | {
      ok: true
      items: QueryHistoryItem[]
    }
  | {
      ok: false
      error: string
    }

export const QueryHistoryView: React.FC = () => {
  const [items, setItems] = useState<QueryHistoryItem[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadQueryHistory() {
      try {
        const response = await apiFetch('/api/graph/get-query-history')
        const body = (await response.json()) as QueryHistoryResponse

        if (!isMounted) {
          return
        }

        if (!response.ok || !body.ok) {
          setError(body.ok ? 'Query history could not be loaded' : body.error)
          setStatus('error')
          return
        }

        setItems(body.items)
        setStatus('ready')
      } catch {
        if (isMounted) {
          setError('Query history could not be loaded')
          setStatus('error')
        }
      }
    }

    void loadQueryHistory()

    return () => {
      isMounted = false
    }
  }, [])

  const itemCountLabel = useMemo(() => {
    if (status === 'loading') {
      return 'Loading'
    }

    if (status === 'error') {
      return 'Unavailable'
    }

    return `${items.length} recent ${items.length === 1 ? 'query' : 'queries'}`
  }, [items.length, status])

  function toggleExpanded(id: string) {
    setExpandedIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(id)) {
        nextIds.delete(id)
      } else {
        nextIds.add(id)
      }

      return nextIds
    })
  }

  return (
    <section className="min-h-full">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex justify-start border-b border-gray-200 px-4 py-3">
          <span className="text-xs font-semibold text-gray-600">{itemCountLabel}</span>
        </div>

        {status === 'loading' ? <QueryHistoryMessage title="Loading query history" /> : null}

        {status === 'error' ? (
          <QueryHistoryMessage title={error ?? 'Query history could not be loaded'} />
        ) : null}

        {status === 'ready' && items.length === 0 ? <QueryHistoryMessage title="No query history yet" /> : null}

        {status === 'ready' && items.length > 0 ? (
          <div>
            <div className="hidden grid-cols-[minmax(0,1fr)_150px_170px_150px] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-gray-500 lg:grid">
              <div>Query</div>
              <div>Result</div>
              <div>Created</div>
              <div>Action</div>
            </div>
            {items.map((item, index) => (
              <QueryHistoryRow
                key={item.id}
                item={item}
                index={index}
                isExpanded={expandedIds.has(item.id)}
                onToggle={() => toggleExpanded(item.id)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

const QueryHistoryRow: React.FC<{
  item: QueryHistoryItem
  index: number
  isExpanded: boolean
  onToggle: () => void
}> = ({ item, index, isExpanded, onToggle }) => {
  const title = createTitle(item.description)
  const hasGraphData = item.nodeCount > 0 || item.relationshipCount > 0
  const graphLink = `/graph?queryHistoryId=${encodeURIComponent(item.id)}`
  const inspectLink = `${graphLink}&view=inspect`
  const descriptionRef = useRef<HTMLParagraphElement | null>(null)
  const [canExpand, setCanExpand] = useState(false)
  const [expandedHeight, setExpandedHeight] = useState(0)

  useEffect(() => {
    const description = descriptionRef.current

    if (!description) {
      return
    }

    function updateDescriptionState() {
      if (!description) {
        return
      }

      setCanExpand(description.scrollHeight > 20 + 1)
      setExpandedHeight(description.scrollHeight)
    }

    updateDescriptionState()
    window.addEventListener('resize', updateDescriptionState)

    return () => {
      window.removeEventListener('resize', updateDescriptionState)
    }
  }, [item.description, isExpanded])

  return (
    <article
      className={[
        'grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_150px_170px_150px] lg:gap-4',
        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
      ].join(' ')}
    >
      <div className="min-w-0">
        <h3 className="truncate text-sm font-bold">
          <Link
            to={hasGraphData ? graphLink : inspectLink}
            className="text-gray-900 transition hover:text-gray-500 focus:outline-none"
          >
            {title}
          </Link>
        </h3>
        <div
          className="mt-1 overflow-hidden transition-[height] duration-200 ease-out"
          style={{ height: isExpanded ? expandedHeight : 20 }}
        >
          <p
            ref={descriptionRef}
            className="text-sm leading-5 text-gray-600"
          >
            {item.description}
          </p>
        </div>
        {canExpand || isExpanded ? (
          <button
            type="button"
            className="mt-1 cursor-pointer text-[11px] font-bold text-gray-900 transition hover:text-gray-500 focus:outline-none"
            onClick={onToggle}
          >
            {isExpanded ? 'Less' : 'More'}
          </button>
        ) : null}
      </div>

      <div className="text-xs font-semibold text-gray-900 lg:pt-1">
        <span className="mr-2 font-bold uppercase tracking-[0.12em] text-gray-500 lg:hidden">Result</span>
        {item.nodeCount > 0 || item.relationshipCount > 0
          ? `${item.nodeCount} nodes / ${item.relationshipCount} edges`
          : `${item.rowCount} ${item.rowCount === 1 ? 'row' : 'rows'}`}
      </div>

      <div className="text-xs font-semibold text-gray-900 lg:pt-1">
        <span className="mr-2 font-bold uppercase tracking-[0.12em] text-gray-500 lg:hidden">Created</span>
        <span className="inline-flex flex-col leading-tight align-top">
          <span>{formatDate(item.createdAt)}</span>
          <span className="text-[11px] font-normal text-gray-500">{formatTime(item.createdAt)}</span>
        </span>
      </div>

      <div className="flex flex-row flex-wrap gap-2 lg:flex-col lg:pt-0.5">
        <Link
          to={graphLink}
          className="inline-flex h-7 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-900 transition hover:border-slate-300 hover:bg-gray-200 focus:outline-none"
        >
          Open graph
        </Link>
        <Link
          to={inspectLink}
          className="inline-flex h-7 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-900 transition hover:border-slate-300 hover:bg-gray-200 focus:outline-none"
        >
          Inspect Details
        </Link>
      </div>
    </article>
  )
}

const QueryHistoryMessage: React.FC<{ title: string }> = ({ title }) => (
  <div className="bg-white px-4 py-8 text-center text-sm font-medium text-gray-600">{title}</div>
)

function createTitle(description: string): string {
  const words = description.trim().split(/\s+/).filter(Boolean)

  if (words.length <= 10) {
    return description
  }

  return `${words.slice(0, 10).join(' ')}...`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(value))
}
