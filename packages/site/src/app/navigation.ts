export type ViewId = 'welcome' | 'graph' | 'history' | 'database' | 'setup' | 'settings'

export type IconName = 'home' | 'graph' | 'history' | 'database' | 'plug' | 'settings' | 'chevron'

export type NavigationItem = {
  id: ViewId
  label: string
  icon: IconName
}

export const viewRoutes: Record<ViewId, string> = {
  welcome: '/',
  graph: '/graph',
  history: '/history',
  database: '/database',
  setup: '/setup',
  settings: '/settings',
}

export const navigationItems: NavigationItem[] = [
  { id: 'welcome', label: 'Welcome', icon: 'home' },
  { id: 'graph', label: 'Graph', icon: 'graph' },
  { id: 'history', label: 'Query History', icon: 'history' },
  { id: 'database', label: 'Database', icon: 'database' },
  { id: 'setup', label: 'MCP Setup', icon: 'plug' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]
