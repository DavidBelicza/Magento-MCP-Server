import React from 'react'
import { Panel, SectionHeader } from '../components/Panel'

export const QueryHistoryView: React.FC = () => {
  const rows = ['Bundle product dependencies', 'Top package authors', 'Magento framework neighborhood']

  return (
    <section className="grid min-h-full grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel className="p-5">
        <SectionHeader title="Query History" eyebrow="Sessions" />
        <div className="mt-5 divide-y divide-[#e5e7eb] overflow-hidden rounded-lg border border-[#e5e7eb]">
          {rows.map((row, index) => (
            <button
              type="button"
              key={row}
              className="flex w-full items-center justify-between bg-white px-4 py-3 text-left text-sm font-medium text-[#111827] transition hover:bg-[#fff0e8] hover:text-[#ff4e08] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#00e676]/45"
            >
              <span>{row}</span>
              <span className="text-xs text-[#4b5563]">Session {index + 1}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHeader title="Preview" eyebrow="Selected query" />
        <div className="mt-5 h-40 rounded-lg border border-dashed border-[#9ca3af] bg-white" />
      </Panel>
    </section>
  )
}
