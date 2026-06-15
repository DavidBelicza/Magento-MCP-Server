import React from 'react'
import { MetricPanel, Panel, SectionHeader, WireRow } from '../components/Panel'

export const DatabaseView: React.FC = () => {
  return (
    <section className="grid gap-5 lg:grid-cols-3">
      <MetricPanel label="Packages" value="951" />
      <MetricPanel label="Authors" value="158" />
      <MetricPanel label="Edges" value="4,960" />
      <Panel className="p-5 lg:col-span-3">
        <SectionHeader title="Database" />
        <div className="mt-5 grid gap-3">
          <WireRow title="Source" value="/mnt/analyzed-source/composer.lock" />
          <WireRow title="Storage" value="Neo4j local graph" />
          <WireRow title="Last import" value="Composer lock indexing" />
        </div>
      </Panel>
    </section>
  )
}
