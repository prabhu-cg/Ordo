import { Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { PRIORITIES, type Initiative, type Objective, type Tag } from '@/domain'
import { PRIORITY_LABELS } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { NONE, activeFilterCount, type Filters } from './query'

export type SelectOption = { value: string; label: string }

interface Props {
  filters: Filters
  onChange: (key: keyof Filters, value: string) => void
  onClear: () => void
  noun: string
  shown: number
  total: number
  searchLabel: string
  statuses: SelectOption[]
  sorts: readonly SelectOption[]
  showPriority?: boolean
  objectives?: Objective[]
  initiatives?: Initiative[]
  tags?: Tag[]
}

/**
 * One row: search, the filters that apply to this list, sort pushed right. Below `sm` the selects fold
 * behind a Filters button that shows how many are active.
 */
export function FilterBar({
  filters,
  onChange,
  onClear,
  noun,
  shown,
  total,
  searchLabel,
  statuses,
  sorts,
  showPriority,
  objectives,
  initiatives,
  tags,
}: Props) {
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(filters)
  const selectClass = 'w-full sm:w-auto sm:min-w-40'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label={searchLabel}
            placeholder={searchLabel}
            value={filters.q}
            onChange={(e) => onChange('q', e.target.value)}
            className="pl-9"
          />
        </div>

        <Button
          variant="outline"
          className="sm:hidden"
          aria-expanded={open}
          aria-controls="filter-selects"
          onClick={() => setOpen((o) => !o)}
        >
          <SlidersHorizontal aria-hidden /> Filters
          {count > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-label text-primary-foreground tabular-nums">
              {count}
            </span>
          )}
        </Button>

        <div
          id="filter-selects"
          className={cn('w-full flex-wrap gap-2 sm:flex sm:w-auto', open ? 'flex' : 'hidden')}
        >
          <Select
            aria-label="Filter by status"
            className={selectClass}
            value={filters.status}
            onChange={(e) => onChange('status', e.target.value)}
          >
            <option value="">Any status</option>
            {statuses.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {showPriority && (
            <Select
              aria-label="Filter by priority"
              className={selectClass}
              value={filters.priority}
              onChange={(e) => onChange('priority', e.target.value)}
            >
              <option value="">Any priority</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
              <option value={NONE}>No priority set</option>
            </Select>
          )}
          {objectives && (
            <Select
              aria-label="Filter by objective"
              className={selectClass}
              value={filters.objective}
              onChange={(e) => onChange('objective', e.target.value)}
            >
              <option value="">Any objective</option>
              {objectives.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
              <option value={NONE}>No objective</option>
            </Select>
          )}
          {initiatives && (
            <Select
              aria-label="Filter by initiative"
              className={selectClass}
              value={filters.initiative}
              onChange={(e) => onChange('initiative', e.target.value)}
            >
              <option value="">Any initiative</option>
              {initiatives.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
              <option value={NONE}>No initiative</option>
            </Select>
          )}
          {tags && tags.length > 0 && (
            <Select
              aria-label="Filter by tag"
              className={selectClass}
              value={filters.tag}
              onChange={(e) => onChange('tag', e.target.value)}
            >
              <option value="">Any tag</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        {count > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        )}

        <Select
          aria-label="Sort"
          className="w-full sm:ml-auto sm:w-auto sm:min-w-48"
          value={filters.sort}
          onChange={(e) => onChange('sort', e.target.value)}
        >
          {sorts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="text-caption text-muted-foreground tabular-nums"
      >
        {count > 0 ? `${shown} of ${total} ${noun}` : `${total} ${noun}`}
      </p>
    </div>
  )
}
