import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { Link, useSearchParams } from 'react-router-dom'
import { GraphVisualization, buildGraphStyle } from '../features/graph'
import type { GraphVisualizationData, GraphVisualizationHandle, GraphLegendEntry } from '../features/graph'
import { Panel } from '../components/Panel'

type QueryHistoryGraphResponse =
  | {
      ok: true
      id: string
      createdAt: string
      description: string
      structuredResult: GraphVisualizationData
    }
  | {
      ok: false
      error: string
    }

type QueryHistoryListResponse =
  | {
      ok: true
      items: Array<{
        id: string
        createdAt: string
        description: string
        nodeCount: number
        relationshipCount: number
      }>
    }
  | {
      ok: false
      error: string
    }

export const GraphView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryHistoryId = searchParams.get('queryHistoryId')
  const [queryGraph, setQueryGraph] = useState<GraphVisualizationData | null>(null)
  const [queryDescription, setQueryDescription] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const graphCounts = useMemo(() => (queryGraph ? getStructuredGraphCounts(queryGraph) : { nodes: 0, edges: 0 }), [queryGraph])
  const graphStyle = useMemo(() => (queryGraph ? buildGraphStyle(queryGraph) : null), [queryGraph])
  const hasQueryGraphData = !queryGraph || queryGraph.nodes.length > 0 || queryGraph.relationships.length > 0
  const shouldRenderGraph = status === 'ready' && hasQueryGraphData && Boolean(queryGraph)
  const graphRef = useRef<GraphVisualizationHandle | null>(null)

  useEffect(() => {
    if (queryHistoryId) {
      return
    }

    let isMounted = true

    async function loadLatestQueryHistory() {
      setStatus('loading')
      setError(null)

      try {
        const response = await apiFetch('/api/graph/get-query-history')
        const body = (await response.json()) as QueryHistoryListResponse

        if (!isMounted) {
          return
        }

        if (!response.ok || !body.ok) {
          setError(body.ok ? 'Query history could not be loaded' : body.error)
          setStatus('error')
          return
        }

        const latestItem = body.items[0]

        if (!latestItem) {
          setError('No query history is available yet')
          setStatus('error')
          return
        }

        setSearchParams({ queryHistoryId: latestItem.id }, { replace: true })
      } catch {
        if (isMounted) {
          setError('Query history could not be loaded')
          setStatus('error')
        }
      }
    }

    void loadLatestQueryHistory()

    return () => {
      isMounted = false
    }
  }, [queryHistoryId, setSearchParams])

  useEffect(() => {
    if (!queryHistoryId) {
      setQueryGraph(null)
      setQueryDescription(null)
      return
    }

    let isMounted = true

    async function loadQueryGraph() {
      setStatus('loading')
      setError(null)

      try {
        const response = await apiFetch(`/api/graph/get-query-history/${encodeURIComponent(queryHistoryId ?? '')}`)
        const body = (await response.json()) as QueryHistoryGraphResponse

        if (!isMounted) {
          return
        }

        if (!response.ok || !body.ok) {
          setError(body.ok ? 'Query graph could not be loaded' : body.error)
          setStatus('error')
          return
        }

        setQueryGraph(body.structuredResult)
        setQueryDescription(body.description)
        setStatus('ready')
      } catch {
        if (isMounted) {
          setError('Query graph could not be loaded')
          setStatus('error')
        }
      }
    }

    void loadQueryGraph()

    return () => {
      isMounted = false
    }
  }, [queryHistoryId])

  return (
    <div className="grid min-h-[360px] flex-1 grid-cols-1">
      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-gray-200 px-4">
          <div className="flex min-w-0 items-center gap-3">
            {graphStyle && graphStyle.legend.length > 0 ? <GraphLegend entries={graphStyle.legend} /> : null}
            <div className="min-w-0 truncate text-xs font-semibold text-gray-600" title={queryDescription ?? undefined}>
              {getGraphHeaderTitle(status, queryDescription)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-xs font-semibold text-gray-600">
              {graphCounts.nodes} nodes / {graphCounts.edges} edges
            </div>
            <button
              type="button"
              className="h-7 rounded-lg border border-gray-200 px-3 text-gray-600 transition hover:border-slate-300 hover:bg-gray-50 focus:outline-none inline-flex items-center justify-center"
              onClick={() => graphRef.current?.resetView()}
            >
              <span className="text-xs font-semibold">Reset</span>
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(rgba(17,24,39,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(17,24,39,0.055)_1px,transparent_1px)] bg-[position:24px_24px] bg-[size:48px_48px]">
          {status === 'loading' ? (
            <GraphStateMessage label="Loading saved graph" />
          ) : null}

          {status === 'error' ? (
            <GraphStateMessage label={error ?? 'Query graph could not be loaded'} showHistoryLink />
          ) : null}

          {queryHistoryId && status === 'ready' && queryGraph && !hasQueryGraphData ? (
            <GraphStateMessage label="This saved query did not return graph nodes or relationships" showHistoryLink />
          ) : null}

          {shouldRenderGraph && graphStyle ? (
            <GraphVisualization ref={graphRef} data={graphStyle.data} />
          ) : null}
        </div>
      </Panel>
    </div>
  )
}

const LEGEND_LABELS: Record<string, string> = {
  type: 'Type',
  method: 'Method',
  event: 'Event',
  'cron-group': 'Cron group',
  'webapi-route': 'Web API route',
  'extension-attribute': 'Extension attribute',
  'composer-package': 'Package',
  'composer-author': 'Author',
}

const GraphLegend: React.FC<{ entries: GraphLegendEntry[] }> = ({ entries }) => (
  <div className="flex shrink-0 items-center gap-3 overflow-x-auto">
    {entries.map((entry) => (
      <span key={entry.type} className="flex items-center gap-1.5 text-xs text-gray-600">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
        <span className="truncate">{LEGEND_LABELS[entry.type] ?? entry.type}</span>
      </span>
    ))}
  </div>
)

const GraphStateMessage: React.FC<{ label: string; showHistoryLink?: boolean }> = ({ label, showHistoryLink = false }) => (
  <div className="flex h-full items-center justify-center px-4 text-center">
    <div>
      <div className="text-sm font-semibold text-gray-600">{label}</div>
      {showHistoryLink ? (
        <Link
          to="/history"
          className="mt-3 inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-brand transition hover:border-brand hover:bg-brand-soft focus:outline-none focus:ring-2 focus:ring-accent/45"
        >
          View query history
        </Link>
      ) : null}
    </div>
  </div>
)

function getStructuredGraphCounts(graph: GraphVisualizationData): { nodes: number; edges: number } {
  return {
    nodes: graph.nodes.length,
    edges: graph.relationships.length,
  }
}

function createGraphTitle(description: string): string {
  const words = description.trim().split(/\s+/).filter(Boolean)

  if (words.length <= 10) {
    return description
  }

  return `${words.slice(0, 10).join(' ')}...`
}

function getGraphHeaderTitle(status: 'idle' | 'loading' | 'ready' | 'error', description: string | null): string {
  if (description) {
    return createGraphTitle(description)
  }

  if (status === 'error') {
    return 'Graph unavailable'
  }

  return 'Loading latest query graph'
}
