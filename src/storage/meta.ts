import type { OrdoDB } from './db'
import { guard } from './errors'

/** Small key/value settings that belong to the browser's database (not to a product). */
export function createMeta(db: OrdoDB) {
  return {
    get: <T>(key: string) => guard(async () => (await db.meta.get(key))?.value as T | undefined),
    set: (key: string, value: unknown) =>
      guard(async () => {
        await db.meta.put({ key, value })
      }),
    /** Remove every key that starts with a prefix (used to drop saved undo history). */
    removePrefix: (prefix: string) =>
      guard(async () => {
        await db.meta.where('key').startsWith(prefix).delete()
      }),
    remove: (key: string) =>
      guard(async () => {
        await db.meta.delete(key)
      }),
  }
}

export const META_KEYS = {
  activeProductId: 'activeProductId',
  onboarding: 'onboarding',
  /** The data as it was just before the last restore. */
  safetyCopy: 'safetyCopy',
  appearance: 'appearance',
} as const
/** Saved undo history is kept per product, under this prefix. */
export const UNDO_KEY_PREFIX = 'undo:'
