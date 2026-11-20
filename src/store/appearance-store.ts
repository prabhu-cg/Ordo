import { create } from 'zustand'
import { parseAppearance, DEFAULT_APPEARANCE, type Appearance } from '@/lib/appearance'
import { getStorage, META_KEYS } from '@/storage'

interface AppearanceState extends Appearance {
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<Appearance>) => Promise<void>
  reset: () => Promise<void>
}

const pick = (s: Appearance): Appearance => ({
  density: s.density,
  statusTones: s.statusTones,
  cardFields: s.cardFields,
})

/** Mark the page so the stylesheet can respond to density. */
function apply(a: Appearance) {
  document.documentElement.dataset.density = a.density
  // A copy the page can read before anything else loads, so density is right on the first paint.
  try {
    localStorage.setItem('density', a.density)
  } catch {
    /* private mode: the saved setting still applies a moment later */
  }
}

/**
 * How things look: density, the colour of each status, and the details cards show. Saved on this device with
 * everything else, applied as soon as it is read, and never able to stop the app from starting.
 */
export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  ...DEFAULT_APPEARANCE,
  loaded: false,
  async load() {
    try {
      const saved = await getStorage().meta.get<unknown>(META_KEYS.appearance)
      const a = parseAppearance(saved)
      apply(a)
      set({ ...a, loaded: true })
    } catch {
      apply(DEFAULT_APPEARANCE)
      set({ loaded: true })
    }
  },
  async update(patch) {
    const next = parseAppearance({ ...pick(get()), ...patch })
    apply(next)
    set(next)
    await getStorage().meta.set(META_KEYS.appearance, next)
  },
  async reset() {
    apply(DEFAULT_APPEARANCE)
    set({ ...DEFAULT_APPEARANCE })
    await getStorage().meta.remove(META_KEYS.appearance)
  },
}))
