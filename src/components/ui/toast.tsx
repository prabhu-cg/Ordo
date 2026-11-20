import { useEffect, useState } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'info' | 'destructive'
export interface ToastAction {
  label: string
  onClick: () => void
}
interface ToastItem {
  id: number
  title: string
  description?: string
  tone: Tone
  action?: ToastAction
}
interface ToastStore {
  items: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => void
  dismiss: (id: number) => void
}

let nextId = 1
const useToastStore = create<ToastStore>((set) => ({
  items: [],
  // Only the newest change can be undone from a toast, so a new undoable toast replaces the older ones
  // instead of stacking up over the page.
  push: (t) =>
    set((s) => ({
      items: [...s.items.filter((i) => !(t.action && i.action)), { ...t, id: nextId++ }].slice(-4),
    })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}))

/** Confirmation messages that don't need a decision. Call from anywhere. */
export const toast = {
  success: (title: string, description?: string, action?: ToastAction) =>
    useToastStore.getState().push({ title, description, tone: 'success', action }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'info' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'destructive' }),
}

const icons = { success: CheckCircle2, info: Info, destructive: XCircle }
const iconTone = { success: 'text-success', info: 'text-info', destructive: 'text-destructive' }

/**
 * Our own toasts, not Radix's. A Radix toast joins the stack of things that react to Escape, and as the newest one
 * it would take the key before the drawer or dialog you are actually in, so the first Escape would do nothing
 * useful. These never touch Escape. They still pause while you hover or focus them, and are announced politely.
 */
export function Toaster() {
  const { items, dismiss } = useToastStore()
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 print:hidden"
    >
      {items.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastCard({ toast: t, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false)
  const Icon = icons[t.tone]
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(onDismiss, t.action ? 8000 : 5000)
    return () => clearTimeout(timer)
  }, [paused, t.action, onDismiss])

  return (
    <div
      role={t.tone === 'destructive' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-menu border border-border-strong bg-popover p-4 shadow-raised"
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconTone[t.tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-foreground">{t.title}</p>
        {t.description && (
          <p className="mt-0.5 text-caption text-muted-foreground">{t.description}</p>
        )}
      </div>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            t.action!.onClick()
            onDismiss()
          }}
          className="shrink-0 self-center rounded-full border border-border-strong px-3 py-1 text-label font-semibold text-foreground hover:bg-sand"
        >
          {t.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="rounded-full p-1 text-muted-foreground hover:bg-sand hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
