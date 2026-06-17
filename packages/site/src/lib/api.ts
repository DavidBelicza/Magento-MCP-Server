const TOKEN_KEY = 'magentic_api_token'

export function getApiToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch (error) {
    console.warn('Could not read the API token from localStorage', error)
    return ''
  }
}

export function setApiToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch (error) {
    console.warn('Could not persist the API token to localStorage', error)
  }
}

export const UNAUTHORIZED_EVENT = 'magentic:unauthorized'

export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getApiToken()
  const headers = new Headers(init.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, { ...init, headers }).then((response) => {
    if (response.status === 401) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }

    return response
  })
}
