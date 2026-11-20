import { StatusBadge } from '@/components/domain/indicators'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DrawerBody,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Field } from '@/components/ui/field'
import { Input, Select } from '@/components/ui/input'
import { LANES, type Lane, type WorkStatus } from '@/domain'
import { pluralise } from '@/lib/format'
import { LANE_LABELS } from '@/lib/labels'
import { useItemDrawer } from '@/store/drawer-store'
import { usePlanningStore } from '@/store/planning-store'
import { addItems } from './actions'
import { showsType } from './engine'

/** Choose initiatives and features to put on a roadmap. Items already on it are not offered twice. */
export function AddItemsDrawer({
  roadmapId,
  lane: presetLane,
}: {
  roadmapId: string
  lane?: Lane
}) {
  const { roadmaps, initiatives, features } = usePlanningStore()
  const { closeAddItems } = useItemDrawer()
  const roadmap = roadmaps.find((r) => r.id === roadmapId)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [lane, setLane] = useState<Lane>(presetLane ?? 'next')
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)

  const on = useMemo(
    () => new Set((roadmap?.entries ?? []).map((e) => `${e.itemType}:${e.itemId}`)),
    [roadmap],
  )
  const needle = q.trim().toLowerCase()
  const fits = (title: string) => !needle || title.toLowerCase().includes(needle)
  const availableInitiatives =
    roadmap && showsType(roadmap, 'initiative')
      ? initiatives.filter((i) => !on.has(`initiative:${i.id}`) && fits(i.title))
      : []
  const availableFeatures =
    roadmap && showsType(roadmap, 'feature')
      ? features.filter((f) => !on.has(`feature:${f.id}`) && fits(f.title))
      : []
  const nothing = availableInitiatives.length === 0 && availableFeatures.length === 0
  if (!roadmap) return null

  const toggle = (key: string) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const items = [...picked].map((key) => {
      const [itemType, itemId] = key.split(':') as ['initiative' | 'feature', string]
      return { itemType, itemId, lane }
    })
    const ok = await addItems(roadmapId, items)
    setSaving(false)
    if (ok) closeAddItems()
  }

  const group = (
    title: string,
    rows: { id: string; title: string; status: WorkStatus }[],
    type: 'initiative' | 'feature',
  ) =>
    rows.length > 0 && (
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-title font-semibold text-foreground">{title}</legend>
        <ul className="divide-y border-y">
          {rows.map((r) => {
            const key = `${type}:${r.id}`
            return (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={picked.has(key)}
                    onChange={() => toggle(key)}
                    className="size-4 accent-[var(--primary-text)]"
                  />
                  <span className="min-w-0 flex-1 text-body text-foreground">{r.title}</span>
                  <StatusBadge status={r.status} />
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>
    )

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader>
        <DrawerTitle>Add items</DrawerTitle>
        <DrawerDescription>
          Choose what to put on “{roadmap.name}”. Each item can be on a roadmap once.
        </DrawerDescription>
      </DrawerHeader>
      <DrawerBody className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Search">
            {(c) => (
              <Input
                {...c}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find an initiative or feature"
              />
            )}
          </Field>
          <Field label="Put them in" hint="You can move them later.">
            {(c) => (
              <Select {...c} value={lane} onChange={(e) => setLane(e.target.value as Lane)}>
                {LANES.map((l) => (
                  <option key={l} value={l}>
                    {LANE_LABELS[l]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        {group('Initiatives', availableInitiatives, 'initiative')}
        {group('Features', availableFeatures, 'feature')}
        {nothing && (
          <p className="rounded-input border border-dashed p-6 text-center text-body text-muted-foreground">
            {needle
              ? 'Nothing matches that search.'
              : 'Everything you have planned is already on this roadmap. Add more initiatives or features in the planning pages, then come back.'}
          </p>
        )}
      </DrawerBody>
      <DrawerFooter>
        <Button variant="outline" onClick={closeAddItems} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={picked.size === 0} loading={saving}>
          {picked.size === 0 ? 'Add items' : `Add ${pluralise(picked.size, 'item')}`}
        </Button>
      </DrawerFooter>
    </form>
  )
}
