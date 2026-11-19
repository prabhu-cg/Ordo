import { Download, RotateCcw, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/components/ui/toast'
import { PageHeader } from '@/components/shell/page-header'
import { StorageGate } from '@/components/shell/storage-gate'
import { formatBytes, formatDate, pluralise } from '@/lib/format'
import { useStorageQuery } from '@/lib/use-storage-query'
import type { StorageError } from '@/storage'
import {
  backupFileName,
  countBackup,
  getStorage,
  parseBackup,
  requestPersistence,
  serializeBackup,
  toStorageError,
  type BackupFile,
  type StorageInfo,
} from '@/storage'
import { usePlanningStore } from '@/store/planning-store'
import { useWorkspaceStore } from '@/store/workspace-store'

export function DataPage() {
  return (
    <StorageGate>
      <DataContent />
    </StorageGate>
  )
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function downloadBackup() {
  const backup = await getStorage().exportBackup()
  download(backupFileName(), serializeBackup(backup))
  return countBackup(backup)
}

function DataContent() {
  const refresh = useWorkspaceStore((s) => s.refresh)
  const {
    data: info,
    error: infoError,
    reload: loadInfo,
  } = useStorageQuery('storage-info', () => getStorage().info())

  return (
    <div className="flex max-w-3xl flex-col gap-12">
      <PageHeader
        title="Data and backup"
        description="Everything you make is stored in this browser. Back it up to move it, keep it safe, or hand it on."
      />
      <StorageSection info={info} error={infoError} onChanged={loadInfo} />
      <BackupSection />
      <RestoreSection
        currentProducts={info?.counts.products ?? 0}
        onRestored={async () => {
          await refresh()
          await usePlanningStore.getState().reload()
          await loadInfo()
        }}
      />
      <ArchivedSection onChanged={loadInfo} />
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
      <SectionHeading id="backup-heading" title="Back up">
        Download everything as one JSON file. Keep it anywhere you like; it is plain text you can
        read.
      </SectionHeading>
      <div>
        <Button variant="primary" onClick={run} loading={busy}>
          <Download aria-hidden /> Download backup
        </Button>
      </div>
    </section>
  )
}

function RestoreSection({
  currentProducts,
  onRestored,
}: {
  currentProducts: number
  onRestored: () => Promise<void>
}) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ name: string; backup: BackupFile }>()
  const [error, setError] = useState<string>()

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow choosing the same file again
    if (!file) return
    setError(undefined)
    if (file.size > 50 * 1024 * 1024) {
      setError('That file is larger than 50 MB, which is far beyond an Ordo backup.')
      return
    }
    try {
      setPending({ name: file.name, backup: parseBackup(await file.text()) })
    } catch (err) {
      setPending(undefined)
      setError(toStorageError(err).message)
    }
  }

  const incoming = pending ? countBackup(pending.backup) : undefined

  return (
    <section aria-labelledby="restore-heading" className="flex flex-col gap-4">
      <SectionHeading id="restore-heading" title="Restore">
        Restoring replaces everything in this browser with the contents of a backup file.
      </SectionHeading>
      {error && (
        <Alert tone="destructive" title="That file cannot be restored">
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

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(o) => !o && setPending(undefined)}
        title="Replace everything on this device?"
        confirmLabel="Replace with backup"
        destructive
        description={
          pending && incoming ? (
            <div className="flex flex-col gap-3">
              <p>
                <span className="font-semibold text-foreground">{pending.name}</span> was exported
                on {formatDate(pending.backup.exportedAt)} and holds{' '}
                {pluralise(incoming.products, 'product')},{' '}
                {pluralise(incoming.initiatives, 'initiative')} and{' '}
                {pluralise(incoming.features, 'feature')}.
              </p>
              <p>
                This device currently holds {pluralise(currentProducts, 'product')}. They will be
                replaced and cannot be recovered unless you back them up first.
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
                  <Download aria-hidden /> Download current data first
                </Button>
              </div>
            </div>
          ) : null
        }
        onConfirm={async () => {
          if (!pending) return
          try {
            const counts = await getStorage().restoreBackup(pending.backup)
            await onRestored()
            toast.success(
              'Backup restored',
              `${pluralise(counts.products, 'product')} now on this device.`,
            )
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
