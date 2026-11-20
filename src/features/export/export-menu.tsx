import { Download, FileJson, FileSpreadsheet, FileText, Image } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toast'
import type { Roadmap } from '@/domain'
import { formatDate } from '@/lib/format'
import { backupFileName, getStorage, serializeBackup, toStorageError } from '@/storage'
import { usePlanningStore } from '@/store/planning-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { planToCsv } from './csv'
import { downloadBlob, downloadText, exportFileName } from './download'

const VIEW_NAMES: Record<string, string> = {
  'now-next-later': 'Now, next, later',
  timeline: 'Timeline',
  board: 'Board',
}

/**
 * Everything you can take out of a roadmap: a picture of the view you are looking at, a printable document, the
 * items as a spreadsheet, or the whole product as a backup file. All of it is made in this browser.
 */
export function RoadmapExportMenu({ roadmap, view }: { roadmap: Roadmap; view: string }) {
  const [busy, setBusy] = useState(false)
  const [params] = useSearchParams()
  const product = useWorkspaceStore((s) => s.products.find((p) => p.id === s.activeProductId))
  const productName = product?.name ?? 'Product'

  async function run(label: string, work: () => Promise<void>) {
    setBusy(true)
    try {
      await work()
      toast.success(`${label} ready`, 'It has been saved to your downloads.')
    } catch (e) {
      toast.error(`Could not make the ${label.toLowerCase()}`, toStorageError(e).message)
    } finally {
      setBusy(false)
    }
  }

  const png = () =>
    run('Image', async () => {
      const node = document.getElementById('roadmap-panel')
      if (!node) throw new Error('There is no view on screen to capture.')
      const { viewToPng } = await import('./png')
      const blob = await viewToPng({
        node,
        title: `${productName}: ${roadmap.name}`,
        subtitle: `${VIEW_NAMES[view] ?? view} · Exported ${formatDate(new Date().toISOString())}`,
      })
      downloadBlob(exportFileName([productName, roadmap.name, view], 'png'), blob)
    })

  const csv = () =>
    run('Spreadsheet', async () => {
      const s = usePlanningStore.getState()
      const text = planToCsv({
        objectives: s.objectives,
        initiatives: s.initiatives,
        features: s.features,
        tags: s.tags,
        dependencies: s.dependencies,
        roadmap,
      })
      downloadText(
        exportFileName([productName, roadmap.name], 'csv'),
        text,
        'text/csv;charset=utf-8',
      )
    })

  const json = () =>
    run('Backup', async () => {
      if (!product) throw new Error('No product is open.')
      const backup = await getStorage().exportProductBackup(product.id)
      downloadText(
        exportFileName([productName, 'backup'], 'json') || backupFileName(),
        serializeBackup(backup),
        'application/json',
      )
    })

  const printQuery = new URLSearchParams(params)
  printQuery.set('view', view)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" loading={busy}>
          <Download aria-hidden /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Export this roadmap</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void png()}>
          <Image aria-hidden />
          <span className="flex flex-col">
            Image (PNG)
            <span className="text-caption font-normal text-muted-foreground">
              The view on screen, sharp and uncut
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/app/roadmaps/${roadmap.id}/print?${printQuery.toString()}`}>
            <FileText aria-hidden />
            <span className="flex flex-col">
              PDF or print…
              <span className="text-caption font-normal text-muted-foreground">
                Preview pages, then print or save as PDF
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void csv()}>
          <FileSpreadsheet aria-hidden />
          <span className="flex flex-col">
            Spreadsheet (CSV)
            <span className="text-caption font-normal text-muted-foreground">
              Items with ids, parents, status, priority, dates
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void json()}>
          <FileJson aria-hidden />
          <span className="flex flex-col">
            Product backup (JSON)
            <span className="text-caption font-normal text-muted-foreground">
              Everything in this product, to restore later
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
