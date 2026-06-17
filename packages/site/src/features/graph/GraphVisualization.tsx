import ForceGraph2D from 'react-force-graph-2d'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

export type GraphVisualizationNode = {
  id: string
  type: string
  labels?: string[]
  properties: Record<string, unknown>
}

export type GraphVisualizationRelationship = {
  id: string
  type: string
  startNodeId: string
  endNodeId: string
  properties: Record<string, unknown>
}

export type GraphVisualizationData = {
  nodes: GraphVisualizationNode[]
  relationships: GraphVisualizationRelationship[]
}

type ForceGraphNode = {
  id: string
  label: string
  type: string
  val: number
  color: string
  borderColor: string
  x?: number
  y?: number
}

type GraphViewportBounds = {
  bottom: number
  left: number
  right: number
  top: number
}

type ForceGraphLink = {
  id: string
  source: string | ForceGraphNode
  target: string | ForceGraphNode
  type: string
  color: string
}

type ForceGraphData = {
  nodes: ForceGraphNode[]
  links: ForceGraphLink[]
}

export type StyledGraphData = ForceGraphData

export type GraphLegendEntry = {
  type: string
  color: string
}

type GraphVisualizationProps = {
  data?: StyledGraphData
}

export type GraphVisualizationHandle = {
  resetView: () => void
}

export const GraphVisualization = forwardRef<GraphVisualizationHandle, GraphVisualizationProps>(({ data }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<any>(undefined)
  const selectedNodeIdRef = useRef<string | null>(null)
  const adjacencyRef = useRef<Adjacency | null>(null)
  const viewportBoundsRef = useRef<GraphViewportBounds | null>(null)
  const lastNodeClickTimeRef = useRef(0)
  const zoomRef = useRef(1)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const graphData = useMemo(() => data ?? createEmptyGraphData(), [data])
  const adjacency = useMemo(() => createAdjacency(graphData), [graphData])
  const simulationProfile = useMemo(() => getSimulationProfile(graphData.nodes.length), [graphData.nodes.length])
  const getSelectedNodeId = useCallback(() => selectedNodeIdRef.current, [])
  adjacencyRef.current = adjacency

  useImperativeHandle(ref, () => ({
    resetView: () => {
      graphRef.current?.zoomToFit(360, 32)
    },
  }))

  useEffect(() => {
    if (!containerRef.current) {
      return undefined
    }

    const observer = new ResizeObserver(([entry]) => {
      const { height, width } = entry.contentRect

      setSize({
        height: Math.max(1, Math.floor(height)),
        width: Math.max(1, Math.floor(width)),
      })
    })

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  const setSelectedNodeId = useCallback((nodeId: string | null) => {
    if (selectedNodeIdRef.current === nodeId) {
      return
    }

    selectedNodeIdRef.current = nodeId
    requestGraphRedraw(graphRef.current)
  }, [])

  useEffect(() => {
    setSelectedNodeId(null)

    const fitTimeout = window.setTimeout(() => {
      graphRef.current?.zoomToFit(480, 32)
    }, 600)

    return () => {
      window.clearTimeout(fitTimeout)
    }
  }, [graphData, setSelectedNodeId])

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null)
  }, [setSelectedNodeId])

  const getLinkColorForRender = useCallback((link: ForceGraphLink) => getRenderedLinkColor(link, getSelectedNodeId()), [getSelectedNodeId])

  const getLinkWidthForRender = useCallback((link: ForceGraphLink) => getRenderedLinkWidth(link, getSelectedNodeId()), [getSelectedNodeId])

  const drawNodeForRender = useCallback(
    (node: ForceGraphNode, canvas: CanvasRenderingContext2D, globalScale: number) => {
      const currentAdjacency = adjacencyRef.current
      const selectionState = currentAdjacency ? getNodeSelectionState(node, getSelectedNodeId(), currentAdjacency) : null

      drawNode(node, canvas, globalScale, selectionState, viewportBoundsRef.current)
    },
    [getSelectedNodeId],
  )

  const updateViewportBounds = useCallback(() => {
    viewportBoundsRef.current = getViewportBounds(graphRef.current, size)
  }, [size])

  const paintNodePointerAreaForRender = useCallback(
    (node: ForceGraphNode, color: string, canvas: CanvasRenderingContext2D, globalScale: number) => {
      paintNodePointerArea(node, color, canvas, globalScale)
    },
    [],
  )

  const getNodeCanvasObjectMode = useCallback(() => 'replace', [])

  const getLinkLabel = useCallback((link: ForceGraphLink) => {
    if (zoomRef.current < 1.15) {
      return ''
    }

    const selectedNodeId = selectedNodeIdRef.current

    if (selectedNodeId && !isLinkConnectedToNode(link, selectedNodeId)) {
      return ''
    }

    return humanizeRelationship(link.type)
  }, [])

  const handleZoom = useCallback((transform: { k: number }) => {
    zoomRef.current = transform.k
  }, [])

  const handleNodeClick = useCallback(
    (node: ForceGraphNode) => {
      const nodeId = String(node.id)
      const nextNodeId = selectedNodeIdRef.current === nodeId ? null : nodeId

      lastNodeClickTimeRef.current = Date.now()
      setSelectedNodeId(nextNodeId)
    },
    [setSelectedNodeId],
  )

  const handleBackgroundClick = useCallback(() => {
    if (Date.now() - lastNodeClickTimeRef.current < 80) {
      return
    }

    clearSelection()
  }, [clearSelection])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    pointerDownRef.current = { x: event.clientX, y: event.clientY }
  }, [])

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pointerDown = pointerDownRef.current

      pointerDownRef.current = null

      if (!pointerDown) {
        return
      }

      const movedDistance = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y)

      if (movedDistance > 4) {
        return
      }

      window.setTimeout(() => {
        if (Date.now() - lastNodeClickTimeRef.current < 120) {
          return
        }

        clearSelection()
      }, 32)
    },
    [clearSelection],
  )

  return (
    <div ref={containerRef} className="h-full w-full" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={size.width}
        height={size.height}
        backgroundColor="rgba(255,255,255,0)"
        nodeId="id"
        nodeLabel="label"
        nodeVal="val"
        nodeColor="color"
        nodeRelSize={3.2}
        linkSource="source"
        linkTarget="target"
        linkLabel={getLinkLabel}
        onZoom={handleZoom}
        linkColor={getLinkColorForRender}
        linkWidth={getLinkWidthForRender}
        linkDirectionalArrowLength={0}
        d3AlphaDecay={simulationProfile.alphaDecay}
        d3VelocityDecay={simulationProfile.velocityDecay}
        cooldownTime={simulationProfile.cooldownTime}
        warmupTicks={0}
        autoPauseRedraw
        enableNodeDrag
        nodeCanvasObject={drawNodeForRender}
        nodeCanvasObjectMode={getNodeCanvasObjectMode}
        nodePointerAreaPaint={paintNodePointerAreaForRender}
        onRenderFramePre={updateViewportBounds}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
      />
    </div>
  )
})

function createEmptyGraphData(): ForceGraphData {
  return {
    nodes: [],
    links: [],
  }
}

type NodeColor = { fill: string; border: string }

const NODE_PALETTE: NodeColor[] = [
  { fill: '#00e676', border: '#009f52' },
  { fill: '#ffb38a', border: '#ff4e08' },
  { fill: '#5fd0a0', border: '#0b7a4b' },
  { fill: '#ffcf9e', border: '#d97004' },
  { fill: '#8ce6cf', border: '#0e9e8e' },
  { fill: '#ffe08a', border: '#eaa600' },
]

const MIN_NODE_RADIUS = 3
const MAX_NODE_RADIUS = 10

function getNodeType(node: GraphVisualizationNode): string {
  return node.type || node.labels?.[0] || 'unknown'
}

function assignPalette(graph: GraphVisualizationData): Map<string, NodeColor> {
  const counts = new Map<string, number>()

  for (const node of graph.nodes) {
    const type = getNodeType(node)
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }

  const orderedTypes = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type]) => type)

  const palette = new Map<string, NodeColor>()
  orderedTypes.forEach((type, index) => {
    palette.set(type, NODE_PALETTE[index % NODE_PALETTE.length])
  })

  return palette
}

function computeNodeValues(graph: GraphVisualizationData): Map<string, number> {
  const degree = new Map<string, number>()

  for (const node of graph.nodes) {
    degree.set(node.id, 0)
  }

  for (const relationship of graph.relationships) {
    degree.set(relationship.startNodeId, (degree.get(relationship.startNodeId) ?? 0) + 1)
    degree.set(relationship.endNodeId, (degree.get(relationship.endNodeId) ?? 0) + 1)
  }

  const scaled = [...degree.values()].map((value) => Math.sqrt(value))
  const min = Math.min(...scaled)
  const max = Math.max(...scaled)
  const span = max - min

  const values = new Map<string, number>()

  for (const [id, value] of degree) {
    const norm = span > 0 ? (Math.sqrt(value) - min) / span : 0.5
    const radius = MIN_NODE_RADIUS + norm * (MAX_NODE_RADIUS - MIN_NODE_RADIUS)
    values.set(id, (radius / 3.2) ** 2)
  }

  return values
}

export function buildGraphStyle(graph: GraphVisualizationData): { data: StyledGraphData; legend: GraphLegendEntry[] } {
  const palette = assignPalette(graph)
  const values = computeNodeValues(graph)

  const data: StyledGraphData = {
    nodes: graph.nodes.map((node) => {
      const colors = palette.get(getNodeType(node)) ?? NODE_PALETTE[0]

      return {
        id: node.id,
        label: getNodeLabel(node),
        type: getNodeType(node),
        val: values.get(node.id) ?? 1,
        color: colors.fill,
        borderColor: colors.border,
      }
    }),
    links: graph.relationships.map((relationship) => ({
      id: relationship.id,
      source: relationship.startNodeId,
      target: relationship.endNodeId,
      type: relationship.type,
      color: getLinkColor(relationship.type),
    })),
  }

  const legend: GraphLegendEntry[] = [...palette.entries()].map(([type, colors]) => ({
    type,
    color: colors.border,
  }))

  return { data, legend }
}

function getSimulationProfile(nodeCount: number): { alphaDecay: number; cooldownTime: number; velocityDecay: number } {
  if (nodeCount > 2000) {
    return {
      alphaDecay: 0.06,
      cooldownTime: 2000,
      velocityDecay: 0.45,
    }
  }

  return {
    alphaDecay: 0.028,
    cooldownTime: 12000,
    velocityDecay: 0.34,
  }
}

type ForceGraphInstance = {
  centerAt?: {
    (): { x: number; y: number }
    (x: number, y: number): unknown
  }
  screen2GraphCoords?: (x: number, y: number) => { x: number; y: number }
}

function requestGraphRedraw(graph: ForceGraphInstance | undefined) {
  if (!graph?.centerAt) {
    return
  }

  const center = graph.centerAt()

  graph.centerAt(center.x, center.y)
}

function getViewportBounds(graph: ForceGraphInstance | undefined, size: { height: number; width: number }): GraphViewportBounds | null {
  if (!graph?.screen2GraphCoords) {
    return null
  }

  const topLeft = graph.screen2GraphCoords(0, 0)
  const bottomRight = graph.screen2GraphCoords(size.width, size.height)

  return {
    bottom: Math.max(topLeft.y, bottomRight.y),
    left: Math.min(topLeft.x, bottomRight.x),
    right: Math.max(topLeft.x, bottomRight.x),
    top: Math.min(topLeft.y, bottomRight.y),
  }
}

type Adjacency = {
  linksByNodeId: Map<string, Set<string>>
  neighborsByNodeId: Map<string, Set<string>>
}

type NodeSelectionState = 'connected' | 'selected' | 'unrelated'

function createAdjacency(graphData: ForceGraphData): Adjacency {
  const linksByNodeId = new Map<string, Set<string>>()
  const neighborsByNodeId = new Map<string, Set<string>>()

  for (const node of graphData.nodes) {
    linksByNodeId.set(node.id, new Set())
    neighborsByNodeId.set(node.id, new Set())
  }

  for (const link of graphData.links) {
    const sourceId = getLinkNodeId(link.source)
    const targetId = getLinkNodeId(link.target)

    linksByNodeId.get(sourceId)?.add(link.id)
    linksByNodeId.get(targetId)?.add(link.id)
    neighborsByNodeId.get(sourceId)?.add(targetId)
    neighborsByNodeId.get(targetId)?.add(sourceId)
  }

  return {
    linksByNodeId,
    neighborsByNodeId,
  }
}

function getNodeSelectionState(node: ForceGraphNode, selectedNodeId: string | null, adjacency: Adjacency): NodeSelectionState | null {
  if (!selectedNodeId) {
    return null
  }

  if (node.id === selectedNodeId) {
    return 'selected'
  }

  if (adjacency.neighborsByNodeId.get(selectedNodeId)?.has(node.id)) {
    return 'connected'
  }

  return 'unrelated'
}

function drawNode(
  node: ForceGraphNode,
  canvas: CanvasRenderingContext2D,
  globalScale: number,
  selectionState: NodeSelectionState | null,
  viewportBounds: GraphViewportBounds | null,
) {
  const radius = getNodeRadius(node)
  const x = node.x ?? 0
  const y = node.y ?? 0
  const isSelected = selectionState === 'selected'
  const isConnected = selectionState === 'connected'
  const isUnrelated = selectionState === 'unrelated'

  if (viewportBounds && !isNodeInViewport(x, y, radius, viewportBounds, globalScale)) {
    return
  }

  canvas.globalAlpha = isUnrelated ? 0.1 : 1

  if (isSelected) {
    canvas.beginPath()
    canvas.arc(x, y, radius + 5 / globalScale, 0, 2 * Math.PI, false)
    canvas.fillStyle = 'rgba(17, 24, 39, 0.16)'
    canvas.fill()
  }

  canvas.beginPath()
  canvas.arc(x, y, radius, 0, 2 * Math.PI, false)
  canvas.fillStyle = isSelected ? node.borderColor : node.color
  canvas.fill()
  canvas.lineWidth = (isConnected ? 4.5 : isSelected ? 3 : 1) / globalScale
  canvas.strokeStyle = node.borderColor
  canvas.stroke()
  canvas.globalAlpha = 1

  if (globalScale < 1.15) {
    return
  }

  if (isUnrelated) {
    return
  }

  const fontSize = Math.max(8 / globalScale, 3.8)

  canvas.font = `600 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`
  canvas.textAlign = 'center'
  canvas.textBaseline = 'top'
  canvas.fillStyle = '#374151'
  canvas.fillText(truncateLabel(node.label), x, y + radius + 2 / globalScale)
}

function isNodeInViewport(x: number, y: number, radius: number, bounds: GraphViewportBounds, globalScale: number): boolean {
  const margin = radius + 40 / globalScale

  return x >= bounds.left - margin && x <= bounds.right + margin && y >= bounds.top - margin && y <= bounds.bottom + margin
}

function paintNodePointerArea(node: ForceGraphNode, color: string, canvas: CanvasRenderingContext2D, globalScale: number) {
  const radius = getNodeRadius(node) + 3 / globalScale

  canvas.beginPath()
  canvas.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI, false)
  canvas.fillStyle = color
  canvas.fill()
}

function getNodeRadius(node: ForceGraphNode): number {
  return Math.sqrt(Math.max(node.val, 1)) * 3.2
}

function getRenderedLinkColor(link: ForceGraphLink, selectedNodeId: string | null): string {
  if (!selectedNodeId) {
    return link.color
  }

  if (isLinkConnectedToNode(link, selectedNodeId)) {
    return getHighlightedLinkColor(link.type)
  }

  return 'rgba(148, 163, 184, 0.045)'
}

function getRenderedLinkWidth(link: ForceGraphLink, selectedNodeId: string | null): number {
  if (!selectedNodeId) {
    return 0.7
  }

  return isLinkConnectedToNode(link, selectedNodeId) ? 2.6 : 0.2
}

function isLinkConnectedToNode(link: ForceGraphLink, nodeId: string): boolean {
  return getLinkNodeId(link.source) === nodeId || getLinkNodeId(link.target) === nodeId
}

function getLinkNodeId(node: string | ForceGraphNode): string {
  return typeof node === 'string' ? node : node.id
}

function truncateLabel(label: string): string {
  if (label.length <= 34) {
    return label
  }

  return `${label.slice(0, 31)}...`
}

function humanizeRelationship(type: string): string {
  return type.toLowerCase().replaceAll('_', ' ')
}

function getLinkColor(_type: string): string {
  return 'rgba(148, 163, 184, 0.28)'
}

function getHighlightedLinkColor(_type: string): string {
  return 'rgba(99, 102, 241, 0.68)'
}

function getNodeLabel(node: GraphVisualizationNode): string {
  const fqcn = node.properties.fqcn

  if (typeof fqcn === 'string' && fqcn.trim()) {
    return compactFqcn(fqcn)
  }

  const name = node.properties.name

  if (typeof name === 'string' && name.trim()) {
    return name
  }

  const id = node.properties.id

  if (typeof id === 'string' && id.trim()) {
    return id
  }

  for (const value of Object.values(node.properties)) {
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return node.labels?.[0] ?? node.type
}

function compactFqcn(fqcn: string): string {
  const separator = fqcn.indexOf('::')

  if (separator === -1) {
    return fqcn
  }

  const owner = fqcn.slice(0, separator)
  const member = fqcn.slice(separator + 2)
  const ownerShort = owner.split('\\').pop() ?? owner

  return `${ownerShort}::${member}`
}
