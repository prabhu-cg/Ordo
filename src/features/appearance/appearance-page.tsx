import { RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/shell/page-header'
import { StorageGate } from '@/components/shell/storage-gate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { WORK_STATUS_OPTIONS } from '@/features/planning/query'
import { usePageTitle } from '@/features/marketing/use-page-title'
import { CARD_FIELD_LABELS, type CardField } from '@/features/roadmap/card-fields'
import {
  DENSITIES,
  DENSITY_LABELS,
  TONE_BADGE,
  TONE_LABELS,
  TONE_ORDER,
  TONE_SWATCH,
  type Density,
} from '@/lib/appearance'
import { toStorageError } from '@/storage'
import { cn } from '@/lib/utils'
import { useAppearanceStore } from '@/store/appearance-store'
import type { Tone, WorkStatus } from '@/domain'

export function AppearancePage() {
  usePageTitle('Appearance')
  return (
    <StorageGate>
      <AppearanceContent />
    </StorageGate>
  )
}

const FIELD_ORDER = Object.keys(CARD_FIELD_LABELS) as CardField[]

function AppearanceContent() {
  const { density, statusTones, cardFields, update, reset } = useAppearanceStore()
  const save = (patch: Parameters<typeof update>[0]) =>
    void update(patch).catch((e) => toast.error('Could not save', toStorageError(e).message))

  return (
    <div className="flex max-w-3xl flex-col gap-12">
      <PageHeader
        title="Appearance"
        description="How cards, tables and statuses look on this device. Changes apply straight away and are kept with your data."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              void reset().then(() => toast.success('Appearance reset', 'Back to the defaults.'))
            }
          >
            <RotateCcw aria-hidden /> Reset to defaults
          </Button>
        }
      />

      <section aria-labelledby="density-h" className="flex flex-col gap-4">
        <div>
          <h2 id="density-h" className="text-xl">
            Density
          </h2>
          <p className="mt-1 text-body text-muted-foreground">
            Compact fits more cards and rows on a screen. Comfortable gives each more room.
          </p>
        </div>
        <div role="radiogroup" aria-label="Density" className="flex flex-wrap gap-2">
          {DENSITIES.map((d: Density) => (
            <label
              key={d}
              className={cn(
                'cursor-pointer rounded-full border px-4 py-2 text-body has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring/40',
                density === d
                  ? 'border-primary-text bg-primary-soft font-semibold text-primary-text'
                  : 'hover:bg-sand',
              )}
            >
              <input
                type="radio"
                name="density"
                className="sr-only"
                checked={density === d}
                onChange={() => save({ density: d })}
              />
              {DENSITY_LABELS[d]}
            </label>
          ))}
        </div>
      </section>

      <section aria-labelledby="status-h" className="flex flex-col gap-4">
        <div>
          <h2 id="status-h" className="text-xl">
            Status colours
          </h2>
          <p className="mt-1 text-body text-muted-foreground">
            Used for status badges and timeline bars, so a status looks the same everywhere. Every
            status keeps its name on screen, so colour is never the only signal.
          </p>
        </div>
        <ul className="divide-y border-y">
          {WORK_STATUS_OPTIONS.map(({ value, label }) => {
            const status = value as WorkStatus
            const tone = statusTones[status]
            return (
              <li key={status} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Badge variant={TONE_BADGE[tone]}>{label}</Badge>
                <div className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-3 rounded-full', TONE_SWATCH[tone])} />
                  <Select
                    aria-label={`Colour for ${label}`}
                    value={tone}
                    className="w-36"
                    onChange={(e) =>
                      save({ statusTones: { ...statusTones, [status]: e.target.value as Tone } })
                    }
                  >
                    {TONE_ORDER.map((t) => (
                      <option key={t} value={t}>
                        {TONE_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="cards-h" className="flex flex-col gap-4">
        <div>
          <h2 id="cards-h" className="text-xl">
            Card details
          </h2>
          <p className="mt-1 text-body text-muted-foreground">
            What each card shows on now, next and later and on boards. A board you have set up
            yourself under “Customise cards” keeps its own choice.
          </p>
        </div>
        <fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="sr-only">Show on each card</legend>
          {FIELD_ORDER.map((f) => (
            <label
              key={f}
              className="flex cursor-pointer items-center gap-3 rounded-input border p-3 text-body hover:bg-sand has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring/40"
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary-text)]"
                checked={cardFields.includes(f)}
                onChange={(e) =>
                  save({
                    cardFields: FIELD_ORDER.filter((x) =>
                      x === f ? e.target.checked : cardFields.includes(x),
                    ),
                  })
                }
              />
              {CARD_FIELD_LABELS[f]}
            </label>
          ))}
        </fieldset>
      </section>

      <p className="text-body text-muted-foreground">
        A roadmap's own colour is chosen in its settings. Light and dark mode is the moon or sun
        button at the top of every page.
      </p>
    </div>
  )
}
