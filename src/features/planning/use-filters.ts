import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EMPTY_FILTERS, type Filters } from './query'

const KEYS = ['q', 'status', 'priority', 'objective', 'initiative', 'tag', 'sort'] as const

/**
 * Filters live in the address, so a filtered list can be bookmarked, shared and reached from a link
 * (for example "the features of this initiative"), and the back button behaves.
 */
export function useFilters() {
  const [params, setParams] = useSearchParams()

  // React Router does not queue functional updates the way setState does: two changes in quick succession
  // would both start from the same stale params and the second would undo the first. Build every change on
  // the latest value instead, and keep it in step with the address when that changes some other way.
  const latest = useRef(params)
  useEffect(() => {
    latest.current = params
  }, [params])

  const apply = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(latest.current)
      mutate(next)
      latest.current = next
      setParams(next, { replace: true })
    },
    [setParams],
  )

  const filters = useMemo<Filters>(() => {
    const out = { ...EMPTY_FILTERS }
    for (const k of KEYS) {
      const v = params.get(k)
      if (v) out[k] = v
    }
    return out
  }, [params])

  const set = useCallback(
    (key: keyof Filters, value: string) =>
      apply((next) => {
        if (!value || (key === 'sort' && value === 'manual')) next.delete(key)
        else next.set(key, value)
      }),
    [apply],
  )

  const clear = useCallback(
    () =>
      apply((next) => {
        for (const k of KEYS) if (k !== 'sort') next.delete(k)
      }),
    [apply],
  )

  return { filters, set, clear }
}
