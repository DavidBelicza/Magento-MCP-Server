import cytoscape from 'cytoscape'
import type { Core, ElementDefinition } from 'cytoscape'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { MockAuthorPackages } from './graphMockData'

type GraphVisualizationProps = {
  authors: MockAuthorPackages[]
}

export type GraphVisualizationHandle = {
  resetView: () => void
}

export const GraphVisualization = forwardRef<GraphVisualizationHandle, GraphVisualizationProps>(({ authors }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const graphRef = useRef<Core | null>(null)
  const elements = useMemo(() => createElements(authors), [authors])

  useImperativeHandle(ref, () => ({
    resetView: () => {
      graphRef.current?.fit(undefined, 32)
    },
  }))

  useEffect(() => {
    if (!containerRef.current) {
      return undefined
    }

    graphRef.current = cytoscape({
      container: containerRef.current,
      elements,
      layout: {
        name: 'cose',
        animate: false,
        fit: true,
        padding: 32,
        nodeRepulsion: 9000,
        idealEdgeLength: 72,
      },
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#ffffff',
            'border-color': '#d1d5db',
            'border-width': 1,
            color: '#374151',
            'font-size': '8px',
            height: '18px',
            label: 'data(label)',
            'overlay-opacity': 0,
            shape: 'ellipse',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.72,
            'text-background-padding': '2px',
            'text-max-width': '82px',
            'text-valign': 'bottom',
            'text-wrap': 'wrap',
            width: '18px',
          },
        },
        {
          selector: 'node[type = "author"]',
          style: {
            'background-color': '#00e676',
            'border-color': '#009f52',
            'border-width': 2,
            color: '#111827',
            'font-size': '10px',
            'font-weight': 700,
            height: 'mapData(packageCount, 1, 40, 34, 64)',
            width: 'mapData(packageCount, 1, 40, 34, 64)',
          },
        },
        {
          selector: 'node[type = "package"]',
          style: {
            'background-color': '#fff7ed',
            'border-color': '#ff4e08',
          },
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'line-color': '#cbd5e1',
            opacity: 0.64,
            'target-arrow-color': '#cbd5e1',
            'target-arrow-shape': 'triangle',
            width: 1,
          },
        },
      ],
    })

    return () => {
      graphRef.current?.destroy()
      graphRef.current = null
    }
  }, [elements])

  return <div ref={containerRef} className="h-full w-full" />
})

function createElements(authors: MockAuthorPackages[]): ElementDefinition[] {
  const packageNodes = new Map<string, ElementDefinition>()
  const elements: ElementDefinition[] = []

  for (const author of authors) {
    elements.push({
      data: {
        id: author.id,
        label: author.name,
        packageCount: author.packages.length,
        type: 'author',
      },
    })

    for (const composerPackage of author.packages) {
      if (!packageNodes.has(composerPackage.id)) {
        packageNodes.set(composerPackage.id, {
          data: {
            id: composerPackage.id,
            label: composerPackage.name,
            type: 'package',
          },
        })
      }

      elements.push({
        data: {
          id: `${composerPackage.id}->${author.id}`,
          source: composerPackage.id,
          target: author.id,
        },
      })
    }
  }

  return [...packageNodes.values(), ...elements]
}
