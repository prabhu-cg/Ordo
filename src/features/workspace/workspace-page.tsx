import { Archive, Layers, MoreHorizontal, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from '@/components/ui/toast'
import type { ShellContext } from '@/components/shell/app-shell'
import { PageHeader } from '@/components/shell/page-header'
import { StorageGate } from '@/components/shell/storage-gate'
import type { Product } from '@/domain'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { CATEGORY_LABELS, HORIZON_LABELS } from '@/lib/labels'
import { useStorageQuery } from '@/lib/use-storage-query'
import { getStorage } from '@/storage'
import { toStorageError } from '@/storage'
import { useWorkspaceStore } from '@/store/workspace-store'

export function WorkspacePage() {
  return (
    <StorageGate>
      <WorkspaceContent />
    </StorageGate>
  )
}

function WorkspaceContent() {
  const { products, activeProductId, archived } = useWorkspaceStore()
  const product = products.find((p) => p.id === activeProductId)

  if (!product) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Workspace" description="The product you are working in." />
        <EmptyState
          icon={<Layers />}
          title="No product yet"
          description={
            archived.length > 0
              ? 'Create a product, or restore an archived one from Data and backup.'
              : 'A product holds your objectives, initiatives, features and roadmaps.'
          }
          action={
            <Button asChild variant="primary">
              <Link to="/app/new">
                <Plus aria-hidden /> Create product
              </Link>
            </Button>
          }
        />
      </div>
    )
  }
  return <ProductWorkspace product={product} />
}

function ProductWorkspace({ product }: { product: Product }) {
  const { openEditProduct } = useOutletContext<ShellContext>()
  const archiveProduct = useWorkspaceStore((s) => s.archiveProduct)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const { data: counts } = useStorageQuery(`counts:${product.id}`, () =>
    getStorage().countsForProduct(product.id),
  )

  const rows: [string, number | undefined][] = [
    ['Objectives', counts?.objectives],
    ['Initiatives', counts?.initiatives],
    ['Features', counts?.features],
    ['Milestones', counts?.milestones],
    ['Roadmaps', counts?.roadmaps],
  ]
  const strategy: [string, string | undefined][] = [
    ['What it is', product.description],
    ['Vision', product.vision],
    ['Who it is for', product.targetAudience],
  ]
  const hasStrategy = strategy.some(([, v]) => v)
  const facts = [
    product.category && CATEGORY_LABELS[product.category],
    product.planningHorizon && HORIZON_LABELS[product.planningHorizon],
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={product.name}
        description={product.tagline}
        meta={
          <>
            {facts.map((f) => (
              <span key={String(f)}>{f} · </span>
            ))}
            Created {formatDate(product.createdAt)} · Updated{' '}
            <span className="tabular-nums">{formatRelativeTime(product.updatedAt)}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => openEditProduct()}>
              <Pencil aria-hidden /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem destructive onSelect={() => setConfirmArchive(true)}>
                  <Archive aria-hidden /> Archive product
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <section aria-labelledby="strategy-heading" className="max-w-prose">
        <h2 id="strategy-heading" className="text-xl">
          Strategy
        </h2>
        {hasStrategy ? (
          <dl className="mt-4 flex flex-col gap-5">
            {strategy.map(([label, value]) =>
              value ? (
                <div key={label}>
                  <dt className="text-body font-semibold text-foreground">{label}</dt>
                  <dd className="mt-1 text-[0.9375rem] leading-7 whitespace-pre-line">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
        ) : (
          <p className="mt-2 text-body text-muted-foreground">
            Nothing written yet. Add a description, vision and audience when you are ready.{' '}
            <button
              type="button"
              onClick={() => openEditProduct()}
              className="rounded-sm font-semibold text-primary-text underline underline-offset-4 hover:text-foreground"
            >
              Edit product
            </button>
          </p>
        )}
      </section>

      <section aria-labelledby="contents-heading" className="max-w-2xl">
        <h2 id="contents-heading" className="text-xl">
          In this workspace
        </h2>
        <p className="mt-1 text-body text-muted-foreground">
          Objectives, initiatives, features and roadmaps arrive in the next phases. Counts are read
          live from this device.
        </p>
        <table className="mt-4 w-full border-separate border-spacing-0 text-left text-body">
          <caption className="sr-only">Records in {product.name}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b px-3 py-2.5 text-label font-semibold text-muted-foreground"
              >
                Kind
              </th>
              <th
                scope="col"
                className="border-b px-3 py-2.5 text-right text-label font-semibold text-muted-foreground"
              >
                Count
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, n]) => (
              <tr key={label}>
                <th scope="row" className="border-b px-3 py-3 font-medium text-foreground">
                  {label}
                </th>
                <td className="border-b px-3 py-3 text-right tabular-nums">{n ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive ${product.name}?`}
        description="It leaves your product list but nothing is deleted. You can restore it any time from Data and backup."
        confirmLabel="Archive product"
        destructive
        onConfirm={async () => {
          try {
            await archiveProduct(product.id)
            toast.success('Product archived', product.name)
          } catch (e) {
            toast.error('Could not archive', toStorageError(e).message)
            throw e
          }
        }}
      />
    </div>
  )
}
