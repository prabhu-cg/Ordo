import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'

/** A page file that could not be fetched, usually because a new version was released while this one was open. */
const isStaleBuild = (message: string) =>
  /dynamically imported module|Importing a module script failed|Loading chunk|Failed to fetch/i.test(
    message,
  )

function describe(error: unknown): { message: string; stale: boolean } {
  if (isRouteErrorResponse(error))
    return { message: `${error.status} ${error.statusText}`.trim(), stale: false }
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error')
  return { message, stale: isStaleBuild(message) }
}

function ErrorView({ error }: { error: unknown }) {
  const { message, stale } = describe(error)
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-5 px-6 py-16"
    >
      <p className="text-label font-semibold text-muted-foreground">Ordo</p>
      <h1 className="text-headline leading-tight">
        {stale ? 'Ordo has been updated' : 'Something went wrong'}
      </h1>
      <p className="text-title text-ink">
        {stale
          ? 'A newer version was released while this page was open. Reload to get it. Your work is saved in this browser and is not affected.'
          : 'This page could not be shown. Your work is saved in this browser and has not been lost. Reloading usually fixes it.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button asChild variant="outline">
          <a href="/app">Go to your dashboard</a>
        </Button>
        <Button asChild variant="ghost">
          <a href="/app/data">Back up your data</a>
        </Button>
      </div>
      {!stale && (
        <details className="text-body text-muted-foreground">
          <summary className="cursor-pointer">Technical details</summary>
          {/* Shown as text only, never as markup. */}
          <pre className="mt-2 max-w-full overflow-x-auto rounded-input bg-sand p-3 text-caption whitespace-pre-wrap">
            {message}
          </pre>
        </details>
      )}
    </main>
  )
}

/** For routes: React Router hands this the error a page or a page's loader threw. */
export function RouteError() {
  return <ErrorView error={useRouteError()} />
}

/** For everything outside the routes: if drawing the app itself fails, show this instead of a blank page. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error?: unknown }> {
  state: { error?: unknown } = {}
  static getDerivedStateFromError(error: unknown) {
    return { error }
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Kept on this device, in the console. Nothing is sent anywhere.
    console.error('Ordo could not draw a screen.', error, info.componentStack)
  }
  render() {
    return this.state.error !== undefined ? (
      <ErrorView error={this.state.error} />
    ) : (
      this.props.children
    )
  }
}
