import React, { useEffect, useState } from 'react'
import { getApiToken, setApiToken, UNAUTHORIZED_EVENT } from '../lib/api'

export const TokenGate: React.FC = () => {
  const [open, setOpen] = useState(() => getApiToken() === '')
  const [token, setToken] = useState(() => getApiToken())
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const onUnauthorized = () => setOpen(true)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  if (!open) {
    return null
  }

  const save = async () => {
    const value = token.trim()
    setChecking(true)
    setError(null)

    try {
      const response = await fetch('/api/config', { headers: { Authorization: `Bearer ${value}` } })

      if (response.ok) {
        setApiToken(value)
        window.location.reload()
        return
      }

      setError('Invalid token')
    } catch {
      setError('Invalid token')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-md">
        <h2 className="text-lg font-black tracking-wide text-[#111827]">API token required</h2>
        <p className="mt-2 text-sm leading-6 text-[#4b5563]">
          Magentic is protected by an API token that you find in your <code>.env</code> file in the project root. If you
          changed your default token then restart the server first.
        </p>
        <p className="mt-2 text-sm font-bold leading-6 text-[#111827]">Enter the token to use Magentic.</p>
        <input
          type="text"
          value={token}
          autoFocus
          onChange={(event) => {
            setToken(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && token.trim() !== '') {
              void save()
            }
          }}
          placeholder="API token"
          className="mt-4 h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] focus:border-[#cbd5e1] focus:outline-none"
        />
        {error && <p className="mt-2 text-sm font-semibold text-[#fd8504]">{error}</p>}
        <button
          type="button"
          disabled={token.trim() === '' || checking}
          onClick={() => void save()}
          className="mt-4 h-10 w-full cursor-pointer rounded-lg bg-[#00e676] text-sm font-semibold text-[#111827] transition hover:bg-[#00c853] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Save & reload'}
        </button>
      </div>
    </div>
  )
}
