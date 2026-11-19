import { useCallback, useMemo, useState } from 'react'
import type { Feature, Initiative, ProductBundle } from '@/domain'
import { EMPTY_FILTERS } from '@/features/planning/query'
import type { RoadmapBindings } from '@/features/roadmap/bindings'
import { today } from '@/features/roadmap/dates'
import { buildRows, linkSummaries, planMove, rowKey, visibleRows } from '@/features/roadmap/engine'
import { stampBundle } from '@/templates/records'

type Kind = 'initiative' | 'feature'

/**
 * A throwaway copy of a template's plan that the real roadmap views can be pointed at. Dragging a card, changing a
 * status, resizing a bar and changing the board all work, but they only change this copy, in memory. Reset puts the
 * template back as it was. Nothing is ever written to storage.
 */
export function useSandbox(make: () => ProductBundle) {
  const [bundle, setBundle] = useState(make)
  const [openId, setOpenId] = useState<{ kind: Kind; id: string }>()
  const [version, setVersion] = useState(0)
  const [edits, setEdits] = useState(0)

  const records = useMemo(() => stampBundle(bundle), [bundle])
  const { roadmap, initiatives, features } = records

  const rows = useMemo(
    () => visibleRows(roadmap, buildRows(roadmap, initiatives, features)),
    [roadmap, initiatives, features],
  )
  const links = useMemo(
    () =>
      linkSummaries(bundle.dependencies as never, (type, id) => {
        const item =
          type === 'initiative'
            ? initiatives.find((i) => i.id === id)
            : features.find((f) => f.id === id)
        return item ? { title: item.title, status: item.status } : undefined
      }),
    [bundle.dependencies, initiatives, features],
  )

  const patchItem = useCallback((kind: Kind, id: string, patch: Record<string, unknown>) => {
    setBundle((b) => {
      const apply = <T extends { id: string }>(list: T[]) =>
        list.map((x) => {
          if (x.id !== id) return x
          const next: Record<string, unknown> = { ...x, ...patch }
          for (const [k, v] of Object.entries(patch)) if (v === undefined) delete next[k]
          return next as T
        })
      return kind === 'initiative'
        ? { ...b, initiatives: apply(b.initiatives) }
        : { ...b, features: apply(b.features) }
    })
  }, [])

  const bindings = useMemo<RoadmapBindings>(() => {
    const edited = () => setEdits((n) => n + 1)
    return {
      moveRow: async (o) => {
        edited()
        setBundle((b) => {
          const row = {
            ...o.row,
            entry:
              b.roadmap.entries.find((e) => rowKey(e.itemType, e.itemId) === o.row.key) ??
              o.row.entry,
          }
          const plan = planMove({
            entries: b.roadmap.entries,
            row,
            drop: o.drop,
            lane: o.lane,
            itemPatch: o.itemPatch,
            reorder: o.reorder,
            mode: o.mode,
            today: today(),
          })
          if (plan.unchanged) return b
          const patched = (list: (Initiative | Feature)[]) =>
            list.map((x) => (x.id === o.row.item.id ? { ...x, ...plan.itemPatch } : x))
          return {
            ...b,
            roadmap: { ...b.roadmap, entries: plan.entries },
            initiatives:
              o.row.kind === 'initiative'
                ? (patched(b.initiatives as never) as never)
                : b.initiatives,
            features:
              o.row.kind === 'feature' ? (patched(b.features as never) as never) : b.features,
          }
        })
      },
      updateItem: async (row, patch) => {
        edited()
        patchItem(row.kind, row.item.id, patch)
      },
      removeRow: async (_roadmapId, row) => {
        edited()
        setBundle((b) => ({
          ...b,
          roadmap: {
            ...b.roadmap,
            entries: b.roadmap.entries.filter((e) => rowKey(e.itemType, e.itemId) !== row.key),
          },
        }))
      },
      saveViewConfig: async (viewId, config) => {
        setBundle((b) => ({
          ...b,
          views: b.views.map((v) => (v.id === viewId ? { ...v, config } : v)),
        }))
      },
      openItem: (_roadmapId, kind, id) => setOpenId({ kind, id }),
    }
  }, [patchItem])

  const reset = useCallback(() => {
    setBundle(make())
    setOpenId(undefined)
    setEdits(0)
    setVersion((v) => v + 1) // remounts the views, so their zoom and scroll start fresh too
  }, [make])

  const data = {
    links,
    roadmap,
    rows,
    filtered: rows,
    filtering: false,
    filters: { ...EMPTY_FILTERS },
    setFilter: () => {},
    clearFilters: () => {},
    initiatives,
    features,
    objectives: records.objectives,
    milestones:
      roadmap.itemTypes && !roadmap.itemTypes.includes('milestone') ? [] : records.milestones,
    dependencies: records.dependencies as never,
    tags: records.tags,
    views: records.views,
  }

  return {
    data,
    records,
    bindings,
    reset,
    version,
    openId,
    closeItem: () => setOpenId(undefined),
    changed: edits > 0,
  }
}
