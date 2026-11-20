import { Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useMatches, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { Toaster } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ItemDrawers } from '@/features/planning/item-drawers'
import { usePlanningStore } from '@/store/planning-store'
import { useTemplateStore } from '@/store/template-store'
import { useWorkspaceStore } from '@/store/workspace-store'
import { ProductFormDrawer } from './product-form-drawer'
import { QuickActionsMenu } from './quick-actions-menu'
import { SidebarContent } from './sidebar'
import { ThemeToggle } from './theme-toggle'
import { Wordmark } from './wordmark'

export interface RouteHandle {
  title: string
}

/** Sidebar + header + main. Everything a page needs to ask the shell for lives in the outlet context. */
export interface ShellContext {
  /** Open the edit drawer for a product; defaults to the active one. */
  openEditProduct: (productId?: string) => void
}

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const navigate = useNavigate()
  const { products, activeProductId, status } = useWorkspaceStore()
  const loadPlanning = usePlanningStore((st) => st.load)
  const loadTemplates = useTemplateStore((st) => st.load)
  useEffect(() => {
    if (status === 'ready') void loadTemplates()
  }, [status, loadTemplates])

  // Keep the planning data in step with whichever product is open.
  useEffect(() => {
    if (status === 'ready') void loadPlanning(activeProductId)
  }, [status, activeProductId, loadPlanning])
  const active = products.find((p) => p.id === activeProductId)
  const matches = useMatches()
  const title = [...matches].reverse().find((m) => (m.handle as RouteHandle | undefined)?.title)
    ?.handle as RouteHandle | undefined

  const createProduct = () => {
    setNavOpen(false)
    navigate('/app/new')
  }
  const editing = products.find((p) => p.id === editingId)

  return (
    <TooltipProvider>
      <a href="#main" className="skip-link" data-print-hide>
        Skip to content
      </a>
      <div className="min-h-dvh bg-background">
        <aside
          data-print-hide
          className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] border-r bg-surface lg:block"
        >
          <SidebarContent onCreateProduct={createProduct} />
        </aside>

        <Drawer open={navOpen} onOpenChange={setNavOpen}>
          <DrawerContent side="left" size="nav" className="bg-surface">
            <DrawerTitle className="sr-only">Navigation</DrawerTitle>
            <DrawerDescription className="sr-only">
              Switch product or go to another page
            </DrawerDescription>
            <SidebarContent onCreateProduct={createProduct} onNavigate={() => setNavOpen(false)} />
          </DrawerContent>
        </Drawer>

        <div className="print-reset lg:pl-[var(--sidebar-width)]">
          <header
            data-print-hide
            className="sticky top-0 z-20 flex h-[var(--header-height)] items-center gap-3 border-b bg-background px-4 sm:px-6 lg:px-8"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu aria-hidden />
            </Button>
            <Wordmark className="lg:hidden" />
            <p className="hidden min-w-0 truncate text-body text-muted-foreground lg:block">
              {active ? (
                <>
                  <span className="font-semibold text-foreground">{active.name}</span>
                  {title && <span aria-hidden> / </span>}
                </>
              ) : null}
              {title && <span>{title.title}</span>}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <QuickActionsMenu />
              <ThemeToggle />
            </div>
          </header>

          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1440px] px-4 py-8 outline-none sm:px-6 lg:px-8"
          >
            <Outlet
              context={
                {
                  openEditProduct: (id) => setEditingId(id ?? activeProductId ?? null),
                } satisfies ShellContext
              }
            />
          </main>
        </div>
      </div>

      <ProductFormDrawer
        open={Boolean(editing)}
        onOpenChange={(o) => !o && setEditingId(null)}
        product={editing}
      />
      <ItemDrawers />
      <Toaster />
    </TooltipProvider>
  )
}
