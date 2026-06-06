import React from 'react'
import { Panel, SectionHeader, WireRow } from '../components/Panel'

export const SettingsView: React.FC = () => {
  return (
    <Panel className="max-w-3xl p-5">
      <SectionHeader title="Settings" eyebrow="Preferences" />
      <div className="mt-5 grid gap-3">
        <WireRow title="Default project" value="Not selected" />
        <WireRow title="Sidebar" value="Expanded" />
        <WireRow title="Theme" value="Light" />
        <WireRow title="LLM provider" value="Not configured" />
      </div>
    </Panel>
  )
}
