import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { viewRoutes } from '../app/navigation'

type StatusState = {
  indexing: { inProgress: number; locked: boolean }
  agent: { connected: boolean; lastSeenAt: number | null }
}

const pollIntervalMs = 3000

export const TopBar: React.FC<{ activeLabel: string }> = ({ activeLabel }) => {
  const status = useStatus()
  const navigate = useNavigate()
  const openSettings = () => navigate(viewRoutes.settings)

  const indexing = status?.indexing.inProgress ? true : status?.indexing.locked ?? false
  const agentConnected = status?.agent.connected ?? false

  return (
    <header className="flex h-16 shrink-0 items-center justify-between px-4 backdrop-blur md:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold tracking-wide text-[#111827]">{activeLabel}</h1>
        <p className="truncate text-xs text-[#4b5563]">Local graph workspace</p>
      </div>
      <div className="flex items-center gap-3">
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
  const toneClass = tone === 'emerald' ? 'bg-[#00e676]' : 'bg-[#ff4e08]'

  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden h-8 cursor-pointer items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 font-[inherit] text-xs font-normal leading-none text-[#111827] transition-colors hover:border-[#cbd5e1] sm:flex"
    >
      <span className={`h-2 w-2 rounded-full ${toneClass}`} />
      <span className="text-[#6b7280]">{label}</span>
      <span>{value}</span>
    </button>
  )
}

function useStatus(): StatusState | null {
  const [status, setStatus] = useState<StatusState | null>(null)

  useEffect(() => {
    let active = true

    const poll = () => {
      fetch('/api/status')
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Status check failed with ${response.status}`)
          }

          return response.json()
        })
        .then((data: StatusState) => {
          if (active) {
            setStatus(data)
          }
        })
        .catch(() => {
          if (active) {
            setStatus(null)
          }
        })
    }

    poll()
    const timer = window.setInterval(poll, pollIntervalMs)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  return status
}
