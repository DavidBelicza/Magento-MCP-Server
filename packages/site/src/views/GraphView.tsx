import React, { useRef } from 'react'
import { GraphVisualization, topAuthorPackagesMock } from '../features/graph'
import type { GraphVisualizationHandle } from '../features/graph'
import { Panel } from '../components/Panel'

export const GraphView: React.FC = () => {
  const graphCounts = getGraphCounts()
  const graphRef = useRef<GraphVisualizationHandle | null>(null)

  return (
    <div className="grid h-full min-h-[360px] grid-cols-1">
      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#e5e7eb] px-4">
          <div className="text-xs font-semibold text-[#4b5563]">
            Top package authors
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-[#4b5563]">
              {graphCounts.nodes} nodes / {graphCounts.edges} edges
            </div>
            <button
              type="button"
              className="h-7 rounded-lg border border-[#e5e7eb] px-3 text-[#4b5563] transition hover:border-[#cbd5e1] hover:bg-[#f9fafb] focus:outline-none inline-flex items-center justify-center"
              onClick={() => graphRef.current?.resetView()}
            >
              <span className="text-xs font-semibold">Reset</span>
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(rgba(17,24,39,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(17,24,39,0.055)_1px,transparent_1px)] bg-[position:24px_24px] bg-[size:48px_48px]">
          <GraphVisualization ref={graphRef} authors={topAuthorPackagesMock} />
        </div>
      </Panel>
    </div>
  )
}

function getGraphCounts(): { nodes: number; edges: number } {
  const packageIds = new Set<string>()
  let edges = 0

  for (const author of topAuthorPackagesMock) {
    edges += author.packages.length

    for (const composerPackage of author.packages) {
      packageIds.add(composerPackage.id)
    }
  }

  return {
    nodes: topAuthorPackagesMock.length + packageIds.size,
    edges,
  }
}
