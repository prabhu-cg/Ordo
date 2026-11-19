import { OrdoDB } from './db'
import { createStorage, type Storage } from './index'

let n = 0
/** A fresh, isolated database per test. */
export async function freshStorage(): Promise<Storage> {
  const storage = createStorage(new OrdoDB(`ordo-test-${Date.now()}-${n++}`))
  await storage.open()
  return storage
}

export const productInput = (name = 'Atlas') => ({ name })
export const objectiveInput = (productId: string, title = 'Reach 100 users') => ({
  productId,
  title,
  status: 'active' as const,
  order: 1,
})
export const initiativeInput = (productId: string, over: Record<string, unknown> = {}) => ({
  productId,
  title: 'Onboarding',
  status: 'idea' as const,
  tagIds: [],
  order: 1,
  ...over,
})
export const featureInput = (productId: string, over: Record<string, unknown> = {}) => ({
  productId,
  title: 'Import CSV',
  status: 'idea' as const,
  tagIds: [],
  order: 1,
  ...over,
})
