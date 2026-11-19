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
    remove: (key: string) =>
      guard(async () => {
        await db.meta.delete(key)
      }),
  }
}

export const META_KEYS = { activeProductId: 'activeProductId', onboarding: 'onboarding' } as const
