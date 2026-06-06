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
      <div className="mb-8 flex items-center gap-3">
        <div
          className={[
            'grid size-[54px] shrink-0 place-items-center rounded-lg border border-[#00e676] bg-[#00e676] text-[#111827]',
          ].join(' ')}
        >
          <Icon name="graph" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <div className="truncate text-[9px] font-black leading-[1] tracking-wide text-[#374151]">
              DAVID BEL'S
            </div>
            <div className="-ml-px truncate text-2xl font-black tracking-tighter leading-[1.1] text-[#ff4e08]">
              Magentic
            </div>
            <div className="truncate text-xs leading-[1] text-[#4b5563]">MCP Server for Agentic AI</div>
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

      <button
        type="button"
        className="mt-4 flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#e5e7eb] bg-white text-xs text-[#4b5563] transition hover:border-[#ff4e08] hover:bg-[#fff0e8] hover:text-[#ff4e08] focus:outline-none"
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
        'group flex h-9 items-center gap-2.5 rounded-lg border px-[18px] text-left transition focus:outline-none',
        isCollapsed ? 'justify-center' : 'justify-start',
        isActive
          ? 'border-[#8ff0b1] bg-[#d8ffe8] text-[#111827]'
          : 'border-transparent text-[#374151] hover:border-[#ffb18d] hover:bg-[#fff0e8] hover:text-[#ff4e08]',
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
