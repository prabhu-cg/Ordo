import { useCallback, useEffect, useRef, useState } from 'react'
import { toStorageError, type StorageError } from '@/storage'

interface Result<T> {
  data: T | undefined
  error: StorageError | undefined
  /** Read again, e.g. after a write that changes what this query returns. */
  reload: () => Promise<void>
}

/**
 * Read from storage for a screen. `key` identifies what is being read; changing it discards the old
 * value so a previous product's numbers are never shown against a new one.
 */
export function useStorageQuery<T>(key: string, read: () => Promise<T>): Result<T> {
  const [state, setState] = useState<{ key: string; data?: T; error?: StorageError }>()
  const [token, setToken] = useState(0)
  const readRef = useRef(read)
  useEffect(() => {
    readRef.current = read
  })
  const waiting = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    readRef
      .current()
      .then((data) => !cancelled && setState({ key, data }))
      .catch((e) => !cancelled && setState({ key, error: toStorageError(e) }))
      .finally(() => {
        waiting.current?.()
        waiting.current = undefined
      })
    return () => {
      cancelled = true
    }
  }, [key, token])

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiting.current = resolve
        setToken((t) => t + 1)
      }),
    [],
  )

  const current = state?.key === key ? state : undefined
  return { data: current?.data, error: current?.error, reload }
}
