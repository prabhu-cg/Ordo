import type { createBrowserRouter } from 'react-router-dom'

type Router = ReturnType<typeof createBrowserRouter>

let previous: string | null = null
let current: string | null = null

/** Remembers the page you were on before the current one, so a closing drawer can tell where "back" leads. */
export function trackNavigation(router: Pick<Router, 'state' | 'subscribe'>) {
  current = router.state.location.pathname
  router.subscribe((state) => {
    const next = state.location.pathname
    if (next !== current) {
      previous = current
      current = next
    }
  })
}

/** True when going back stays inside the app, rather than returning to the public site or leaving it. */
export function previousPageIsInApp() {
  return previous !== null && (previous === '/app' || previous.startsWith('/app/'))
}
