import { Download, RotateCcw, ShieldCheck, Trash2, Undo2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { PageHeader } from '@/components/shell/page-header'
import { StorageGate } from '@/components/shell/storage-gate'
import { planToCsv } from '@/features/export/csv'
import { downloadText, exportFileName } from '@/features/export/download'
import { formatBytes, formatDate, pluralise } from '@/lib/format'
import { useStorageQuery } from '@/lib/use-storage-query'
import { SCHEMA_VERSION, type Product } from '@/domain'
import type { StorageError } from '@/storage'
import {
  backupFileName,
  countBackup,
  getStorage,
  parseBackup,
  readBackupVersion,
  requestPersistence,
  serializeBackup,
  toStorageError,
  type BackupFile,
  type StorageInfo,
} from '@/storage'
import { usePlanningStore } from '@/store/planning-store'
import { useWorkspaceStore } from '@/store/workspace-store'

/** The largest file we will read. Real backups are a few hundred kilobytes; this is far beyond that. */
const MAX_BACKUP_BYTES = 50 * 1024 * 1024

export function DataPage() {
  return (
    <StorageGate>
      <DataContent />
    </StorageGate>
  )
}

async function downloadBackup() {
  const backup = await getStorage().exportBackup()
  downloadText(backupFileName(), serializeBackup(backup), 'application/json')
  return countBackup(backup)
}

/** Put every screen's copy of the data right after the data itself has changed underneath it. */
async function refreshEverything(refresh: () => Promise<void>, loadInfo: () => Promise<void>) {
  await refresh()
  await usePlanningStore.getState().reload()
  await loadInfo()
}

function DataContent() {
  const refresh = useWorkspaceStore((s) => s.refresh)
  const {
    data: info,
    error: infoError,
    reload: loadInfo,
  } = useStorageQuery('storage-info', () => getStorage().info())
  const { data: previous, reload: loadPrevious } = useStorageQuery('previous-copy', () =>
    getStorage().previousCopy(),
  )
  const changed = async () => {
    await refreshEverything(refresh, loadInfo)
    await loadPrevious()
  }

  return (
    <div className="flex max-w-3xl flex-col gap-12">
      <PageHeader
        title="Data and backup"
        description="Everything you make is stored in this browser. Export it, back it up, bring it back, or delete it."
      />
      <StorageSection info={info} error={infoError} onChanged={loadInfo} />
      <ProductsSection onChanged={changed} />
      <BackupSection />
      <ImportSection currentProducts={info?.counts.products ?? 0} onChanged={changed} />
      {previous && <PreviousSection previous={previous} onChanged={changed} />}
      <ArchivedSection onChanged={changed} />
      <EraseSection />
    </div>
  )
}

function SectionHeading({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children?: React.ReactNode
}) {
  return (
    <div>
      <h2 id={id} className="text-xl">
        {title}
      </h2>
      {children && <p className="mt-1 text-body text-muted-foreground">{children}</p>}
    </div>
  )
}

function StorageSection({
  info,
  error,
  onChanged,
}: {
  info?: StorageInfo
  error?: StorageError
  onChanged: () => Promise<void>
}) {
  const [asking, setAsking] = useState(false)

  async function keep() {
    setAsking(true)
    try {
      const granted = await requestPersistence()
      if (granted)
        toast.success('Protected', 'Your browser will not clear this data automatically.')
      else toast.info('Not granted', 'Your browser decides this. Back up regularly to be safe.')
      await onChanged()
    } finally {
      setAsking(false)
    }
  }

  const rows: [string, React.ReactNode][] = info
    ? [
        ['Location', 'This browser (IndexedDB)'],
        ['Database', `${info.databaseName}, version ${info.databaseVersion}`],
        ['Data format', `Schema ${info.schemaVersion}`],
        [
          'Space used',
          info.usage !== undefined && info.quota
            ? `${formatBytes(info.usage)} of ${formatBytes(info.quota)}`
            : 'Not reported by this browser',
        ],
        [
          'Protected from clearing',
          info.persisted === undefined ? (
            'Not reported by this browser'
          ) : info.persisted ? (
            <Badge variant="success">
              <ShieldCheck aria-hidden /> Yes
            </Badge>
          ) : (
            <span className="flex flex-wrap items-center gap-3">
              <Badge variant="warning">No</Badge>
              <Button variant="outline" size="xs" onClick={keep} loading={asking}>
                Ask the browser to keep it
              </Button>
            </span>
          ),
        ],
      ]
    : []

  return (
    <section aria-labelledby="storage-heading" className="flex flex-col gap-4">
      <SectionHeading id="storage-heading" title="Storage">
        Saved on this device. Clearing site data for Ordo removes it, so keep a backup.
      </SectionHeading>
      {error ? (
        <Alert tone="destructive" title="Could not read storage details">
          {error.message}
        </Alert>
      ) : info ? (
        <dl className="divide-y border-y">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[14rem_1fr] sm:gap-4"
            >
              <dt className="text-body text-muted-foreground">{label}</dt>
              <dd className="text-body text-foreground tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p role="status" className="text-body text-muted-foreground">
          Reading storage details…
        </p>
      )}
    </section>
  )
}

function ProductsSection({ onChanged }: { onChanged: () => Promise<void> }) {
  const { products, archiveProduct, deleteProductForever } = useWorkspaceStore()
  const [deleting, setDeleting] = useState<Product>()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState<string>()
  const target = deleting

  async function run(key: string, label: string, work: () => Promise<void>) {
    setBusy(key)
    try {
      await work()
      toast.success(`${label} ready`, 'It has been saved to your downloads.')
    } catch (e) {
      toast.error(`Could not make the ${label.toLowerCase()}`, toStorageError(e).message)
    } finally {
      setBusy(undefined)
    }
  }

  const backupOf = (p: Product) =>
    run(`json-${p.id}`, 'Backup', async () => {
      const backup = await getStorage().exportProductBackup(p.id)
      downloadText(
        exportFileName([p.name, 'backup'], 'json'),
        serializeBackup(backup),
        'application/json',
      )
    })
  const csvOf = (p: Product) =>
    run(`csv-${p.id}`, 'Spreadsheet', async () => {
      const plan = await getStorage().planning.load(p.id)
      downloadText(exportFileName([p.name], 'csv'), planToCsv(plan), 'text/csv;charset=utf-8')
    })

  return (
    <section aria-labelledby="products-heading" className="flex flex-col gap-4">
      <SectionHeading id="products-heading" title="Your products">
        Take one product out as a backup or a spreadsheet, or remove it. Archiving hides a product
        and can be undone; deleting removes it from this device for good.
      </SectionHeading>
      {products.length === 0 ? (
        <p className="text-body text-muted-foreground">You have no products yet.</p>
      ) : (
        <ul className="divide-y border-y">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="min-w-0 truncate text-body font-semibold text-foreground">{p.name}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  loading={busy === `json-${p.id}`}
                  onClick={() => void backupOf(p)}
                  aria-label={`Download backup of ${p.name}`}
                >
                  <Download aria-hidden /> Backup
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  loading={busy === `csv-${p.id}`}
                  onClick={() => void csvOf(p)}
                  aria-label={`Download CSV spreadsheet of ${p.name}`}
                >
                  <Download aria-hidden /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void archiveProduct(p.id)
                      .then(onChanged)
                      .then(() =>
                        toast.success('Product archived', `${p.name} is hidden. Restore it below.`),
                      )
                      .catch((e) => toast.error('Could not archive', toStorageError(e).message))
                  }
                  aria-label={`Archive ${p.name}`}
                >
                  Archive
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setTyped('')
                    setDeleting(p)
                  }}
                  aria-label={`Delete ${p.name} forever`}
                >
                  <Trash2 aria-hidden /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={`Delete ${target?.name ?? 'product'} forever?`}
        confirmDisabled={typed.trim() !== target?.name}
        description={
          <div className="flex flex-col gap-3">
            <p>
              The product and everything inside it, including its history, is removed from this
              device. This cannot be undone. Download a backup first if you might want it back.
            </p>
            <label className="flex flex-col gap-1.5 text-label font-semibold text-foreground">
              Type the product's name to confirm
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
          </div>
        }
        confirmLabel="Delete forever"
        destructive
        onConfirm={async () => {
          if (!target) return
          try {
            await deleteProductForever(target.id)
            await onChanged()
            toast.success('Product deleted', target.name)
          } catch (e) {
            toast.error('Could not delete', toStorageError(e).message)
            throw e
          }
        }}
      />
    </section>
  )
}

function BackupSection() {
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    try {
      const counts = await downloadBackup()
      toast.success(
        'Backup downloaded',
        `${pluralise(counts.products, 'product')} saved to a file.`,
      )
    } catch (e) {
      toast.error('Backup failed', toStorageError(e).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-labelledby="backup-heading" className="flex flex-col gap-4">
      <SectionHeading id="backup-heading" title="Back up everything">
        Download all your products, templates and history as one JSON file. It is plain text you can
        read, and it is made here, in your browser.
      </SectionHeading>
      <div>
        <Button variant="primary" onClick={run} loading={busy}>
          <Download aria-hidden /> Download all products
        </Button>
      </div>
    </section>
  )
}

interface Pending {
  name: string
  size: number
  backup: BackupFile
  /** The format version the file said it had, before it was brought up to date. */
  fromVersion?: number
}

function ImportSection({
  currentProducts,
  onChanged,
}: {
  currentProducts: number
  onChanged: () => Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending>()
  const [replacing, setReplacing] = useState(false)
  const [error, setError] = useState<string>()
  const [adding, setAdding] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow choosing the same file again
    if (!file) return
    setError(undefined)
    if (file.size > MAX_BACKUP_BYTES) {
      setError('That file is larger than 50 MB, which is far beyond an Ordo backup.')
      return
    }
    try {
      const text = await file.text()
      // Nothing is run or rendered from the file. It is parsed as data and checked against the schema.
      setPending({
        name: file.name,
        size: file.size,
        backup: parseBackup(text),
        fromVersion: readBackupVersion(text),
      })
    } catch (err) {
      setPending(undefined)
      setError(toStorageError(err).message)
    }
  }

  const incoming = pending ? countBackup(pending.backup) : undefined
  const perProduct = pending
    ? pending.backup.data.products.map((p) => ({
        id: p.id,
        name: p.name,
        initiatives: pending.backup.data.initiatives.filter((i) => i.productId === p.id).length,
        features: pending.backup.data.features.filter((f) => f.productId === p.id).length,
        roadmaps: pending.backup.data.roadmaps.filter((r) => r.productId === p.id).length,
      }))
    : []

  async function addAlongside() {
    if (!pending) return
    setAdding(true)
    try {
      const result = await getStorage().importBackup(pending.backup)
      await onChanged()
      toast.success(
        'Imported',
        result.copied
          ? `${pluralise(result.productIds.length, 'product')} added as copies, because the originals are still here.`
          : `${pluralise(result.productIds.length, 'product')} added. Nothing else changed.`,
      )
      setPending(undefined)
    } catch (e) {
      toast.error('Import failed', `${toStorageError(e).message} Nothing was added.`)
    } finally {
      setAdding(false)
    }
  }

  return (
    <section aria-labelledby="restore-heading" className="flex flex-col gap-4">
      <SectionHeading id="restore-heading" title="Import or restore">
        Choose a backup file to see what is in it first. You can add it alongside what you have,
        which changes nothing that is here, or replace everything with it.
      </SectionHeading>
      {error && (
        <Alert tone="destructive" title="That file cannot be used">
          {error} <span className="text-muted-foreground">Nothing was changed.</span>
        </Alert>
      )}
      <div>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={onFile}
          aria-label="Backup file"
          tabIndex={-1}
        />
        <Button variant="outline" onClick={() => input.current?.click()}>
          <Upload aria-hidden /> Choose backup file
        </Button>
      </div>

      <Dialog
        open={Boolean(pending) && !replacing}
        onOpenChange={(o) => !o && !adding && setPending(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What is in this backup</DialogTitle>
            <DialogDescription>
              Nothing has been imported yet. Look it over, then choose what to do.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {pending && incoming && (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-body">
                  <dt className="text-muted-foreground">File</dt>
                  <dd className="min-w-0 truncate font-semibold text-foreground">
                    {pending.name}{' '}
                    <span className="font-normal text-muted-foreground">
                      ({formatBytes(pending.size)})
                    </span>
                  </dd>
                  <dt className="text-muted-foreground">Exported</dt>
                  <dd className="text-foreground">{formatDate(pending.backup.exportedAt)}</dd>
                  <dt className="text-muted-foreground">Format</dt>
                  <dd className="text-foreground">
                    Version {pending.fromVersion ?? pending.backup.schemaVersion}
                    {pending.fromVersion !== undefined && pending.fromVersion < SCHEMA_VERSION && (
                      <span className="text-muted-foreground">
                        {' '}
                        (older, brought up to date as it is read)
                      </span>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Contains</dt>
                  <dd className="text-foreground tabular-nums">
                    {pluralise(incoming.products, 'product')},{' '}
                    {pluralise(incoming.objectives, 'objective')},{' '}
                    {pluralise(incoming.initiatives, 'initiative')},{' '}
                    {pluralise(incoming.features, 'feature')},{' '}
                    {pluralise(incoming.roadmaps, 'roadmap')},{' '}
                    {pluralise(incoming.dependencies, 'dependency', 'dependencies')}
                    {incoming.templates > 0 && `, ${pluralise(incoming.templates, 'template')}`}
                  </dd>
                </dl>
                {perProduct.length > 0 && (
                  <ul className="divide-y rounded-input border">
                    {perProduct.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-body"
                      >
                        <span className="min-w-0 truncate font-semibold text-foreground">
                          {p.name}
                        </span>
                        <span className="text-caption text-muted-foreground tabular-nums">
                          {pluralise(p.initiatives, 'initiative')} ·{' '}
                          {pluralise(p.features, 'feature')} · {pluralise(p.roadmaps, 'roadmap')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-body text-muted-foreground">
                  This device holds {pluralise(currentProducts, 'product')} now.
                </p>
              </>
            )}
          </DialogBody>
          <DialogFooter className="flex-wrap">
            <Button variant="ghost" onClick={() => setPending(undefined)} disabled={adding}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => setReplacing(true)} disabled={adding}>
              Replace everything…
            </Button>
            <Button variant="primary" onClick={() => void addAlongside()} loading={adding}>
              Add alongside what I have
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pending) && replacing}
        onOpenChange={(o) => {
          if (!o) setReplacing(false)
        }}
        title="Replace everything on this device?"
        confirmLabel="Replace with backup"
        destructive
        description={
          <div className="flex flex-col gap-3">
            <p>
              The {pluralise(currentProducts, 'product')} here now are replaced by what is in the
              file. Before anything changes, Ordo keeps a copy of what is here, and this page will
              offer to bring it back.
            </p>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void downloadBackup()
                    .then(() => toast.success('Current data downloaded'))
                    .catch((e) => toast.error('Backup failed', toStorageError(e).message))
                }
              >
                <Download aria-hidden /> Download current data as well
              </Button>
            </div>
          </div>
        }
        onConfirm={async () => {
          if (!pending) return
          try {
            const counts = await getStorage().restoreBackup(pending.backup)
            await onChanged()
            toast.success(
              'Backup restored',
              `${pluralise(counts.products, 'product')} now on this device.`,
            )
            setPending(undefined)
            setReplacing(false)
          } catch (e) {
            toast.error(
              'Restore failed',
              `${toStorageError(e).message} Your existing data was not changed.`,
            )
            throw e
          }
        }}
      />
    </section>
  )
}

function PreviousSection({
  previous,
  onChanged,
}: {
  previous: { savedAt: string; backup: BackupFile }
  onChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const counts = countBackup(previous.backup)
  return (
    <section aria-labelledby="previous-heading" className="flex flex-col gap-4">
      <SectionHeading id="previous-heading" title="Before your last restore">
        When you replace everything, Ordo keeps what was here. It is{' '}
        {pluralise(counts.products, 'product')} from {formatDate(previous.savedAt)}.
      </SectionHeading>
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Undo2 aria-hidden /> Bring it back
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Bring back the earlier data?"
        confirmLabel="Bring it back"
        description="What is on this device now is replaced by the earlier copy, and kept in turn, so you can switch back again."
        onConfirm={async () => {
          try {
            await getStorage().restoreBackup(previous.backup)
            await onChanged()
            toast.success(
              'Earlier data restored',
              `${pluralise(counts.products, 'product')} are back.`,
            )
          } catch (e) {
            toast.error('Could not restore', `${toStorageError(e).message} Nothing was changed.`)
            throw e
          }
        }}
      />
    </section>
  )
}

function EraseSection() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  return (
    <section aria-labelledby="erase-heading" className="flex flex-col gap-4 border-t pt-8">
      <SectionHeading id="erase-heading" title="Delete all local data">
        Removes every product, template, setting and saved history from this browser. Ordo has no
        server, so nothing can be recovered afterwards. Download a backup first.
      </SectionHeading>
      <div>
        <Button
          variant="destructive"
          onClick={() => {
            setTyped('')
            setOpen(true)
          }}
        >
          <Trash2 aria-hidden /> Delete everything
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete everything on this device?"
        confirmLabel="Delete everything"
        destructive
        confirmDisabled={typed.trim() !== 'DELETE'}
        description={
          <div className="flex flex-col gap-3">
            <p>
              All products, objectives, initiatives, features, roadmaps, templates, appearance
              choices and history are removed. This cannot be undone.
            </p>
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void downloadBackup()
                    .then(() => toast.success('Backup downloaded'))
                    .catch((e) => toast.error('Backup failed', toStorageError(e).message))
                }
              >
                <Download aria-hidden /> Download a backup first
              </Button>
            </div>
            <label className="flex flex-col gap-1.5 text-label font-semibold text-foreground">
              Type DELETE to confirm
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
          </div>
        }
        onConfirm={async () => {
          try {
            await getStorage().eraseEverything()
          } catch (e) {
            toast.error('Could not delete', `${toStorageError(e).message} Nothing was removed.`)
            throw e
          }
          // Start clean: a full load so no screen keeps a copy of what was removed.
          window.location.assign('/app')
        }}
      />
    </section>
  )
}

function ArchivedSection({ onChanged }: { onChanged: () => Promise<void> }) {
  const { archived, restoreProduct, deleteProductForever } = useWorkspaceStore()
  const [deleting, setDeleting] = useState<string>()
  const target = archived.find((p) => p.id === deleting)

  if (archived.length === 0) return null
  return (
    <section aria-labelledby="archived-heading" className="flex flex-col gap-4">
      <SectionHeading id="archived-heading" title="Archived products">
        Archived products are hidden, not deleted.
      </SectionHeading>
      <ul className="divide-y border-y">
        {archived.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-body font-semibold text-foreground">{p.name}</p>
              <p className="text-caption text-muted-foreground">
                Archived {p.deletedAt ? formatDate(p.deletedAt) : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void restoreProduct(p.id)
                    .then(onChanged)
                    .then(() => toast.success('Product restored', p.name))
                    .catch((e) => toast.error('Could not restore', toStorageError(e).message))
                }
              >
                <RotateCcw aria-hidden /> Restore
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleting(p.id)}>
                <Trash2 aria-hidden /> Delete forever
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(o) => !o && setDeleting(undefined)}
        title={`Delete ${target?.name ?? 'product'} forever?`}
        description="The product and everything inside it, including its history, is removed from this device. This cannot be undone."
        confirmLabel="Delete forever"
        destructive
        onConfirm={async () => {
          if (!target) return
          try {
            await deleteProductForever(target.id)
            await onChanged()
            toast.success('Product deleted', target.name)
          } catch (e) {
            toast.error('Could not delete', toStorageError(e).message)
            throw e
          }
        }}
      />
    </section>
  )
}
