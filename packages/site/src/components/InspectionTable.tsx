import React from 'react'

export type InspectionValue =
  | string
  | number
  | boolean
  | null
  | InspectionValue[]
  | { [key: string]: InspectionValue }

export type InspectionTableProps = {
  columns: string[]
  rows: Array<Record<string, InspectionValue>>
}

const HIDDEN_ENTITY_KEYS = new Set(['id', 'labels', 'kind', 'type', 'startNodeId', 'endNodeId', 'properties'])

export const InspectionTable: React.FC<InspectionTableProps> = ({ columns, rows }) => (
  <div className="h-full overflow-auto">
    <table className="w-full border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 bg-gray-50">
        <tr>
          {columns.map((column) => (
            <th
              key={column}
              className="border-b border-gray-200 px-4 py-2 font-bold uppercase tracking-[0.12em] text-gray-500"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            {columns.map((column) => (
              <td key={column} className="border-b border-gray-100 px-4 py-2 align-top text-gray-900">
                <Cell value={row[column] ?? null} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

const Cell: React.FC<{ value: InspectionValue }> = ({ value }) => {
  if (value === null) {
    return <span className="text-gray-400">—</span>
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span>{String(value)}</span>
  }

  if (Array.isArray(value)) {
    return <span>{value.map((item) => renderScalar(item)).join(', ')}</span>
  }

  const entityId = typeof value.id === 'string' ? value.id : null

  if (entityId) {
    return <EntityCell entityId={entityId} value={value} />
  }

  return <span className="font-mono text-[11px] text-gray-600">{JSON.stringify(value)}</span>
}

const EntityCell: React.FC<{ entityId: string; value: { [key: string]: InspectionValue } }> = ({ entityId, value }) => {
  const properties = isRecord(value.properties) ? value.properties : value
  const keyProps = Object.entries(properties)
    .filter(([key]) => !HIDDEN_ENTITY_KEYS.has(key))
    .slice(0, 3)

  return (
    <div className="min-w-0">
      <div className="truncate font-semibold">{entityId}</div>
      {keyProps.length > 0 ? (
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          {keyProps.map(([key, item]) => (
            <span key={key} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
              {key}: {renderScalar(item)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function renderScalar(value: InspectionValue): string {
  if (value === null) {
    return '—'
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value)
}

function isRecord(value: InspectionValue): value is { [key: string]: InspectionValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
