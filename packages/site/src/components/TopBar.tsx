import React, { useEffect, useState } from 'react'

type HealthState = 'checking' | 'ready' | 'error'

export const TopBar: React.FC<{ activeLabel: string }> = ({ activeLabel }) => {
  const health = useBackendHealth()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between bg-white/72 px-4 backdrop-blur md:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold tracking-wide text-[#111827]">{activeLabel}</h1>
        <p className="truncate text-xs text-[#4b5563]">Local graph workspace</p>
      </div>
      <div className="flex items-center gap-3">
        <StatusPill label="MCP" value="Not connected" tone="amber" />
        <StatusPill label="Backend" value={getHealthLabel(health)} tone={health === 'ready' ? 'emerald' : 'amber'} />
      </div>
    </header>
  )
}

type StatusPillProps = {
  label: string
  value: string
  tone: 'amber' | 'emerald'
}

const StatusPill: React.FC<StatusPillProps> = ({ label, value, tone }) => {
  const toneClass = tone === 'emerald' ? 'bg-[#00e676]' : 'bg-[#ff4e08]'

  return (
    <div className="hidden h-8 items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 text-xs text-[#111827] sm:flex">
      <span className={`h-2 w-2 rounded-full ${toneClass}`} />
      <span className="text-[#6b7280]">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function useBackendHealth(): HealthState {
  const [health, setHealth] = useState<HealthState>('checking')

  useEffect(() => {
    let active = true

    fetch('/api/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Health check failed with ${response.status}`)
        }

        if (active) {
          setHealth('ready')
        }
      })
      .catch(() => {
        if (active) {
          setHealth('error')
        }
      })

    return () => {
      active = false
    }
  }, [])

  return health
}

function getHealthLabel(health: HealthState): string {
  if (health === 'checking') {
    return 'Checking'
  }

  return health === 'ready' ? 'Ready' : 'Offline'
}
