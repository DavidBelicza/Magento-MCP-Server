import React from 'react'
import { Panel, SectionHeader, WireRow } from '../components/Panel'

export const MCPSetupView: React.FC = () => {
  return (
    <section className="grid min-h-full grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel className="p-5">
        <SectionHeader title="MCP Setup" eyebrow="Connection" />
        <div className="mt-5 grid gap-3">
          <WireRow title="Server" value="Not running" />
          <WireRow title="IDE integration" value="Pending" />
          <WireRow title="Client links" value="Planned" />
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHeader title="Configuration" eyebrow="Preview" />
        <pre className="mt-5 overflow-auto rounded-lg border border-slate-200 bg-[#183d28] p-4 text-xs leading-6 text-white">
{`{
  "mcpServers": {
    "graphrag": {
      "command": "..."
    }
  }
}`}
        </pre>
      </Panel>
    </section>
  )
}
