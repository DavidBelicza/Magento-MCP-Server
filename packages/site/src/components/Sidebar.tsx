import React from 'react'
import { Icon } from './Icon'
import { navigationItems } from '../app/navigation'
import type { NavigationItem, ViewId } from '../app/navigation'

type SidebarProps = {
  activeView: ViewId
  isCollapsed: boolean
  onNavigate: (viewId: ViewId) => void
  onToggle: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  isCollapsed,
  onNavigate,
  onToggle,
}) => {
  return (
    <aside
      className={[
        'hidden min-h-0 shrink-0 flex-col px-3 py-4 transition-[width] duration-200 md:flex',
        isCollapsed ? 'w-[78px]' : 'w-[244px]',
      ].join(' ')}
    >
      <div className="mb-10 flex items-center gap-3">
        <div
          className={[
            'grid size-[54px] shrink-0 place-items-center overflow-hidden rounded-lg',
          ].join(' ')}
        >
          <img src="/logo.png" alt="Magentic logo" className="size-full object-contain" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <div className="-ml-px truncate text-3xl font-black tracking-tighter leading-[1.2] text-gray-900">
              Magentic
            </div>
            <div className="truncate text-xs leading-[1] text-gray-600">MCP Server for Agentic AI</div>
          </div>
        )}
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto" aria-label="Main navigation">
        {navigationItems.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            isActive={activeView === item.id}
            isCollapsed={isCollapsed}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      {!isCollapsed && (
        <a
          href="https://davidbel.com?magentic=1"
          target="_blank"
          rel="noreferrer"
          className="mt-4 block shrink-0 truncate text-center text-[9px] font-black tracking-wide text-gray-400 transition-colors hover:text-gray-900"
        >
          Built by David Belicza
        </a>
      )}

      <button
        type="button"
        className="mt-3 flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-900 transition hover:border-slate-300 hover:bg-gray-200 focus:outline-none"
        onClick={onToggle}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span className={isCollapsed ? 'rotate-180 transition-transform' : 'transition-transform'}>
          <Icon name="chevron" />
        </span>
        {!isCollapsed && <span className="text-xs font-medium">Collapse</span>}
      </button>
    </aside>
  )
}

type SidebarItemProps = {
  item: NavigationItem
  isActive: boolean
  isCollapsed: boolean
  onClick: () => void
}

const SidebarItem: React.FC<SidebarItemProps> = ({ item, isActive, isCollapsed, onClick }) => {
  return (
    <button
      type="button"
      className={[
        'group flex h-9 cursor-pointer items-center gap-2.5 rounded-lg border px-[18px] text-left transition focus:outline-none',
        isCollapsed ? 'justify-center' : 'justify-start',
        isActive
          ? 'border-slate-300 bg-gray-200 text-gray-900'
          : 'border-transparent text-gray-900 hover:border-slate-300 hover:bg-gray-200',
      ].join(' ')}
      onClick={onClick}
      aria-label={item.label}
      title={isCollapsed ? item.label : undefined}
    >
      <span className="shrink-0 [&_svg]:h-4 [&_svg]:w-4">
        <Icon name={item.icon} />
      </span>
      {!isCollapsed && (
        <span className={['truncate font-medium', isActive ? 'text-sm' : 'text-sm'].join(' ')}>
          {item.label}
        </span>
      )}
    </button>
  )
}
