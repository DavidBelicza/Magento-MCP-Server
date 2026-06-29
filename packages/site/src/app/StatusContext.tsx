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

export type IndexGroupStatus = { inProgress: number; locked: boolean; items: IndexJob[] }

export type StatusData = {
  indexing: IndexGroupStatus
  vector: IndexGroupStatus
  indexed: boolean
  agent: { connected: boolean; lastSeenAt: number | null }
  watcherEnabled: boolean
}

const pollIntervalMs = 59000
const reconnectBaseMs = 1000
const reconnectMaxMs = 15000

const StatusContext = createContext<StatusData | null>(null)

export const StatusProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = useState<StatusData | null>(null)

  useEffect(() => {
    let active = true
    let controller: AbortController | null = null
    let reconnectTimer = 0
    let attempt = 0

    const fetchOnce = () =>
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
        .catch(() => undefined)

    const connect = () => {
      controller = new AbortController()

      readStatusStream(controller.signal, (data) => {
        if (active) {
          attempt = 0
          setStatus(data)
        }
      })
        .catch(() => undefined)
        .finally(() => {
          if (!active) {
            return
          }

          const delay = Math.min(reconnectMaxMs, reconnectBaseMs * 2 ** attempt)
          attempt += 1
          reconnectTimer = window.setTimeout(() => {
            void fetchOnce()
            connect()
          }, delay)
        })
    }

    void fetchOnce()
    connect()
    const timer = window.setInterval(fetchOnce, pollIntervalMs)

    return () => {
      active = false
      window.clearInterval(timer)
      window.clearTimeout(reconnectTimer)
      controller?.abort()
    }
  }, [])

  return <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
}

async function readStatusStream(signal: AbortSignal, onStatus: (data: StatusData) => void): Promise<void> {
  const response = await apiFetch('/api/stream/status', { signal })

  if (!response.ok || !response.body) {
    throw new Error(`stream ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { value, done } = await reader.read()

    if (done) {
      return
    }

    buffer += decoder.decode(value, { stream: true })

    let separator = buffer.indexOf('\n\n')

    while (separator !== -1) {
      handleStreamEvent(buffer.slice(0, separator), onStatus)
      buffer = buffer.slice(separator + 2)
      separator = buffer.indexOf('\n\n')
    }
  }
}

function handleStreamEvent(raw: string, onStatus: (data: StatusData) => void): void {
  let event = 'message'
  const dataLines: string[] = []

  for (const line of raw.split('\n')) {
    if (line.startsWith(':')) {
      continue
    }

    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }

  if (event !== 'status' || dataLines.length === 0) {
    return
  }

  try {
    onStatus(JSON.parse(dataLines.join('\n')) as StatusData)
  } catch {
    return
  }
}

export function useStatus(): StatusData | null {
  return useContext(StatusContext)
}
