import React, { createContext, useContext, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export type JobProgress = {
  phase?: string
  directory?: string
  directories?: string[]
  step?: string
  steps?: string[]
  current?: number
  total?: number
  processed?: number
  percent?: number
  nodes?: number
  edges?: number
}

export type IndexJob = {
  queue?: string
  name?: string
  state?: string
  timestamp?: number
  progress?: JobProgress | number | null
}

export type StatusData = {
  indexing: { inProgress: number; locked: boolean; items: IndexJob[] }
  indexed: boolean
  agent: { connected: boolean; lastSeenAt: number | null }
  watcherEnabled: boolean
}

const pollIntervalMs = 3000

const StatusContext = createContext<StatusData | null>(null)

export const StatusProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = useState<StatusData | null>(null)

  useEffect(() => {
    let active = true

    const poll = () => {
      apiFetch('/api/status')
        .then((response) => {
          if (!response.ok) {
            throw new Error(`status ${response.status}`)
          }

          return response.json()
        })
        .then((data: StatusData) => {
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

  return <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
}

export function useStatus(): StatusData | null {
  return useContext(StatusContext)
}
