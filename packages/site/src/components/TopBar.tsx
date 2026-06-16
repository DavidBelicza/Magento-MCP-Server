import React from 'react'
import { useNavigate } from 'react-router-dom'
import { viewRoutes } from '../app/navigation'
import { useStatus } from '../app/StatusContext'

export const TopBar: React.FC<{ activeLabel: string }> = ({ activeLabel }) => {
  const status = useStatus()
  const navigate = useNavigate()
  const openSettings = () => navigate(viewRoutes.settings)

  const indexing = status?.indexing.inProgress ? true : status?.indexing.locked ?? false
  const agentConnected = status?.agent.connected ?? false

  return (
    <header className="pointer-events-none absolute inset-x-0 top-3 z-30 hidden h-16 items-center justify-between px-4 md:flex md:px-6">
      <div className="pointer-events-auto min-w-0 rounded-2xl border border-white/40 bg-white/55 px-4 py-1.5 shadow-sm backdrop-blur-md">
        <h1 className="truncate text-lg font-bold tracking-wide text-[#111827]">{activeLabel}</h1>
        <p className="truncate text-xs text-[#4b5563]">Local graph workspace</p>
      </div>
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/40 bg-white/55 p-1 shadow-sm backdrop-blur-md">
        <StatusPill
          label="AI agent"
          value={agentConnected ? 'Connected' : 'Idle'}
          tone={agentConnected ? 'emerald' : 'amber'}
          onClick={openSettings}
        />
        <StatusPill
          label="Indexing"
          value={indexing ? 'Indexing' : 'Indexed'}
          tone={indexing ? 'amber' : 'emerald'}
          onClick={openSettings}
        />
      </div>
    </header>
  )
}

type StatusPillProps = {
  label: string
  value: string
  tone: 'amber' | 'emerald'
  onClick: () => void
}

const StatusPill: React.FC<StatusPillProps> = ({ label, value, tone, onClick }) => {
  const toneClass = tone === 'emerald' ? 'bg-[#00e676]' : 'bg-[#fd8504]'

  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden h-7 cursor-pointer items-center gap-2 rounded-xl px-2.5 font-[inherit] font-normal leading-none text-[#111827] transition-colors hover:bg-white/60 sm:flex"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${toneClass}`} />
      <span className="text-[10px] text-[#6b7280]">{label}</span>
      <span className="text-[10px]">{value}</span>
    </button>
  )
}
