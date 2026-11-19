import {
  Boxes,
  HardDrive,
  Home,
  Layers,
  Map as MapIcon,
  ListChecks,
  Palette,
  Presentation,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { usePlanningStore } from '@/store/planning-store'
import { ProductSwitcher } from './product-switcher'
import { Wordmark } from './wordmark'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Show how many of these the open product has. */
  count?: 'objectives' | 'initiatives' | 'features' | 'roadmaps'
}

const HOME: NavItem[] = [{ to: '/app', label: 'Dashboard', icon: Home, end: true }]
const PLAN: NavItem[] = [
  { to: '/app/workspace', label: 'Overview', icon: Layers, end: true },
  { to: '/app/workspace/objectives', label: 'Objectives', icon: Target, count: 'objectives' },
  { to: '/app/workspace/initiatives', label: 'Initiatives', icon: Boxes, count: 'initiatives' },
  { to: '/app/workspace/features', label: 'Features', icon: ListChecks, count: 'features' },
  { to: '/app/roadmaps', label: 'Roadmaps', icon: MapIcon, count: 'roadmaps' },
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
  const planning = usePlanningStore()
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, end, count }) => (
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
            <span className="flex-1">{label}</span>
            {count && planning.status === 'ready' && (
              <span className="text-caption font-normal text-muted-foreground tabular-nums">
                {planning[count].length}
              </span>
            )}
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
        <NavGroup items={HOME} onNavigate={onNavigate} />
        <hr className="border-border" />
        <NavGroup items={PLAN} onNavigate={onNavigate} />
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
