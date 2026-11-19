import { create } from 'zustand'
import type { TemplateRecord } from '@/domain'
import { getStorage } from '@/storage'

interface TemplateState {
  /** The person's own templates, newest first. Built-in templates are code, not data, so they are not here. */
  custom: TemplateRecord[]
  loaded: boolean
  load: () => Promise<void>
}

export const useTemplateStore = create<TemplateState>((set) => ({
  custom: [],
  loaded: false,
  async load() {
    try {
      set({ custom: await getStorage().templateService.list(), loaded: true })
    } catch {
      // Templates are a convenience: if they cannot be read, the built-in ones still work.
      set({ loaded: true })
    }
  },
}))
