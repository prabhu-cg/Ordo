import { Check, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Tag } from '@/domain'
import { cn } from '@/lib/utils'

interface Props {
  /** Every tag in the product. */
  tags: Tag[]
  selected: string[]
  /** Names typed in this session that do not exist yet; they are created when the item is saved. */
  pending: string[]
  onChange: (next: { selected: string[]; pending: string[] }) => void
  id?: string
}

/** Pick existing tags or add new ones. Nothing is written until the item itself is saved. */
export function TagPicker({ tags, selected, pending, onChange, id }: Props) {
  const [draft, setDraft] = useState('')
  const toggle = (tagId: string) =>
    onChange({
      pending,
      selected: selected.includes(tagId)
        ? selected.filter((t) => t !== tagId)
        : [...selected, tagId],
    })

  function add() {
    const name = draft.trim()
    if (!name) return
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (existing) {
      if (!selected.includes(existing.id))
        onChange({ pending, selected: [...selected, existing.id] })
    } else if (!pending.some((p) => p.toLowerCase() === name.toLowerCase())) {
      onChange({ selected, pending: [...pending, name] })
    }
    setDraft('')
  }

  const chip =
    'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-label font-semibold transition-colors'
  return (
    <div className="flex flex-col gap-3">
      {(tags.length > 0 || pending.length > 0) && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {tags.map((t) => {
            const on = selected.includes(t.id)
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.id)}
                  className={cn(
                    chip,
                    on
                      ? 'border-primary-text bg-primary-soft text-primary-text'
                      : 'border-border-strong bg-background text-ink hover:bg-sand',
                  )}
                >
                  {on && <Check className="size-3" aria-hidden />}
                  {t.name}
                </button>
              </li>
            )
          })}
          {pending.map((name) => (
            <li key={name}>
              <span className={cn(chip, 'border-primary-text bg-primary-soft text-primary-text')}>
                {name}
                <button
                  type="button"
                  aria-label={`Remove new tag ${name}`}
                  onClick={() => onChange({ selected, pending: pending.filter((p) => p !== name) })}
                  className="-mr-1 rounded-full hover:bg-background"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          placeholder="Add a tag"
          maxLength={40}
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault() // adding a tag must not submit the form
              add()
            }
          }}
        />
        <Button variant="outline" onClick={add} disabled={!draft.trim()}>
          <Plus aria-hidden /> Add
        </Button>
      </div>
    </div>
  )
}
