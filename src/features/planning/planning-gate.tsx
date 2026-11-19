import { Layers, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shell/page-header'
import { StorageGate } from '@/components/shell/storage-gate'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlanningStore } from '@/store/planning-store'
import { useWorkspaceStore } from '@/store/workspace-store'

/**
 * Wraps every planning page: waits for storage, needs an active product, and shows loading and error
 * states for the product's planning data. Children render only when everything is ready.
 */
export function PlanningGate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <StorageGate>
      <NeedsProduct title={title}>{children}</NeedsProduct>
    </StorageGate>
  )
}

function NeedsProduct({ title, children }: { title: string; children: React.ReactNode }) {
  const activeProductId = useWorkspaceStore((s) => s.activeProductId)
  const { productId, status, error, reload } = usePlanningStore()

  if (!activeProductId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={title} description="Plan inside a product." />
        <EmptyState
          icon={<Layers />}
          title="No product yet"
          description="Create a product first. Objectives, initiatives and features live inside it."
          action={
            <Button asChild variant="primary">
              <Link to="/app/new">Create a product</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (status === 'error' && error && productId === activeProductId) {
    return (
      <Alert
        tone="destructive"
        title="Could not open this product's plan"
        className="max-w-2xl"
        action={
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw aria-hidden /> Try again
          </Button>
        }
      >
        <p>{error.message}</p>
        <p className="mt-1">{error.recovery}</p>
      </Alert>
    )
  }

  if (productId !== activeProductId || status !== 'ready') {
    return (
      <div role="status" aria-live="polite" className="flex flex-col gap-4">
        <span className="sr-only">Opening {title.toLowerCase()}</span>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
        <Skeleton className="mt-4 h-48 w-full rounded-card" />
      </div>
    )
  }
  return <>{children}</>
}
