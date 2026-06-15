import React from 'react'
import type { IconName } from '../app/navigation'

export const Icon: React.FC<{ name: IconName }> = ({ name }) => {
  const commonProps = {
    className: 'h-5 w-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  }

  switch (name) {
    case 'home':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      )
    case 'graph':
      return (
        <svg {...commonProps} aria-hidden="true">
          <circle cx="6" cy="7" r="3" />
          <circle cx="17" cy="6" r="3" />
          <circle cx="15" cy="17" r="3" />
          <path d="m8.7 6.8 5.6-.5" />
          <path d="m7.8 9.5 5.4 5.2" />
          <path d="m16.4 8.9-1 5.2" />
        </svg>
      )
    case 'history':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M4 7v5h5" />
          <path d="M5.7 16.1A8 8 0 1 0 5 7.5" />
          <path d="M12 8v5l3 2" />
        </svg>
      )
    case 'database':
      return (
        <svg {...commonProps} aria-hidden="true">
          <ellipse cx="12" cy="5" rx="7" ry="3" />
          <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
          <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
      )
    case 'activity':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M3 12h4l2.5-7 5 14 2.5-7H21" />
        </svg>
      )
    case 'plug':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="M9 7V3" />
          <path d="M15 7V3" />
          <path d="M7 7h10v4a5 5 0 0 1-10 0V7Z" />
          <path d="M12 16v5" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...commonProps} aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7.7 7.7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.8-1L14.4 3h-4.8l-.3 3.1a7 7 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.8 1l.3 3.1h4.8l.3-3.1a7 7 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...commonProps} aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      )
    default:
      return null
  }
}
