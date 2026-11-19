import {
  HardDrive,
  Home,
  Layers,
  Palette,
  Presentation,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { ProductSwitcher } from './product-switcher'
import { Wordmark } from './wordmark'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const WORK: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: Home, end: true },
  { to: '/app/workspace', label: 'Workspace', icon: Layers },
]
const LEARN: NavItem[] = [
  { to: '/app/onboarding', label: 'Guide', icon: Sparkles },
  { to: '/app/example', label: 'Example roadmap', icon: Presentation },
]
const SYSTEM: NavItem[] = [
  { to: '/app/data', label: 'Data and backup', icon: HardDrive },
  { to: '/app/design-system', label: 'Design system', icon: Palette },
]

function NavGroup({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-full px-3.5 py-2 text-body font-medium transition-colors',
                isActive
                  ? 'bg-primary-soft font-semibold text-primary-text'
                  : 'text-muted-foreground hover:bg-sand hover:text-foreground',
              )
            }
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

/** Desk-grounded navigation. Used in the fixed sidebar (lg+) and in the mobile drawer. */
export function SidebarContent({
  onCreateProduct,
  onNavigate,
}: {
  onCreateProduct: () => void
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <Link
        to="/"
        aria-label="Ordo home"
        onClick={onNavigate}
        className="mx-1.5 self-start rounded-sm"
      >
        <Wordmark tagline />
      </Link>
      <ProductSwitcher onCreate={onCreateProduct} />
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-4">
        <NavGroup items={WORK} onNavigate={onNavigate} />
        <hr className="border-border" />
        <NavGroup items={LEARN} onNavigate={onNavigate} />
        <hr className="border-border" />
        <NavGroup items={SYSTEM} onNavigate={onNavigate} />
      </nav>
      <p className="px-1.5 text-caption text-muted-foreground">
        No account. Your work stays in this browser.
      </p>
    </div>
  )
}
