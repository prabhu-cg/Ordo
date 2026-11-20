import { create } from 'zustand'
import type { Product, ProductBundle } from '@/domain'
import type { StorageError } from '@/storage'
import { META_KEYS, getStorage, toStorageError, type NewRecord, type RecordPatch } from '@/storage'

export type ProductInput = NewRecord<Product>
export type ProductPatch = RecordPatch<Product>
type Status = 'idle' | 'loading' | 'ready' | 'error'
export type OnboardingState = { status: 'skipped' | 'completed'; at: string }

interface WorkspaceState {
  status: Status
  error?: StorageError
  /** Live products, oldest first. */
  products: Product[]
  /** Archived products, newest first. */
  archived: Product[]
  activeProductId?: string
  /** Whether the guide was skipped or finished. Absent means the visitor has not decided yet. */
  onboarding?: OnboardingState

  init: () => Promise<void>
  refresh: () => Promise<void>
  selectProduct: (id: string) => Promise<void>
  setOnboarding: (status: OnboardingState['status']) => Promise<void>
  /** Create a product from a template bundle and make it the active one. */
  createProductFromBundle: (bundle: ProductBundle) => Promise<Product>
  createProduct: (input: ProductInput) => Promise<Product>
  updateProduct: (id: string, patch: ProductPatch) => Promise<Product>
  archiveProduct: (id: string) => Promise<void>
  restoreProduct: (id: string) => Promise<void>
  deleteProductForever: (id: string) => Promise<void>
}

/** Pick the stored choice if it still exists, otherwise the first product, otherwise nothing. */
export function resolveActive(products: Product[], stored?: string): string | undefined {
  return products.find((p) => p.id === stored)?.id ?? products[0]?.id
}

async function load(stored?: string) {
  const storage = getStorage()
  const all = await storage.products.list({ includeDeleted: true })
  const products = all
    .filter((p) => !p.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const archived = all
    .filter((p) => p.deletedAt)
    .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
  const activeProductId = resolveActive(products, stored)
  return { products, archived, activeProductId }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  /** Reload from storage, keeping the current selection when it is still valid. */
  async function sync(preferred?: string) {
    const storage = getStorage()
    const stored =
      preferred ??
      get().activeProductId ??
      (await storage.meta.get<string>(META_KEYS.activeProductId))
    const next = await load(stored)
    if (next.activeProductId)
      await storage.meta.set(META_KEYS.activeProductId, next.activeProductId)
    else await storage.meta.remove(META_KEYS.activeProductId)
    const onboarding = await storage.meta.get<OnboardingState>(META_KEYS.onboarding)
    set({ ...next, onboarding, status: 'ready', error: undefined })
  }

  return {
    status: 'idle',
    products: [],
    archived: [],

    async init() {
      if (get().status === 'loading') return
      set({ status: 'loading', error: undefined })
      try {
        await getStorage().open()
        await sync()
      } catch (e) {
        set({ status: 'error', error: toStorageError(e) })
      }
    },

    async refresh() {
      try {
        await sync()
      } catch (e) {
        set({ status: 'error', error: toStorageError(e) })
      }
    },

    async selectProduct(id) {
      await getStorage().meta.set(META_KEYS.activeProductId, id)
      set({ activeProductId: id })
    },

    async setOnboarding(status) {
      const value: OnboardingState = { status, at: new Date().toISOString() }
      await getStorage().meta.set(META_KEYS.onboarding, value)
      set({ onboarding: value })
    },

    async createProductFromBundle(bundle) {
      const product = await getStorage().createProductFromBundle(bundle)
      await sync(product.id)
      return product
    },

    async createProduct(input) {
      const product = await getStorage().products.create(input)
      await sync(product.id) // a new product becomes the one you are working in
      return product
    },

    async updateProduct(id, patch) {
      const product = await getStorage().products.update(id, patch)
      await sync()
      return product
    },

    async archiveProduct(id) {
      await getStorage().products.remove(id)
      await sync()
    },

    async restoreProduct(id) {
      await getStorage().products.restore(id)
      await sync(id)
    },

    async deleteProductForever(id) {
      await getStorage().purgeProductAndHistory(id)
      await sync()
    },
  }
})
