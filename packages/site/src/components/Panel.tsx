import React from 'react'

export const Panel: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      {children}
    </div>
  )
}

export const SectionHeader: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    </div>
  )
}

export const WireRow: React.FC<{ title: string; value: string }> = ({ title, value }) => {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4">
      <span className="text-sm text-gray-600">{title}</span>
      <span className="truncate text-sm font-semibold text-gray-900">{value}</span>
    </div>
  )
}

export const ToolbarButton: React.FC<{ label: string }> = ({ label }) => {
  return (
    <button
      type="button"
      className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900 transition hover:border-brand hover:bg-brand-soft hover:text-brand focus:outline-none focus:ring-2 focus:ring-accent/45"
    >
      {label}
    </button>
  )
}

export const MetricPanel: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  return (
    <Panel className="p-5">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-3 text-3xl font-bold text-gray-900">{value}</div>
    </Panel>
  )
}
