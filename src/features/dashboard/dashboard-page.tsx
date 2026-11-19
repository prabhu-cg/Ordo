import {
  Archive,
  ChevronRight,
  DatabaseBackup,
  Layers,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Plus,
  Presentation,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { ShellContext } from '@/components/shell/app-shell'
import { PageHeader } from '@/components/shell/page-header'
import { StorageGate } from '@/components/shell/storage-gate'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/toast'
import { usePageTitle } from '@/features/marketing/use-page-title'
import type { Product } from '@/domain'
import { formatDate, pluralise } from '@/lib/format'
import { CATEGORY_LABELS } from '@/lib/labels'
import { useStorageQuery } from '@/lib/use-storage-query'
import { getStorage, toStorageError } from '@/storage'
import { useWorkspaceStore } from '@/store/workspace-store'

const MAX_RECENT = 6

export function DashboardPage() {
  usePageTitle('Dashboard')
  return (
    <StorageGate>
      <DashboardContent />
    </StorageGate>
  )
}

function DashboardContent() {
  const { products, onboarding, setOnboarding } = useWorkspaceStore()
  const recent = [...products].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const shown = recent.slice(0, MAX_RECENT)
  const hasProducts = products.length > 0

  return (
    <div className="flex flex-col gap-12">
      <PageHeader
        title={hasProducts ? 'Welcome back' : 'Welcome to Ordo'}
        description={
          hasProducts
            ? 'Pick up where you left off, or start something new.'
            : 'Plan your product and shape your roadmap. Everything stays in this browser.'
        }
        meta={
          hasProducts ? (
            <span className="tabular-nums">
              {pluralise(products.length, 'product')} on this device
            </span>
          ) : undefined
        }
        actions={
          hasProducts ? (
            <Button asChild variant="primary">
              <Link to="/app/new">
                <Plus aria-hidden /> Create new product
              </Link>
            </Button>
          ) : undefined
        }
      />

      {!onboarding && (
        <Alert
          tone="info"
          title="New to roadmaps?"
          action={
            <div className="flex shrink-0 gap-2 self-center">
              <Button asChild variant="outline" size="sm">
                <Link to="/app/onboarding">Start the guide</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void setOnboarding('skipped').catch((e) =>
                    toast.error('Could not save your choice', toStorageError(e).message),
                  )
                }
              >
                Skip for now
              </Button>
            </div>
          }
        >
          A five-step guide explains objectives, initiatives, features, prioritisation and roadmap
          views in about two minutes. You can find it again in the sidebar.
        </Alert>
      )}

      {hasProducts ? (
        <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="recent-heading" className="text-xl">
              Recent products
            </h2>
            {products.length > shown.length && (
              <p className="text-caption text-muted-foreground">
                Showing {shown.length} of {products.length}. Use the product switcher for the rest.
              </p>
            )}
          </div>
          <ProductGrid products={shown} />
        </section>
      ) : (
        <EmptyState
          icon={<Layers />}
          title="Create your first product"
          description="A product holds your objectives, initiatives, features and roadmaps. Start blank or from a template."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="primary">
                <Link to="/app/new">
                  <Plus aria-hidden /> Create your first product
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/new">Start from a template</Link>
              </Button>
              <Button asChild variant="link">
                <Link to="/app/example">Explore the example</Link>
              </Button>
            </div>
          }
        />
      )}

      <QuickActions />
    </div>
  )
}

function ProductGrid({ products }: { products: Product[] }) {
  const { openEditProduct } = useOutletContext<ShellContext>()
  const { selectProduct, archiveProduct } = useWorkspaceStore()
  const [archiving, setArchiving] = useState<Product>()
  const key = products.map((p) => `${p.id}:${p.updatedAt}`).join('|')
  const { data: roadmapCounts } = useStorageQuery(`roadmap-counts:${key}`, async () => {
    const counts = new Map<string, number>()
    for (const r of await getStorage().roadmaps.list())
      counts.set(r.productId, (counts.get(r.productId) ?? 0) + 1)
    return counts
  })

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => {
          const n = roadmapCounts?.get(p.id)
          return (
            <li key={p.id}>
              <Card className="flex h-full flex-col p-5 transition-colors hover:border-border-strong">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-title font-semibold break-words text-foreground">
                    <Link
                      to="/app/workspace"
                      onClick={() => void selectProduct(p.id)}
                      className="rounded-sm hover:text-primary-text hover:underline hover:underline-offset-4"
                    >
                      {p.name}
                    </Link>
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="-mt-1.5 -mr-2 shrink-0"
                        aria-label={`Actions for ${p.name}`}
                      >
                        <MoreHorizontal aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openEditProduct(p.id)}>
                        <Pencil aria-hidden /> Edit details
                      </DropdownMenuItem>
                      <DropdownMenuItem destructive onSelect={() => setArchiving(p)}>
                        <Archive aria-hidden /> Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {p.tagline ? (
                  <p className="mt-1.5 line-clamp-2 text-body text-muted-foreground">{p.tagline}</p>
                ) : (
                  <p className="mt-1.5 text-body text-muted-foreground">No description yet.</p>
                )}
                {(p.category || p.sampleData) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.category && <Badge>{CATEGORY_LABELS[p.category]}</Badge>}
                    {p.sampleData && <Badge variant="outline">Sample data</Badge>}
                  </div>
                )}
                <dl className="mt-auto flex flex-wrap gap-x-5 gap-y-1 pt-5 text-caption text-muted-foreground">
                  <div className="flex gap-1.5">
                    <dt>Updated</dt>
                    <dd className="text-ink tabular-nums">{formatDate(p.updatedAt)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>Roadmaps</dt>
                    <dd className="text-ink tabular-nums">{n ?? '—'}</dd>
                  </div>
                </dl>
                <Button asChild variant="outline" size="sm" className="mt-4 self-start">
                  <Link
                    to="/app/workspace"
                    onClick={() => void selectProduct(p.id)}
                    aria-label={`Open ${p.name}`}
                  >
                    Open <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </Card>
            </li>
          )
        })}
      </ul>
      <ConfirmDialog
        open={Boolean(archiving)}
        onOpenChange={(o) => !o && setArchiving(undefined)}
        title={`Archive ${archiving?.name ?? 'product'}?`}
        description="It leaves your product list but nothing is deleted. You can restore it any time from Data and backup."
        confirmLabel="Archive product"
        destructive
        onConfirm={async () => {
          if (!archiving) return
          try {
            await archiveProduct(archiving.id)
            toast.success('Product archived', archiving.name)
          } catch (e) {
            toast.error('Could not archive', toStorageError(e).message)
            throw e
          }
        }}
      />
    </>
  )
}

const ACTIONS = [
  {
    to: '/app/new',
    icon: Plus,
    title: 'Create a product',
    body: 'Start from scratch with a name and a few details.',
  },
  {
    to: '/app/new',
    icon: LayoutTemplate,
    title: 'Start from a template',
    body: 'Begin with a complete starter plan you can reshape.',
  },
  {
    to: '/app/example',
    icon: Presentation,
    title: 'Explore the example roadmap',
    body: 'Look around a finished plan. It is read-only.',
  },
  {
    to: '/app/onboarding',
    icon: Sparkles,
    title: 'Take the guide',
    body: 'Five short steps on how a plan fits together.',
  },
  {
    to: '/app/data',
    icon: DatabaseBackup,
    title: 'Back up your data',
    body: 'Download everything as a file you can restore later.',
  },
]

function QuickActions() {
  return (
    <section aria-labelledby="quick-heading" className="flex max-w-3xl flex-col gap-3">
      <h2 id="quick-heading" className="text-xl">
        Quick actions
      </h2>
      <ul className="divide-y border-y">
        {ACTIONS.map((a) => (
          <li key={a.title}>
            <Link
              to={a.to}
              className="group flex items-center gap-4 rounded-sm px-1 py-3.5 transition-colors hover:bg-sand"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-input bg-primary-soft text-primary-text"
                aria-hidden
              >
                <a.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-foreground">{a.title}</span>
                <span className="block text-caption text-muted-foreground">{a.body}</span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
