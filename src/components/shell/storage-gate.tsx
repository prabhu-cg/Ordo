import { RefreshCw } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspaceStore } from '@/store/workspace-store'

/** Shows the loading and error states of local storage; renders children only once data is ready. */
export function StorageGate({ children }: { children: React.ReactNode }) {
  const { status, error, init } = useWorkspaceStore()

  if (status === 'error' && error) {
    return (
      <div className="max-w-2xl">
        <Alert
          tone="destructive"
          title="Ordo cannot open your saved work"
          action={
            <Button variant="outline" size="sm" onClick={() => void init()}>
              <RefreshCw aria-hidden /> Try again
            </Button>
          }
        >
          <p>{error.message}</p>
          <p className="mt-1">{error.recovery}</p>
        </Alert>
      </div>
    )
  }

  if (status !== 'ready') {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-4">
        <span className="sr-only">Opening your workspace</span>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <Skeleton className="mt-4 h-40 w-full rounded-card" />
      </div>
    )
  }
  return <>{children}</>
}
