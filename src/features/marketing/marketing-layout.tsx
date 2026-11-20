import { Menu } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { Wordmark } from '@/components/shell/wordmark'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspace-store'

const NAV_LINKS = [
  { label: 'Product', hash: 'product' },
  { label: 'Features', hash: 'features' },
  { label: 'Templates', hash: 'templates' },
  { label: 'Pricing', hash: 'pricing' },
] as const

/**
 * Moves to a section when the address has a #hash, and to the top on any other navigation. Choosing a header link
 * while already on the page glides there; arriving from another page, or from a shared link, jumps straight to
 * it. People who ask their system for reduced motion always get the jump.
 */
function ScrollToHash() {
  const { pathname, hash, key } = useLocation()
  const lastPath = useRef<string | undefined>(undefined)
  useEffect(() => {
    const samePage = lastPath.current === pathname
    lastPath.current = pathname
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = samePage && !calm ? 'smooth' : 'auto'
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ behavior, block: 'start' })
        return
      }
    }
    window.scrollTo({ top: 0, behavior })
  }, [pathname, hash, key])
  return null
}

const linkClass =
  'rounded-full px-3.5 py-2 text-body font-medium text-muted-foreground transition-colors hover:bg-sand hover:text-foreground'

function useStartTarget() {
  const { status, products } = useWorkspaceStore()
  const returning = status === 'ready' && products.length > 0
  return returning ? { to: '/app', label: 'Open Ordo' } : { to: '/app/new', label: 'Get started' }
}

export function MarketingLayout() {
  const [open, setOpen] = useState(false)
  const start = useStartTarget()

  return (
    <TooltipProvider>
      <ScrollToHash />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu aria-hidden />
            </Button>
            <Link to="/" aria-label="Ordo home" className="rounded-sm">
              <Wordmark />
            </Link>
          </div>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <Link key={l.hash} to={{ pathname: '/', hash: l.hash }} className={linkClass}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="col-start-3 flex items-center justify-end gap-1.5">
            <ThemeToggle />
            <Button asChild variant="primary">
              <Link to={start.to}>{start.label}</Link>
            </Button>
          </div>
        </div>
      </header>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="left" size="nav" className="bg-surface">
          <DrawerTitle className="sr-only">Menu</DrawerTitle>
          <DrawerDescription className="sr-only">Site navigation</DrawerDescription>
          <nav aria-label="Menu" className="flex flex-col gap-1 px-4 py-6">
            <div className="mb-4 px-1.5">
              <Wordmark tagline />
            </div>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.hash}
                to={{ pathname: '/', hash: l.hash }}
                onClick={() => setOpen(false)}
                className={cn(linkClass, 'text-ink')}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </DrawerContent>
      </Drawer>

      <main id="main" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>

      <footer className="border-t bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Wordmark tagline />
            <p className="mt-4 text-caption text-muted-foreground">
              Your roadmaps are saved in this browser. Nothing is uploaded.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-2 gap-y-1">
            {(
              [
                ['About', '/about'],
                ['Help', '/help'],
                ['Privacy', '/privacy'],
                ['Terms', '/terms'],
                ['Contact', '/contact'],
              ] as const
            ).map(([label, to]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(linkClass, isActive && 'bg-primary-soft font-semibold text-primary-text')
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </footer>
    </TooltipProvider>
  )
}
