import * as ToastPrimitive from '@radix-ui/react-toast'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'info' | 'destructive'
interface ToastItem {
  id: number
  title: string
  description?: string
  tone: Tone
}
interface ToastStore {
  items: ToastItem[]
  push: (t: Omit<ToastItem, 'id'>) => void
  dismiss: (id: number) => void
}

let nextId = 1
const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items, { ...t, id: nextId++ }].slice(-4) })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}))

/** Confirmation messages that don't need a decision. Call from anywhere. */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'success' }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'info' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'destructive' }),
}

const icons = { success: CheckCircle2, info: Info, destructive: XCircle }
const iconTone = { success: 'text-success', info: 'text-info', destructive: 'text-destructive' }

export function Toaster() {
  const { items, dismiss } = useToastStore()
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000} label="Notifications">
      {items.map((t) => {
        const Icon = icons[t.tone]
        return (
          <ToastPrimitive.Root
            key={t.id}
            type={t.tone === 'destructive' ? 'foreground' : 'background'}
            onOpenChange={(open) => !open && dismiss(t.id)}
            className="flex items-start gap-3 rounded-menu border border-border-strong bg-popover p-4 shadow-raised data-[state=closed]:animate-toast-out data-[state=open]:animate-toast-in"
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', iconTone[t.tone])} aria-hidden />
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-body font-semibold text-foreground">
                {t.title}
              </ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="mt-0.5 text-caption text-muted-foreground">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss"
              className="rounded-full p-1 text-muted-foreground hover:bg-sand hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )
      })}
      <ToastPrimitive.Viewport className="fixed right-4 bottom-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  )
}
