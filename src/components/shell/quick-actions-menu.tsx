import {
  ChevronDown,
  DatabaseBackup,
  LayoutTemplate,
  Plus,
  Presentation,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const ACTIONS = [
  {
    to: '/app/new',
    icon: Plus,
    title: 'Create a product',
    body: 'Start from scratch with a name and a few details.',
  },
  {
    to: '/app/templates',
    icon: LayoutTemplate,
    title: 'Start from a template',
    body: 'Begin with a complete starter plan you can reshape.',
  },
  {
    to: '/app/example',
    icon: Presentation,
    title: 'Explore the example roadmap',
    body: 'Look around a finished plan. It is read-only.',
  },
  {
    to: '/app/onboarding',
    icon: Sparkles,
    title: 'Take the guide',
    body: 'Five short steps on how a plan fits together.',
  },
  {
    to: '/app/data',
    icon: DatabaseBackup,
    title: 'Back up your data',
    body: 'Download everything as a file you can restore later.',
  },
]

/** The things people most often want to do, one click away from every page in the app. */
export function QuickActionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Zap aria-hidden />
          <span className="max-sm:sr-only">Quick actions</span>
          <ChevronDown aria-hidden className="max-sm:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))]">
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        {ACTIONS.map((a) => (
          <DropdownMenuItem
            key={a.title}
            asChild
            className="items-center gap-3 rounded-input py-2.5"
          >
            <Link to={a.to}>
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-input bg-primary-soft text-primary-text"
                aria-hidden
              >
                <a.icon className="!size-4 !text-primary-text" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-foreground">{a.title}</span>
                <span className="block text-caption font-normal text-muted-foreground">
                  {a.body}
                </span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
