import React from 'react'
import { Panel, SectionHeader, WireRow } from '../components/Panel'

export const WelcomeView: React.FC = () => {
  return (
    <div className="grid min-h-full grid-rows-[auto_1fr] gap-5">
      <section className="rounded-lg border border-[#e5e7eb] bg-white p-6 text-[#111827]">
        <div className="max-w-3xl">
          <h2 className="mt-4 text-3xl font-black tracking-wide text-[#111827]">Magentic graph workspace</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#4b5563]">
            Connect a local Magento project, build graph context, and open query results from an IDE or agentic app.
          </p>
        </div>
      </section>

      <section className="grid min-h-0 grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-5">
          <SectionHeader title="Start" eyebrow="First run" />
          <div className="mt-5 grid gap-3">
            <WireRow title="Project" value="No project selected" />
            <WireRow title="MCP endpoint" value="Not configured" />
            <WireRow title="Graph database" value="Local database ready" />
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionHeader title="Recent Graphs" eyebrow="Sessions" />
          <div className="mt-5 space-y-3">
            <GraphSessionStub title="Composer dependencies" meta="No session loaded" />
            <GraphSessionStub title="Package authors" meta="No session loaded" />
            <GraphSessionStub title="Source graph" meta="Planned" />
          </div>
        </Panel>
      </section>
    </div>
  )
}

const GraphSessionStub: React.FC<{ title: string; meta: string }> = ({ title, meta }) => {
  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
      <div className="text-sm font-semibold text-[#111827]">{title}</div>
      <div className="mt-1 text-xs font-bold text-[#ff4e08]">{meta}</div>
    </div>
  )
}
