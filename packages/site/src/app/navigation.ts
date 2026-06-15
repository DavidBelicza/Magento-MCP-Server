export type ViewId = 'welcome' | 'graph' | 'history' | 'database' | 'settings'

export type IconName = 'home' | 'graph' | 'history' | 'database' | 'activity' | 'plug' | 'settings' | 'chevron'

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
  settings: '/settings',
}

export const navigationItems: NavigationItem[] = [
  { id: 'welcome', label: 'Welcome', icon: 'home' },
  { id: 'graph', label: 'Graph', icon: 'graph' },
  { id: 'history', label: 'Query History', icon: 'history' },
  { id: 'database', label: 'Self Diagnosis', icon: 'activity' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]
