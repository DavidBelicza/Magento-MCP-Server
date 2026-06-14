import React from 'react'
import { Panel, SectionHeader, WireRow } from '../components/Panel'

export const MCPSetupView: React.FC = () => {
  return (
    <section className="grid min-h-full grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel className="p-5">
        <SectionHeader title="MCP Setup" eyebrow="Connection" />
        <div className="mt-5 grid gap-3">
          <WireRow title="Transport" value="Streamable HTTP" />
          <WireRow title="Endpoint" value="http://localhost:8080/mcp" />
          <WireRow title="Tools" value="get_status, graph_search, get_graph_schema" />
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHeader title="Configuration" eyebrow="Preview" />
        <pre className="mt-5 overflow-auto rounded-lg border border-slate-200 bg-[#183d28] p-4 text-xs leading-6 text-white">
{`{
  "mcpServers": {
    "magentic": {
      "url": "http://localhost:8080/mcp"
    }
  }
}`}
        </pre>
      </Panel>
    </section>
  )
}
